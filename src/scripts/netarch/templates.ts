import { accessPointTypes, typeImage } from "./types.js";
import { MODULE_ID, SYSTEM_ID, TYPES } from "./constants.js";
import { apData, freshAP, isAP } from "./model.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "../world-folders.js";

export function activeGM() {
  return game.users!.activeGM ?? game.users!.filter((user) => user.active && user.isGM).sort((a, b) => a.id!.localeCompare(b.id!))[0];
}

let provisioning: Promise<number> | undefined;
export async function ensureTemplates({ defaults = false, manual = false } = {}) {
  if (!game.user!.isGM || (!manual && activeGM()?.id !== game.user!.id)) return;
  if (provisioning) { await provisioning; if (!manual) return; }
  provisioning = provision(defaults).finally(() => { provisioning = undefined; });
  return provisioning;
}

async function provision(defaults: boolean) {
  if (!(game.documentTypes!.Actor as readonly string[]).includes("container")) throw new Error("Cyberpunk RED's container Actor type is unavailable.");
  const updates = game.actors!.filter((actor) => Boolean(actor.getFlag?.(MODULE_ID, "templateType") || isAP(actor.prototypeToken))
    && actor.prototypeToken?.appendNumber !== true)
    .map((actor) => ({ _id: actor.id, "prototypeToken.appendNumber": true }));
  if (updates.length) await Actor.updateDocuments(updates);
  const missing = (defaults ? TYPES : accessPointTypes()).filter((type) => !game.actors!.some((actor) => actor.getFlag(MODULE_ID, "templateType") === type.id));
  if (!missing.length) return 0;
  const folder = await ensureSceneToolsFolder("Actor", WORLD_FOLDERS.netarchAPs);
  // createDocuments uses the native data model without CPRContainerActor.create's shop defaults.
  await Actor.createDocuments(missing.map((type) => ({
    name: `AP — ${type.label}`, type: "container", folder: folder.id,
    img: typeImage(type.id), system: {}, items: [], ownership: { default: 0 },
    flags: { [MODULE_ID]: { templateType: type.id }, [SYSTEM_ID]: { "container-type": "custom" } },
    prototypeToken: {
      name: type.label, actorLink: false, appendNumber: true, width: 0.5, height: 0.5,
      texture: { src: typeImage(type.id) }, hidden: true, disposition: 0,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
      bar1: { attribute: null }, bar2: { attribute: null },
      sight: { enabled: false }, light: { bright: 0, dim: 0 },
      flags: { [MODULE_ID]: freshAP(type.id) },
    },
  })) as unknown as Actor.CreateData[]);
  return missing.length;
}

export function registerTokenGuards() {
  Hooks.on("preCreateToken", (doc: TokenDocument, _data: object, _options: object, userId: string) => {
    if (userId !== game.user!.id) return;
    const templateType = game.actors!.get(doc.actorId ?? "")?.getFlag(MODULE_ID, "templateType");
    if (!isAP(doc) && !templateType) return;
    const data = apData(doc);
    doc.updateSource({
      hidden: true, actorLink: false,
      sight: { enabled: false }, light: { bright: 0, dim: 0 },
      flags: { [MODULE_ID]: freshAP(data.type ?? templateType, data.netarch) },
    });
  });
  Hooks.on("preUpdateToken", (doc: TokenDocument, changes: {hidden?: boolean; actorLink?: boolean; sight?: {enabled?: boolean}; light?: {bright?: number; dim?: number}; [key: string]: unknown}) => {
    if (!isAP(doc)) return;
    // Native tokens stay GM-only. Disclosure is per-client, including after disabling this module.
    changes.hidden = true;
    changes.actorLink = false;
    if (changes.sight) changes.sight.enabled = false;
    if (changes.light) { changes.light.bright = 0; changes.light.dim = 0; }
    changes["sight.enabled"] = false;
    changes["light.bright"] = 0;
    changes["light.dim"] = 0;
  });
}

