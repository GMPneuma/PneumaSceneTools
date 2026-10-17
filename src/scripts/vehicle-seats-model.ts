import {MODULE_ID} from "./settings.js";
import {getVehicleBaseSize} from "./vehicle-footprint.js";

export interface VehicleSeat {id: string; name: string; x: number; y: number}
export interface SeatLayout {image: string; imageWidth: number; imageHeight: number; seats: VehicleSeat[]}
export interface SeatAssignment {
  vehicleId: string; seatId: string;
  original: {scaleX: number; scaleY: number; rotation: number; elevation: number; sort: number};
}
export const seatFlag = (token: object, key: string): unknown => foundry.utils.getProperty(token, `flags.${MODULE_ID}.${key}`);
export const assignment = (token: TokenDocument): SeatAssignment | undefined => seatFlag(token, "vehicleSeat") as SeatAssignment | undefined;

/** Adjacent token footprints touch at an edge or corner; overlap also qualifies. */
export function adjacentToVehicle(passenger: TokenDocument, vehicle: TokenDocument): boolean {
  if (!passenger.parent || passenger.parent !== vehicle.parent) return false;
  const grid = passenger.parent.grid.size;
  if (!(grid > 0)) return false;
  const gapX = Math.max(vehicle.x - (passenger.x + (passenger.width ?? 1) * grid), passenger.x - (vehicle.x + (vehicle.width ?? 1) * grid), 0);
  const gapY = Math.max(vehicle.y - (passenger.y + (passenger.height ?? 1) * grid), passenger.y - (vehicle.y + (vehicle.height ?? 1) * grid), 0);
  return gapX <= 1 && gapY <= 1;
}

export function seatLayout(token: TokenDocument): SeatLayout | undefined {
  const local = seatFlag(token, "vehicleSeats") as SeatLayout | undefined;
  if (local?.image === token.texture.src) return local;
  const defaults = seatFlag(token, "vehicleSeatLayouts") as SeatLayout[] | undefined;
  const exact = defaults?.find(layout => layout.image === token.texture.src);
  if (exact) return exact;
  const shared = seatFlag(token, "vehicleSeatDefault") as SeatLayout | undefined;
  if (!shared) return undefined;
  const image = token.object?.mesh?.texture?.orig;
  return {...shared, image: token.texture.src ?? shared.image,
    imageWidth: image?.width || shared.imageWidth, imageHeight: image?.height || shared.imageHeight};
}

export function validateSeatLayout(value: SeatLayout): SeatLayout {
  if (!value || typeof value.image !== "string" || !value.image || ![value.imageWidth, value.imageHeight].every(n => Number.isFinite(n) && n > 0)
    || !Array.isArray(value.seats) || value.seats.length > 100) throw new Error("Invalid vehicle seat layout.");
  const ids = new Set<string>();
  const seats = value.seats.map(seat => {
    if (!seat || typeof seat.id !== "string" || !seat.id || ids.has(seat.id) || typeof seat.name !== "string" || !seat.name.trim()
      || ![seat.x, seat.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error("Each seat needs a unique ID, name, and position on the image.");
    ids.add(seat.id);
    return {id: seat.id, name: seat.name.trim().slice(0, 80), x: seat.x, y: seat.y};
  });
  return {image: value.image, imageWidth: value.imageWidth, imageHeight: value.imageHeight, seats};
}

/** Image coordinates, including transparent pixels; independent of the changing occupied grid cells. */
export function seatPosition(vehicle: TokenDocument, layout: SeatLayout, seat: VehicleSeat): {x: number; y: number} {
  const grid = vehicle.parent!.grid.size;
  const base = getVehicleBaseSize(vehicle);
  const scale = Math.min(base.width * grid / layout.imageWidth, base.height * grid / layout.imageHeight);
  const x = (seat.x - (vehicle.texture.anchorX ?? 0.5)) * layout.imageWidth * scale * (vehicle.texture.scaleX ?? 1);
  const y = (seat.y - (vehicle.texture.anchorY ?? 0.5)) * layout.imageHeight * scale * (vehicle.texture.scaleY ?? 1);
  const angle = (vehicle.lockRotation ? 0 : vehicle.rotation) * Math.PI / 180;
  return {x: vehicle.x + (vehicle.width ?? 1) * grid / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    y: vehicle.y + (vehicle.height ?? 1) * grid / 2 + x * Math.sin(angle) + y * Math.cos(angle)};
}

export function seatedUpdate(vehicle: TokenDocument, rider: TokenDocument, layout: SeatLayout, seat: VehicleSeat, state: SeatAssignment): Record<string, unknown> {
  const point = seatPosition(vehicle, layout, seat), grid = vehicle.parent!.grid.size;
  return {_id: rider.id, x: Math.round(point.x - (rider.width ?? 1) * grid / 2), y: Math.round(point.y - (rider.height ?? 1) * grid / 2),
    rotation: state.original.rotation, elevation: vehicle.elevation, sort: vehicle.sort + 1,
    "texture.scaleX": state.original.scaleX * 0.6, "texture.scaleY": state.original.scaleY * 0.6};
}

export function restoredUpdate(rider: TokenDocument): Record<string, unknown> {
  const state = assignment(rider);
  if (!state) return {_id: rider.id};
  return {_id: rider.id, rotation: state.original.rotation, elevation: state.original.elevation, sort: state.original.sort,
    "texture.scaleX": state.original.scaleX, "texture.scaleY": state.original.scaleY,
    [`flags.${MODULE_ID}.-=vehicleSeat`]: null};
}

export function riders(vehicle: TokenDocument): TokenDocument[] {
  return vehicle.parent?.tokens.filter(token => assignment(token)?.vehicleId === vehicle.id) ?? [];
}

export function isPassenger(token: TokenDocument): boolean {
  if (seatFlag(token, "CreatedByVehicleTools") === true) return false;
  return String(token.actor?.type) === "character" || String(token.actor?.type) === "mook";
}

export function seatCapacity(token: TokenDocument): number | undefined {
  const item = token.actor?.items.find(item => String(item.type) === "vehicle");
  if (!item) return undefined;
  const count = Number(foundry.utils.getProperty(item, "system.seats") ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/** Align each axis to the nearest other seat within five percentage points of the artwork dimensions. */
export function snapSeatPosition(point: {x: number; y: number}, seats: SeatLayout["seats"], selected: string | undefined): {x: number; y: number} {
  const result = {...point};
  for (const axis of ["x", "y"] as const) {
    let nearest = 0.05 + Number.EPSILON;
    for (const seat of seats) {
      if (seat.id === selected) continue;
      const distance = Math.abs(seat[axis] - point[axis]);
      if (distance <= nearest) {nearest = distance;result[axis] = seat[axis];}
    }
  }
  return result;
}
