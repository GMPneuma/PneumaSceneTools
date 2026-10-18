import {MODULE_ID} from "./settings.js";
import {isVehicleToken} from "./vehicle-rotation.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";

const pending = new Set<TokenDocument>();

export function isPromotedVehicle(token: TokenDocument): boolean {
  return foundry.utils.getProperty(token.actor ?? {}, `flags.${MODULE_ID}.promotedVehicle`) === true;
}

/** Copy the configured vehicle, excluding scene identity and transient automation state. */
export async function promoteVehicle(token: TokenDocument): Promise<void> {
  if (pending.has(token)) throw new Error("This vehicle is already being promoted.");
  const requireVehicle = () => {
    if (!game.user?.isGM || !token.isOwner || !isVehicleToken(token) || !token.actor || token.actorLink || token.parent?.tokens.get(token.id!) !== token)
      throw new Error("Choose an owned, unlinked SceneTools vehicle to promote.");
  };
  requireVehicle();
  pending.add(token);
  let promoted: Actor | undefined;
  try {
    const folder = await ensureSceneToolsFolder("Actor", WORLD_FOLDERS.vehiclePromoted);
    requireVehicle();
    const data = token.actor!.toObject() as unknown as Record<string, unknown>;
    delete data._id;
    const flags = (data.flags ??= {}) as Record<string, Record<string, unknown>>;
    const moduleFlags = flags[MODULE_ID] ??= {};
    delete moduleFlags.defaultVehicleTemplate;
    delete moduleFlags.IsDefaultMookTemplate;
    delete moduleFlags.CreatedByMookMaker;
    moduleFlags.promotedVehicle = true;
    const prototype = token.toObject() as unknown as Record<string, unknown>;
    for (const key of ["_id", "actorId", "delta", "x", "y", "elevation", "sort", "hidden", "_stats"]) delete prototype[key];
    const vehicleFlags: Record<string, unknown> = {CreatedByVehicleTools: true};
    for (const key of ["vehicleFootprint", "vehiclePivot", "vehicleSeats", "vehicleSeatLayouts", "vehicleSeatDefault", "vehicleArtworkCategory"]) {
      const value = foundry.utils.getProperty(token, `flags.${MODULE_ID}.${key}`);
      if (value !== undefined) vehicleFlags[key] = structuredClone(value);
    }
    prototype.flags = {[MODULE_ID]: vehicleFlags};
    Object.assign(prototype, {actorLink: true, appendNumber: false, randomImg: false});
    Object.assign(data, {name: token.name, img: token.texture.src, folder: folder.id, prototypeToken: prototype});
    promoted = await Actor.create(data as Actor.CreateData) as Actor | undefined;
    if (!promoted) throw new Error("Vehicle Actor creation was cancelled.");
    requireVehicle();
    await token.update({actorId: promoted.id, actorLink: true} as object);
    if (token.actorId !== promoted.id || !token.actorLink) throw new Error("Foundry did not confirm the vehicle was linked to its permanent Actor.");
    ui.notifications?.info(`Promoted ${token.name} to a permanent vehicle Actor.`);
  } catch (error) {
    if (promoted && token.actorId !== promoted.id) await promoted.delete();
    throw error;
  } finally {
    pending.delete(token);
  }
}
