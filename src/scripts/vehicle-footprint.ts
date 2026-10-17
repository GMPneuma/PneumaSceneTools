import {MODULE_ID} from "./settings.js";
import {type VehicleSize} from "./vehicle-rotation-geometry.js";
import {isVehicleToken} from "./vehicle-rotation.js";

export function supportsVehicleFootprint(token: TokenDocument): boolean {
  return token.parent?.grid.type === 0 || token.parent?.grid.type === 1;
}

/** Persistent, unrotated dimensions. Never derive these by repeatedly swapping/scaling artwork. */
export function getVehicleBaseSize(token: TokenDocument): VehicleSize {
  const saved = foundry.utils.getProperty(token, `flags.${MODULE_ID}.vehicleFootprint`) as Partial<VehicleSize> | undefined;
  if (saved && typeof saved.width === "number" && typeof saved.height === "number"
    && Number.isFinite(saved.width) && Number.isFinite(saved.height) && saved.width > 0 && saved.height > 0) {
    return {width: saved.width, height: saved.height};
  }
  if(!isVehicleToken(token))return {width:token.width??1,height:token.height??1};
  throw Error("This vehicle has no valid artwork footprint. Recreate it from a Vehicle Template.");
}

/** Keep Foundry's fit mode, texture aspect ratio, scale, mirroring and anchor behavior. */
export function resizeVehicleArtwork(this: PrimarySpriteMesh, wrapped: (width: number, height: number, options?: PrimarySpriteMesh.ResizeOptions) => void,
  width: number, height: number, options?: PrimarySpriteMesh.ResizeOptions): void {
  const token = this.object as Token | null;
  if (token?.document && token.mesh === this && isVehicleToken(token.document) && supportsVehicleFootprint(token.document)) {
    const base = getVehicleBaseSize(token.document);
    const grid = token.document.parent!.grid.size;
    if (grid > 0) return wrapped(base.width * grid, base.height * grid, options);
  }
  return wrapped(width, height, options);
}

export function registerVehicleArtworkSizing(): void {
  // Native Token mesh refresh uses this helper. Other meshes and ordinary tokens pass through unchanged.
  libWrapper.register(MODULE_ID, "PrimarySpriteMesh.prototype.resize", resizeVehicleArtwork, "WRAPPER");
}
