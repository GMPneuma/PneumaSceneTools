import {MODULE_ID} from "./settings.js";
import {normalizeRotation, pivotedVehicleRotation, vehiclePivot, vehicleFootprintSize, vehicleGridFootprintSize, vehicleFootprintSwapped, type VehiclePose} from "./vehicle-rotation-geometry.js";
import {getVehicleBaseSize, registerVehicleArtworkSizing, supportsVehicleFootprint} from "./vehicle-footprint.js";

export function isVehicleToken(token: TokenDocument): boolean {
  // Provenance is stamped by template-spawning, never inferred from a name, type, or current folder.
  return token.parent?.documentName === "Scene"
    && foundry.utils.getProperty(token, `flags.${MODULE_ID}.CreatedByVehicleTools`) === true;
}

export function getVehiclePivot(token: TokenDocument) {
  return vehiclePivot(foundry.utils.getProperty(token, `flags.${MODULE_ID}.vehiclePivot`));
}

export function getVehiclePose(token: TokenDocument): VehiclePose {
  const size = token.object?.getSize();
  const grid = token.parent?.grid;
  // Non-square hex footprints need the rendered native size; do not guess on an inactive hex scene.
  if (!size && grid && grid.type !== 0 && grid.type !== 1) throw new Error("Open the vehicle's scene before rotating it on a hex grid.");
  const width = size?.width ?? (token.width ?? 1) * (grid?.size ?? 0);
  const height = size?.height ?? (token.height ?? 1) * (grid?.size ?? 0);
  if (supportsVehicleFootprint(token)) {
    const base = getVehicleBaseSize(token);
    const baseWidth = base.width * grid!.size, baseHeight = base.height * grid!.size;
    // Pivot percentages refer to the original artwork rectangle, centered inside today's footprint.
    return {x: token.x + (width - baseWidth) / 2, y: token.y + (height - baseHeight) / 2,
      width: baseWidth, height: baseHeight, rotation: token.rotation};
  }
  return {x: token.x, y: token.y, rotation: token.rotation, width, height};
}

interface RotationChange {rotation?: number; x?: number; y?: number; width?: number; height?: number; lockRotation?: boolean; [key: string]: unknown}

export function prepareVehicleRotation(token: TokenDocument, change: RotationChange, options: {isUndo?: boolean}, userId: string): false | void {
  if (userId !== game.user?.id || !isVehicleToken(token) || !token.isOwner || options.isUndo) return;
  if (change.width !== undefined || change.height !== undefined) {
    // Category application already supplies the unrotated artwork dimensions.
    const suppliedBase = change[`flags.${MODULE_ID}.vehicleFootprint`] ?? foundry.utils.getProperty(change, `flags.${MODULE_ID}.vehicleFootprint`);
    if (suppliedBase) return;
    // An intentional resize establishes a new artwork size. Undo restores its own saved state instead.
    if (supportsVehicleFootprint(token) && foundry.utils.getProperty(token, `flags.${MODULE_ID}.vehicleFootprint`)) {
      const width = change.width ?? token.width ?? 1, height = change.height ?? token.height ?? 1;
      if ([width, height].every(value => Number.isFinite(value) && value > 0)) {
        change[`flags.${MODULE_ID}.vehicleFootprint`] = vehicleFootprintSwapped(change.rotation ?? token.rotation)
          ? {width: height, height: width} : {width, height};
      }
    }
    return;
  }
  if (token.lockRotation || change.lockRotation === true || typeof change.rotation !== "number" || !Number.isFinite(change.rotation)) return;
  try {
    if (token.parent?.grid.type === 1) {
      const grid = token.parent.grid.size;
      if (!Number.isFinite(grid) || grid <= 0) throw new Error("Vehicle rotation requires a valid grid size.");
      const base = getVehicleBaseSize(token);
      const footprint = vehicleGridFootprintSize(base, change.rotation);
      const explicitPosition = change.x !== undefined || change.y !== undefined;
      // Square-grid rotation uses a stable grid corner, not continuous axle translation.
      const x = Math.round(token.x / grid) * grid, y = Math.round(token.y / grid) * grid;
      const origin = {x: token.x + (token.width ?? 1) * grid / 2, y: token.y + (token.height ?? 1) * grid / 2};
      const center = {x: x + footprint.width * grid / 2, y: y + footprint.height * grid / 2};
      if (!explicitPosition && !game.user.isGM && (center.x !== origin.x || center.y !== origin.y)
        && token.object?.checkCollision(center, {origin, type: "move", mode: "any"})) {
        ui.notifications?.warn("A wall blocks this vehicle turn.");
        return false;
      }
      Object.assign(change, footprint, {rotation: normalizeRotation(change.rotation), [`flags.${MODULE_ID}.vehicleFootprint`]: base});
      if (!explicitPosition) Object.assign(change, {x, y});
      return;
    }
    const pose = getVehiclePose(token);
    const next = pivotedVehicleRotation(pose, getVehiclePivot(token), change.rotation);
    if (next.rotation === ((token.rotation % 360) + 360) % 360) return;
    const center = {x: next.x + pose.width / 2, y: next.y + pose.height / 2};
    const explicitPosition = change.x !== undefined || change.y !== undefined;
    if (!explicitPosition && !game.user.isGM && token.object?.checkCollision(center, {
      origin: {x: pose.x + pose.width / 2, y: pose.y + pose.height / 2}, type: "move", mode: "any",
    })) {
      ui.notifications?.warn("A wall blocks this vehicle turn.");
      return false;
    }
    if (supportsVehicleFootprint(token)) {
      const base = getVehicleBaseSize(token);
      const footprint = vehicleFootprintSize(base, next.rotation);
      change[`flags.${MODULE_ID}.vehicleFootprint`] = base;
      change.width = footprint.width; change.height = footprint.height;
      next.x = center.x - footprint.width * token.parent!.grid.size / 2;
      next.y = center.y - footprint.height * token.parent!.grid.size / 2;
    }
    // Explicit move+rotate destinations remain authoritative; rotation-only turns preserve the axle.
    if (explicitPosition) change.rotation = next.rotation;
    else Object.assign(change, next);
  } catch (error) {
    ui.notifications?.error(String(error));
    return false;
  }
}

const rotations = new WeakMap<TokenDocument, Promise<void>>();

/** Serialize HUD clicks so each turn starts from the last persisted position/angle. */
export function turnVehicle(token: TokenDocument, degrees: number): Promise<void> {
  const previous = rotations.get(token) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    if (!Number.isFinite(degrees)) throw new Error("Invalid vehicle rotation.");
    if (!isVehicleToken(token) || !token.isOwner || token.parent?.tokens.get(token.id!) !== token) throw new Error("This vehicle is no longer available or you do not own it.");
    if (token.lockRotation) throw new Error("Unlock token rotation in Token Configuration before turning this vehicle.");
    if (game.paused && !game.user?.isGM) throw new Error("The game is paused.");
    // Rotation and footprint change in one write; square-grid footprints keep their snapped corner.
    await token.update({rotation: ((token.rotation + degrees) % 360 + 360) % 360}, {animate: false});
  });
  rotations.set(token, next);
  void next.finally(() => {if (rotations.get(token) === next) rotations.delete(token);}).catch(() => {});
  return next;
}

export function registerVehicleRotation(): void {
  registerVehicleArtworkSizing();
  Hooks.on("preUpdateToken", prepareVehicleRotation);
}
