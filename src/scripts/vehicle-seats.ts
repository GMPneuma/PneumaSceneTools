import {registerSeatRequests, sendSeatRequest, type SeatAction} from "./vehicle-seat-requests.js";
import {MODULE_ID} from "./settings.js";
import {isPromotedVehicle} from "./vehicle-promotion.js";
import {isVehicleToken} from "./vehicle-rotation.js";
import {adjacentToVehicle, assignment, isPassenger, restoredUpdate, riders, seatCapacity, seatPosition, seatFlag, seatLayout, seatedUpdate, validateSeatLayout, type SeatAssignment, type SeatLayout} from "./vehicle-seats-model.js";
import {registerSeatHud} from "./vehicle-seats-ui.js";
import {changesSeatFields, VEHICLE_SEAT_FIELDS, PASSENGER_SEAT_FIELDS, refreshAffectsSeats} from "./vehicle-seat-changes.js";

let queue: Promise<unknown> = Promise.resolve();
export function queueSeatWork<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => {}).then(work); queue = next; return next;
}
const activeGM = () => game.users?.activeGM;
const authority=()=>!!game.user?.isGM && activeGM()?.id===game.user.id;


export async function allowPlayersToUse(vehicle: TokenDocument): Promise<void> {
  return setPlayerVehicleControl(vehicle, true);
}

export function playersControlVehicle(vehicle: TokenDocument): boolean {
  const ownership = vehicle.actor?.ownership ?? {};
  const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  return ownership.default === owner || Boolean(Array.from(game.users ?? []).some(user => !user.isGM && (ownership[user.id!] ?? ownership.default ?? 0) >= owner));
}

export async function setPlayerVehicleControl(vehicle: TokenDocument, enabled: boolean): Promise<void> {
  if (!game.user?.isGM || !isVehicleToken(vehicle) || !vehicle.actor) throw new Error("Only a GM can grant vehicle access.");
  if (vehicle.actorLink && !isPromotedVehicle(vehicle)) throw new Error("Unlink this vehicle token before granting access to this vehicle only.");
  requireCurrent(vehicle);
  const level = enabled ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
  const ownership: Record<string, number> = {...vehicle.actor.ownership, default: level};
  for (const user of game.users ?? []) if (!user.isGM) ownership[user.id!] = level;
  // Unlinked vehicles update their synthetic Actor; promoted vehicles share their permanent Actor's permissions.
  const saved = await vehicle.actor.update({ownership} as object);
  if (!saved) throw new Error("Vehicle permission update was cancelled.");
}
export async function requestSeatAction(token: TokenDocument, action: SeatAction): Promise<void> {
  if (!token.isOwner) throw Error("You can only board or exit with a token you own.");
  requireCurrent(token);
  if(!activeGM())throw Error("An active GM is required to use vehicle seats.");
  if (activeGM()!.id === game.user?.id || game.user?.isGM && action.action === "layout")
    return queueSeatWork(() => executeSeatRequest(token, action, game.user!.id!));
  return sendSeatRequest(token, action);
}

function requireCurrent(token: TokenDocument): void {
  if (token.parent?.tokens.get(token.id!) !== token) throw new Error("This token no longer exists.");
}

