import { MODULE_ID } from "../settings.js";
import { freshAP } from "../netarch/model.js";
import { accessPointTypes, typeImage } from "../netarch/types.js";
import { gm, trapData, updateTrap, center, regionPosition, type Hazard } from "./records.js";
import type { TrapConfig } from "./model.js";
export async function syncAccessPoint(d: Hazard): Promise<void> {
  gm();
  const t = trapData(d)!, scene = d.parent!;
  const marker = t.apId ? scene.tokens.get(t.apId) : undefined, device = scene.tokens.get(t.bodyId || t.deviceId);
  if (!t.apType || !accessPointTypes().some(a => a.id === t.apType)) {
    if (marker)
      await marker.delete();
    if (t.apId)
      await updateTrap(d, { apId: "" });
    return;
  }
  if (!marker) {
    if (t.apId)
      await updateTrap(d, { apId: "" });
    return;
  }
  const p = device ? center(device) : undefined, size = scene.grid.size * 0.5;
  const position = p ? { x: p.x - size / 2, y: p.y - size / 2, elevation: device!.elevation } : {};
  const changedType = foundry.utils.getProperty(marker, `flags.${MODULE_ID}.type`) !== t.apType;
  const template = game.actors?.find(a => foundry.utils.getProperty(a, `flags.${MODULE_ID}.templateType`) === t.apType);
  await marker.update({ ...position, name: t.name, ...(changedType ? { "texture.src": template?.prototypeToken.texture.src || typeImage(t.apType) } : {}), [`flags.${MODULE_ID}.type`]: t.apType } as object);
}
/** Place an ordinary Scanner AP from the GM's existing native Actor template. */
export async function createHazardAccessPoint(scene: Scene, t: TrapConfig): Promise<TokenDocument> {
  gm();
  if (!t.name.trim())
    throw Error("Name the hazard first.");
  if (!accessPointTypes().some(a => a.id === t.apType))
    throw Error("Choose a NetArch access point type first.");
  const existing = scene.tokens.get(t.apId);
  if (existing)
    return existing;
  const template = () => game.actors?.find(a => foundry.utils.getProperty(a, `flags.${MODULE_ID}.templateType`) === t.apType);
  const actor = template();
  if (!actor)
    throw Error("The selected access point template is unavailable.");
  const body = scene.tokens.get(t.bodyId), region = scene.regions.get(t.triggerRegionId);
  const point = body ? center(body) : region ? regionPosition(region) : canvas.scene?.id === scene.id ? canvas.stage?.pivot : { x: 0, y: 0 };
  const size = scene.grid.size * 0.5;
  const native = await actor.getTokenDocument({ name: t.name, x: (point?.x ?? 0) - size / 2, y: (point?.y ?? 0) - size / 2, elevation: body?.elevation ?? region?.elevation.bottom ?? 0, hidden: true, actorLink: false, appendNumber: false, flags: { [MODULE_ID]: freshAP(t.apType) } });
  const [created] = (await scene.createEmbeddedDocuments("Token", [native.toObject()] as TokenDocument.CreateData[])) ?? [];
  if (!created)
    throw Error("Access point creation was cancelled.");
  return created;
}
