import {HAZARD_ICON} from "./model.js";
import {MODULE_ID} from "../settings.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "../world-folders.js";

let templateCreation: Promise<Actor> | undefined;

/** Provision once per world; subsequent loads preserve the GM's edits. */
export async function ensureDefaultHazardTemplate(): Promise<Actor | undefined> {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
  const existing = game.actors?.find(actor => foundry.utils.getProperty(actor, `flags.${MODULE_ID}.defaultHazardTemplate`) === true);
  if (existing) return existing;
  if (templateCreation) return templateCreation;
  templateCreation = (async () => {
    const folder = await ensureSceneToolsFolder("Actor", WORLD_FOLDERS.hazardActorTemplates);
    const data = defaultHazardActorData();
    const [actor] = await Actor.createDocuments([{
      ...data, name: "Default Hazard Actor", folder: folder.id, ownership: {default: 0},
      flags: {[MODULE_ID]: {defaultHazardTemplate: true}},
      system: {derivedStats: {hp: {value: 10, max: 10}}},
      prototypeToken: {...data.prototypeToken, actorLink: false},
    }] as unknown as Actor.CreateData[], {keepEmbeddedIds: true});
    if (!actor) throw Error("Default Hazard Actor template creation was cancelled.");
    await (actor as Actor & {syncInstalledItems?: () => Promise<void>}).syncInstalledItems?.();
    return actor;
  })();
  try { return await templateCreation; } finally { templateCreation = undefined; }
}

/** Native CPR ammunition installation; each new Actor owns its own magazine and items. */
export function defaultHazardActorData() {
  const ammoId=foundry.utils.randomID();
  return {
    type:"mook",img:HAZARD_ICON,flags:{},prototypeToken:{texture:{src:HAZARD_ICON}},
    items:[{
      _id:foundry.utils.randomID(),name:"Handgun",type:"skill",
      img:"icons/svg/dice-target.svg",system:{level:0,stat:"ref",category:"rangedweaponSkills",difficulty:"typical"},
    },{
      _id:foundry.utils.randomID(),name:"Very Heavy Pistol",type:"weapon",
      img:"systems/cyberpunk-red-core/icons/compendium/weapons/veryHeavyPistol.svg",
      system:{equipped:"equipped",usage:"equipped",usesType:"magazine",quality:"standard",
        weaponType:"vHeavyPistol",weaponSkill:"Handgun",isRanged:true,damage:"4d6",rof:1,handsReq:1,
        ammoVariety:["vHeavyPistol"],dvTable:"DV Pistol",concealable:{concealable:false,isConcealed:false},
        fireModes:{autoFire:0,suppressiveFire:false},magazine:{max:200,value:200,ammoData:null},
        installedItems:{allowed:true,allowedTypes:["itemUpgrade","ammo"],list:[ammoId],slots:3,usedSlots:0}},
    },{
      _id:ammoId,name:"Very Heavy Pistol (Basic)",type:"ammo",
      img:"systems/cyberpunk-red-core/icons/compendium/ammo/pistolveryheavy_basic.png",
      // All 200 rounds are in the magazine; this installed item identifies the loaded ammunition.
      system:{type:"basic",variety:"vHeavyPistol",amount:0,ablationValue:1},
    }],
  };
}