/** Validate ownership and seat availability again when the serialized request executes. */
export async function executeSeatRequest(token: TokenDocument, request: SeatAction, userId: string, mode?: "validate"|"owner"): Promise<void> {
  const localLayout=request.action==="layout" && game.user?.isGM && game.user.id===userId;
  const ownerWrite=mode==="owner" && !!activeGM() && game.user?.id===userId;
  if (!localLayout && !ownerWrite && !authority()) throw new Error("An active GM grant is required to assign seats.");
  requireCurrent(token);
  const user = game.users?.get(userId);
  if (!user || !token.canUserModify(user as User, "update")) throw new Error("You do not own this token.");
  if (game.paused && !user.isGM) throw new Error("The game is paused.");
  if (request.action === "layout") {
    if (!user.isGM || !isVehicleToken(token)) throw new Error("Only a GM can configure vehicle seats.");
    const layout = validateSeatLayout(request.layout!);
    if (layout.image !== token.texture.src) throw new Error("The vehicle image changed. Reopen the seat editor.");
    const capacity = Number((token.actor?.items.find(item => String(item.type) === "vehicle")?.system as {seats?: number} | undefined)?.seats ?? 0);
    if (capacity > 0 && layout.seats.length > capacity) throw new Error(`This vehicle has capacity for ${capacity} seats.`);
    if (riders(token).some(rider => !layout.seats.some(seat => seat.id === assignment(rider)?.seatId))) throw new Error("Exit occupied seats before removing them.");
    // Save the local layout first; failure leaves the previous layout and all riders intact.
    await token.update({[`flags.${MODULE_ID}.vehicleSeats`]: layout} as object);
    if (JSON.stringify(seatFlag(token, "vehicleSeats")) !== JSON.stringify(layout)) throw new Error("Saving seats was cancelled.");
    await syncVehicleSeats(token);
    if (request.template) {
      const actor = game.actors?.get(token.actorId ?? "");
      if (!actor) throw new Error("Local seats saved, but the original template no longer exists.");
      const prior = seatFlag(actor.prototypeToken, "vehicleSeatLayouts") as SeatLayout[] | undefined;
      try {
        const changes = request.templateAllImages
          ? {[`prototypeToken.flags.${MODULE_ID}.vehicleSeatDefault`]: layout}
          : {[`prototypeToken.flags.${MODULE_ID}.vehicleSeatLayouts`]: [...(prior ?? []).filter(value => value.image !== layout.image), layout]};
        const saved = await actor.update(changes as object);
        if (!saved) throw new Error("Template update cancelled.");
      } catch (error) {throw new Error(`Local seats saved, but saving the template failed: ${String(error)}`);}
    }
    return;
  }
  if (!isPassenger(token)) throw new Error("Choose a character token.");
  if (request.action === "exit") {if(mode!=="validate")await exitSeat(token); return;}
  if (request.action !== "board") throw new Error("Unknown seat action.");
  const vehicle = token.parent!.tokens.get(request.vehicleId ?? "");
  if (!vehicle || !isVehicleToken(vehicle) || vehicle.id === token.id || (!user.isGM && vehicle.hidden)) throw new Error("Choose a visible vehicle in this scene.");
  if (!vehicle.canUserModify(user as User, "update")) throw new Error("You must own the vehicle to board it.");
  if (!user.isGM && assignment(token)?.vehicleId !== vehicle.id && !adjacentToVehicle(token, vehicle)) throw new Error("Move your character adjacent to the vehicle before entering.");
  const layout = seatLayout(vehicle), seat = layout?.seats.find(value => value.id === request.seatId);
  if (!layout || !seat) throw new Error("That seat no longer exists. Refresh the seat list.");
  const capacity = seatCapacity(vehicle) ?? layout.seats.length;
  if (layout.seats.indexOf(seat) >= capacity || riders(vehicle).length >= capacity && !assignment(token)) throw new Error("That seat is outside this vehicle’s capacity or the vehicle is full.");
  const current = assignment(token);
  if (current) {
    if (current.vehicleId === vehicle.id && current.seatId === seat.id) return;
    if (current.vehicleId !== vehicle.id) throw new Error("Exit the current vehicle before boarding another.");
  }
  if (riders(vehicle).some(rider => assignment(rider)?.seatId === seat.id)) throw new Error("That seat is already occupied.");
  if(mode==="validate")return;
  const state: SeatAssignment = {vehicleId: vehicle.id!, seatId: seat.id, original: current?.original ?? {
    scaleX: token.texture.scaleX ?? 1, scaleY: token.texture.scaleY ?? 1, rotation: token.rotation, elevation: token.elevation, sort: token.sort,
  }};
  await token.update({...seatedUpdate(vehicle, token, layout, seat, state), [`flags.${MODULE_ID}.vehicleSeat`]: state} as object, {animate: false, vehicleSeats: true} as object);
  if (assignment(token)?.vehicleId !== vehicle.id || assignment(token)?.seatId !== seat.id) throw new Error("Boarding was cancelled.");
}

