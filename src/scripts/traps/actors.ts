import { MODULE_ID } from "../settings.js";
import { ensureSceneToolsFolder, findSceneToolsFolder, WORLD_FOLDERS } from "../world-folders.js";
import { gm, trapData, triggerRegion, regionPosition, type Hazard } from "./records.js";
import type { TrapConfig } from "./model.js";
import {defaultHazardActorData} from "./default-actor.js";
export async function hazardActorFolder(): Promise<Folder> {
  return ensureSceneToolsFolder("Actor", "Hazard Actors");
}
export function intact(d: Hazard): boolean {
  const t = trapData(d);
  if (!t)
    return false;
  if (!t.bodyId)
    return false;
  const device = d.parent?.tokens.get(t.bodyId);
  const hp = Number(foundry.utils.getProperty(device?.actor ?? {}, "system.derivedStats.hp.value"));
  return !!device?.actor && Number.isFinite(hp) && hp > 0;
}
export function hazardActorTemplates(): Actor[] {
  const folder = findSceneToolsFolder("Actor", WORLD_FOLDERS.hazardActorTemplates);
  if (!folder)
    return [];
  return (game.actors?.filter(actor => {
    if (!["mook", "character"].includes(String(actor.type)))
      return false;
    let parent = actor.folder;
    for (let depth = 0; parent && depth < 50; depth++, parent = parent.folder)
      if (parent.id === folder.id)
        return true;
    return false;
  }) ?? []) as Actor[];
}
export async function createTemplateHazardActor(d: Hazard, t: TrapConfig, previous?: TokenDocument): Promise<TokenDocument> {
  const template = t.hazardActorTemplateId ? hazardActorTemplates().find(a => a.id === t.hazardActorTemplateId) : undefined;
  if (t.hazardActorTemplateId && !template)
    throw Error("The saved Hazard Actor template is unavailable.");
  if (template && !(Number(foundry.utils.getProperty(template, "system.derivedStats.hp.value")) > 0))
    throw Error("The Hazard Actor template needs positive native HP.");
  const { _id, ...data } = template?.toObject() ?? {_id:undefined,...defaultHazardActorData()}, folder = await hazardActorFolder();
  const [actor] = await Actor.createDocuments([{ ...data, name: t.name || "Untitled hazard", img: t.tokenIcon, prototypeToken: { ...data.prototypeToken, texture: { ...data.prototypeToken?.texture, src: t.tokenIcon } }, folder: folder.id, ownership: { default: 0 }, flags: { ...data.flags, [MODULE_ID]: { hazardOwned: true, hazardSource: d.uuid } } }] as unknown as Actor.CreateData[], { keepEmbeddedIds: true });
  if (!actor)
    throw Error("Hazard Actor creation was cancelled.");
  let placed: TokenDocument | undefined;
  try {
    await (actor as Actor & {
      syncInstalledItems?: () => Promise<void>;
    }).syncInstalledItems?.();
    const region = triggerRegion(d, t), p = previous ? { x: previous.x, y: previous.y } : region?.shapes.length ? regionPosition(region) : canvas.stage?.pivot ?? { x: 0, y: 0 };
    const flags: Record<string, unknown> = { hazardBody: d.uuid, hazardActorTemplateId: template?.id ?? "" };
    const native = await actor.getTokenDocument({ name: t.name || "Untitled hazard", texture: { src: t.tokenIcon }, x: p.x, y: p.y, elevation: previous?.elevation ?? region?.elevation.bottom ?? 0, hidden: previous?.hidden ?? true, actorLink: false, appendNumber: false, flags: { [MODULE_ID]: flags } });
    const tokenData = native.toObject();
    if (!previous) {
      tokenData.x = p.x - (tokenData.width ?? 1) * d.parent!.grid.size / 2;
      tokenData.y = p.y - (tokenData.height ?? 1) * d.parent!.grid.size / 2;
    }
    [placed] = (await d.parent!.createEmbeddedDocuments("Token", [tokenData] as TokenDocument.CreateData[])) ?? [];
    if (!placed?.actor)
      throw Error("Hazard Actor placement was cancelled.");
    return placed;
  }
  catch (error) {
    if (placed)
      await placed.delete();
    await deleteUnusedHazardActor(actor);
    throw error;
  }
}
/** Native character documents provide attackable HP/armor and ordinary equipment sheets. No game stats are supplied. */
export async function createDevice(name: string, hp: number, sp: number, move: number): Promise<Actor> {
  gm();
  if (!name.trim() || ![hp, sp, move].every(Number.isFinite) || hp <= 0 || sp < 0 || move < 0)
    throw Error("Enter a name, positive HP, and nonnegative SP/MOVE.");
  const folder = await hazardActorFolder();
  const type = (game.documentTypes!.Actor as readonly string[]).includes("mook") ? "mook" : "character";
  const [actor] = await Actor.createDocuments([{ name, type, folder: folder.id, img: "icons/svg/hazard.svg", ownership: { default: 0 },
      system: { stats: { move: { value: move } }, derivedStats: { hp: { value: hp, max: hp } } },
      prototypeToken: { actorLink: false, texture: { src: "icons/svg/hazard.svg" }, bar1: { attribute: "derivedStats.hp" } },
      items: sp ? [{ name: "Hazard actor armor", type: "armor", system: { equipped: "equipped", isBodyLocation: true, isHeadLocation: true,
            bodyLocation: { sp, ablation: 0 }, headLocation: { sp, ablation: 0 } } }] : [] }] as unknown as Actor.CreateData[]);
  if (!actor)
    throw Error("Hazard actor creation was cancelled.");
  return actor;
}
export async function setHazardHP(token: TokenDocument, hp: number): Promise<void> {
  if (!token.actor)
    throw Error("Missing hazard Actor.");
  const matches = () => foundry.utils.getProperty(token.actor!, "system.derivedStats.hp.value") === hp && foundry.utils.getProperty(token.actor!, "system.derivedStats.hp.max") === hp;
  if (matches())
    return;
  await token.actor.update({ "system.derivedStats.hp.value": hp, "system.derivedStats.hp.max": hp } as object);
  if (!matches())
    throw Error("Hazard HP update was cancelled.");
}
/** An owned native Actor and unlinked token, with ordinary targetability and native HP. */
export async function createHazardToken(scene: Scene, name: string, hp: number, position: {
  x: number;
  y: number;
  elevation: number;
  hidden: boolean;
  width?: number;
  height?: number;
}, flags: Record<string, unknown>): Promise<TokenDocument> {
  const actor = await createDevice(name, hp, 0, 0);
  let token: TokenDocument | undefined;
  try {
    await actor.update({ [`flags.${MODULE_ID}.hazardOwned`]: true } as object);
    const data = await actor.getTokenDocument({ ...position, actorLink: false, flags: { [MODULE_ID]: flags } });
    [token] = (await scene.createEmbeddedDocuments("Token", [data.toObject()] as TokenDocument.CreateData[])) ?? [];
    if (!token)
      throw Error("Hazard token creation was cancelled.");
    await setHazardHP(token, hp);
    return token;
  }
  catch (error) {
    if (token)
      await token.delete();
    await deleteUnusedHazardActor(actor);
    throw error;
  }
}
export async function removeHazardToken(token: TokenDocument): Promise<void> {
  await token.delete();
  if (token.parent?.tokens.has(token.id!))
    throw Error("Hazard token deletion was cancelled.");
  await cleanupHazardActor(token);
}
export async function cleanupHazardActor(token: TokenDocument): Promise<void> {
  if (foundry.utils.getProperty(token, `flags.${MODULE_ID}.hazardCondition.templateActorId`))
    return;
  const actor = game.actors?.get(token.actorId!);
  if (actor && foundry.utils.getProperty(actor, `flags.${MODULE_ID}.hazardOwned`))
    await deleteUnusedHazardActor(actor);
}
const actorDeletions = new Map<string, Promise<void>>();
export async function deleteUnusedHazardActor(actor: Pick<Actor, "id" | "delete">): Promise<void> {
  const pending = actorDeletions.get(actor.id!);
  if (pending)
    return pending;
  if (!game.actors?.has(actor.id!) || game.scenes?.some(s => s.tokens.some(t => t.actorId === actor.id)))
    return;
  const deletion = Promise.resolve().then(async () => { await actor.delete(); if (game.actors?.has(actor.id!))
    throw Error("Hazard Actor deletion was cancelled."); }).finally(() => actorDeletions.delete(actor.id!));
  actorDeletions.set(actor.id!, deletion);
  await deletion;
}
