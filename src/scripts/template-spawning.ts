import {MODULE_ID} from "./settings.js";
import {ensureSceneToolsFolder, findSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";
import {isTemplateActor} from "./mookmaker/folders.js";
import type {SpawnKind} from "./token-artwork.js";
import {armoredChassisData, ensureWorldChassis} from "./vehicle-chassis.js";

const DEFAULT_VEHICLE_IMAGE = `modules/${MODULE_ID}/assets/vehicle-outline.svg`;

export async function ensureVehicleTemplate(): Promise<void> {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
  await ensureWorldChassis();
  const folder = await ensureSceneToolsFolder("Actor", WORLD_FOLDERS.vehicleTemplates);
  const defaults = game.actors?.filter(actor => foundry.utils.getProperty(actor, `flags.${MODULE_ID}.defaultVehicleTemplate`) === true) ?? [];
  const existing = defaults.find(actor => ["mook", "character"].includes(String(actor.type)));
  if (existing) return;
  await Actor.createDocuments([{
    name: "Vehicle Template", type: "mook", folder: folder.id, img: DEFAULT_VEHICLE_IMAGE, system: {},
    flags: {[MODULE_ID]: {defaultVehicleTemplate: true}},
    ownership: {default: 0},
    prototypeToken: {name: "Vehicle", actorLink: false, appendNumber: true, width: 2, height: 3, bar1: {attribute: "derivedStats.hp"}, texture: {src: DEFAULT_VEHICLE_IMAGE}},
    items: [{name: "Vehicle", type: "vehicle"}, armoredChassisData(true)],
  } as unknown as Actor.CreateData]);
}

export function templateKind(actor: Actor | undefined): SpawnKind | undefined {
  if (!actor) return;
  if (foundry.utils.getProperty(actor, `flags.${MODULE_ID}.promotedVehicle`) === true) return;
  if (actor.folder && actor.folder.id === findSceneToolsFolder("Actor", WORLD_FOLDERS.vehicleTemplates)?.id) return "vehicle";
  if (isTemplateActor(actor)) return "mook";
}

export function registerTemplateSpawning(): void {
  Hooks.on("preCreateToken", (token: TokenDocument, _data: object, _options: object, userId: string) => {
    if (userId !== game.user?.id || token.actorLink) return;
    const actor = game.actors?.get(token.actorId ?? "") as Actor | undefined;
    const kind = templateKind(actor);
    if (!kind || !actor) return;
    if (foundry.utils.getProperty(token, `flags.${MODULE_ID}.artworkSpawned`)) return;
    token.updateSource({delta: {img: token.texture.src}, flags: {[MODULE_ID]: {
      artworkSpawned: true, ...(kind === "mook" ? {CreatedByMookMaker: true} : {CreatedByVehicleTools: true, vehicleFootprint:{width:token.width??1,height:token.height??1}}),
    }}} as object);
  });
}