export async function exitSeat(rider: TokenDocument, deletedVehicle?: TokenDocument): Promise<void> {
  const state = assignment(rider); if (!state) return;
  const vehicle = deletedVehicle ?? rider.parent?.tokens.get(state.vehicleId);
  const update = restoredUpdate(rider);
  if (vehicle && vehicle.parent?.tokens.get(vehicle.id!) === vehicle) {
    const grid = vehicle.parent!.grid.size;
    const width = (vehicle.width ?? 1) * grid, height = (vehicle.height ?? 1) * grid;
    const rw = (rider.width ?? 1) * grid, rh = (rider.height ?? 1) * grid;
    const layout = seatLayout(vehicle), seat = layout?.seats.find(value => value.id === state.seatId);
    const origin = layout && seat ? seatPosition(vehicle, layout, seat) : {x: rider.x + rw / 2, y: rider.y + rh / 2};
    const candidates: {x: number; y: number}[] = [];
    // Enumerate the whole perimeter so each seat can use its nearest side and row.
    const left = Math.floor((vehicle.x - rw) / grid) * grid, right = Math.ceil((vehicle.x + width) / grid) * grid;
    const top = Math.floor((vehicle.y - rh) / grid) * grid, bottom = Math.ceil((vehicle.y + height) / grid) * grid;
    for (let y = top; y <= bottom; y += grid) candidates.push({x: left, y}, {x: right, y});
    for (let x = left + grid; x < right; x += grid) candidates.push({x, y: top}, {x, y: bottom});
    candidates.sort((a, b) => Math.hypot(a.x + rw / 2 - origin.x, a.y + rh / 2 - origin.y)
      - Math.hypot(b.x + rw / 2 - origin.x, b.y + rh / 2 - origin.y));
    // Without a rendered scene, collision data is unavailable. Exit over the vehicle instead.
    const object = canvas.scene?.id === vehicle.parent!.id ? rider.object : null;
    const nearest = candidates[0]!;
    const clear = object && !object.checkCollision({x: nearest.x + rw / 2, y: nearest.y + rh / 2}, {type: "move", mode: "any"});
    const point = clear ? nearest : {
      x: Math.floor(Math.max(vehicle.x, Math.min(vehicle.x + width - 1, origin.x)) / grid) * grid,
      y: Math.floor(Math.max(vehicle.y, Math.min(vehicle.y + height - 1, origin.y)) / grid) * grid,
    };
    Object.assign(update, point);
  }
  await rider.update(update as object, {animate: false, vehicleSeats: true} as object);
  if (assignment(rider)) throw new Error("Exiting was cancelled.");
}

export async function syncVehicleSeats(vehicle: TokenDocument): Promise<void> {
  const layout = seatLayout(vehicle);
  const failures: string[] = [];
  const passengers = riders(vehicle).sort((a, b) => a.id!.localeCompare(b.id!));
  for (const rider of passengers) {
    if (!authority()) continue;
    try {
      const state = assignment(rider)!, seat = layout?.seats.find(value => value.id === state.seatId);
      const duplicate = passengers.find(other => assignment(other)?.seatId === state.seatId)?.id !== rider.id;
      if (duplicate || !layout || !seat || vehicle.parent?.tokens.get(vehicle.id!) !== vehicle) {await exitSeat(rider, vehicle); continue;}
      const changes = seatedUpdate(vehicle, rider, layout, seat, state);
      const changed = Object.entries(changes).some(([key, value]) => {
        if (key === "_id") return false;
        const current = foundry.utils.getProperty(rider._source ?? rider, key);
        return typeof current === "number" && typeof value === "number" ? Math.abs(current - value) > 0.00001 : current !== value;
      });
      if (changed) await rider.update(changes as object, {animate: false, vehicleSeats: true} as object);
    } catch (error) {failures.push(`${rider.name}: ${String(error)}`);}
  }
  if (failures.length) throw new Error(failures.join("; "));
}

