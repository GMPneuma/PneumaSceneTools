import {MODULE_ID} from "./settings.js";
import {ensureSceneToolsFolder, findSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";
import {isTemplateActor} from "./mookmaker/folders.js";
import type {SpawnKind} from "./token-artwork.js";
import {armoredChassisData, ensureWorldChassis} from "./vehicle-chassis.js";
import {seatFlag, type SeatLayout} from "./vehicle-seats-model.js";

const DEFAULT_VEHICLE_IMAGE = `modules/${MODULE_ID}/assets/vehicle-outline.svg`;
const VEHICLE_TEMPLATE_DEFAULTS_FLAG = "carArtworkAndCleanBike";
declare global {
  interface FlagConfig {
    Folder: {"pneuma-scenetools": {carArtworkAndCleanBike?: boolean}};
  }
}

async function updateVehicleTemplateDefaults(folder: Folder): Promise<void> {
  if (foundry.utils.getProperty(folder, `flags.${MODULE_ID}.${VEHICLE_TEMPLATE_DEFAULTS_FLAG}`)) return;
  const templates = game.actors?.filter(actor => actor.folder?.id === folder.id) ?? [];
  for (const actor of templates) {
    const prototype = actor.prototypeToken;
    const previous = prototype.texture.src;
    const changes: Record<string, unknown> = {};
    if (actor.img !== DEFAULT_VEHICLE_IMAGE) changes.img = DEFAULT_VEHICLE_IMAGE;
    if (previous !== DEFAULT_VEHICLE_IMAGE) {
      changes["prototypeToken.texture.src"] = DEFAULT_VEHICLE_IMAGE;
      const layoutPath = `prototypeToken.flags.${MODULE_ID}`;
      const local = seatFlag(prototype, "vehicleSeats") as SeatLayout | undefined;
      const layouts = (seatFlag(prototype, "vehicleSeatLayouts") as SeatLayout[] | undefined) ?? [];
      const previousLayout = layouts.find(layout => layout.image === previous);
      const forCar = (layout: SeatLayout): SeatLayout => ({...layout, image: DEFAULT_VEHICLE_IMAGE, imageWidth: 200, imageHeight: 300});
      if (local && local.image === previous)
        changes[`${layoutPath}.vehicleSeats`] = forCar(local);
      if (previousLayout && !layouts.some(layout => layout.image === DEFAULT_VEHICLE_IMAGE))
        changes[`${layoutPath}.vehicleSeatLayouts`] = [...layouts, forCar(previousLayout)];
    }
    if (Object.keys(changes).length && !await actor.update(changes as object))
      throw new Error(`Could not update artwork on vehicle template ${actor.name}.`);
    if (actor.name.trim().toLocaleLowerCase() === "bike") {
      const statuses = actor.effects.filter(effect => effect.statuses.size > 0).map(effect => effect.id!);
      if (statuses.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", statuses);
        if (statuses.some(id => actor.effects.has(id))) throw new Error("Could not clear Bike template statuses.");
      }
    }
  }
  await folder.setFlag(MODULE_ID, VEHICLE_TEMPLATE_DEFAULTS_FLAG, true);
}

export async function ensureVehicleTemplate(): Promise<void> {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
  await ensureWorldChassis();
  const folder = await ensureSceneToolsFolder("Actor", WORLD_FOLDERS.vehicleTemplates);
  await updateVehicleTemplateDefaults(folder);
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