/** Render against the actual image transform during native animation, before GM persistence arrives. */
function refreshSeatedArt(token: Token, flags?: Record<string, unknown>): void {
  if (!refreshAffectsSeats(flags)) return;
  const vehicle = isVehicleToken(token.document) ? token.document : token.document.parent?.tokens.get(assignment(token.document)?.vehicleId ?? "");
  if (!vehicle?.object?.mesh || !canvas.tokens || !canvas.primary) return;
  const layout = seatLayout(vehicle); if (!layout) return;
  const mesh = vehicle.object.mesh, texture = mesh.texture;
  if (!texture) return;
  for (const rider of token.document === vehicle ? riders(vehicle) : [token.document]) {
    const object = rider.object, seat = layout.seats.find(value => value.id === assignment(rider)?.seatId);
    if (!object?.mesh || !seat) continue;
    const global = mesh.toGlobal(new PIXI.Point((seat.x - mesh.anchor.x) * texture.orig.width, (seat.y - mesh.anchor.y) * texture.orig.height));
    const point = canvas.tokens.toLocal(global), primary = canvas.primary.toLocal(global);
    object.position.set(point.x - object.w / 2, point.y - object.h / 2);
    object.mesh.position.set(primary.x, primary.y);
    object.mesh.rotation = rider.lockRotation ? 0 : assignment(rider)!.original.rotation * Math.PI / 180;
  }
}

export function registerVehicleSeats(): void {
  registerSeatHud();
  registerSeatRequests(executeSeatRequest,queueSeatWork);
  // v12's refreshToken hook does not expose which fields refreshed. Use native render flags.
  libWrapper.register(MODULE_ID, "Token.prototype._applyRenderFlags", function(this: Token, wrapped: (flags: Record<string, unknown>) => void, flags: Record<string, unknown>) {
    wrapped(flags);
    refreshSeatedArt(this, flags);
  }, "WRAPPER");
  Hooks.on("preCreateToken", (token: TokenDocument) => {
    if (assignment(token)) {const changes = restoredUpdate(token); delete changes._id; token.updateSource(changes as object);}
  });
  Hooks.on("preUpdateToken", (token: TokenDocument, changes: Record<string, unknown>, options: {vehicleSeats?: boolean}) => {
    if (game.user?.isGM || (options?.vehicleSeats && token.isOwner)) return;
    const keys = Object.keys(foundry.utils.flattenObject(changes));
    if (keys.some(key => key.startsWith(`flags.${MODULE_ID}.vehicleSeat`))) return false;
    if (assignment(token) && keys.some(key => ["x", "y", "rotation", "width", "height", "texture.scaleX", "texture.scaleY", "elevation", "sort"].includes(key))) {
      ui.notifications?.warn("Exit the vehicle seat before moving this character."); return false;
    }

  });
  Hooks.on("updateToken", (token: TokenDocument, changes: object, _options: object) => {
    if (isVehicleToken(token) && changesSeatFields(changes, VEHICLE_SEAT_FIELDS)) {
      void queueSeatWork(() => syncVehicleSeats(token)).catch(error => ui.notifications?.error(String(error)));
    } else if (changesSeatFields(changes, PASSENGER_SEAT_FIELDS)) {
      const vehicle = token.parent?.tokens.get(assignment(token)?.vehicleId ?? "");
      // Assignment changes still resolve concurrent boarding; internal placement never requeues itself.
      const assignmentChanged = changesSeatFields(changes, ["flags.pneuma-scenetools.vehicleSeat"]);
      if (vehicle && (assignmentChanged || !(_options as {vehicleSeats?: boolean}).vehicleSeats)) void queueSeatWork(() => syncVehicleSeats(vehicle)).catch(error => ui.notifications?.error(String(error)));
    }

  });
  Hooks.on("deleteToken", (token: TokenDocument) => {
    if (isVehicleToken(token)) void queueSeatWork(() => syncVehicleSeats(token)).catch(error => ui.notifications?.error(String(error)));
  });

}
