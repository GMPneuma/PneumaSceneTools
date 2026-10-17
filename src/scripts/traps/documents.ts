import {hazardsAvailable} from "./dependency.js";
import {MODULE_ID} from "../settings.js";
import {blankTrap, portableTrap, validateTrap, validateDevice, type TrapConfig} from "./model.js";
import {gm, sceneHazard, hazardForRegion, trapData, updateTrap, center, triggerRegion, regionPosition, TRAP_BEHAVIOR, type Hazard} from "./records.js";
import {createTemplateHazardActor, setHazardHP, removeHazardToken, deleteUnusedHazardActor, intact} from "./actors.js";
import {syncAccessPoint} from "./access-points.js";
import {hazardIssues} from "./readiness.js";

// Existing entry points remain available to integrations. Save and rollback orchestration stays here.
export * from "./records.js";
export {hazardActorFolder, hazardActorTemplates, createDevice, setHazardHP, createHazardToken, removeHazardToken, cleanupHazardActor, intact} from "./actors.js";
export {syncAccessPoint, createHazardAccessPoint} from "./access-points.js";
export {hazardIssues} from "./readiness.js";

declare global {interface SettingConfig {"pneuma-scenetools.trapPresets": {presets: TrapConfig[]}}}
/** Locate the physical hazard even when its trigger Region has not been drawn. */
export async function setHazardRegionVisibility(d:Hazard,visibility:number):Promise<void>{
  gm();const nativeVisibility=[CONST.REGION_VISIBILITY.LAYER,CONST.REGION_VISIBILITY.GAMEMASTER,CONST.REGION_VISIBILITY.ALWAYS].find(value=>value===visibility);if(nativeVisibility===undefined)throw Error("Invalid Region visibility.");
  const region=triggerRegion(d);if(!region)throw Error("Save the hazard to create its trigger Region.");
  await region.update({visibility:nativeVisibility});if(region.visibility!==visibility)throw Error("Region visibility update was cancelled.");
}
export async function locateHazard(d:Hazard):Promise<void>{
  gm();if(canvas.scene?.id!==d.parent?.id)throw Error("View the hazard's scene before locating it.");
  const t=trapData(d);if(!t)throw Error("Hazard no longer exists.");
  const body=d.parent!.tokens.get(t.bodyId);
  if(body){
    const token=canvas.tokens?.get(body.id!);canvas.tokens?.activate();
    const controlOptions:Token.ControlOptions={releaseOthers:true,pan:false};token?.control(controlOptions);
    await canvas.animatePan(center(body));return;
  }
  const region=triggerRegion(d,t);
  if(!region?.shapes.length)throw Error("This hazard has no Actor or drawn trigger Region to locate. Save the hazard to create its Actor.");
  const object=canvas.regions?.get(region.id!);
  if(!object)throw Error("The hazard Region is not available on the current canvas.");
  canvas.regions?.activate();object.control({releaseOthers:true});await canvas.animatePan(regionPosition(region));
}
export async function ensureBehavior(d:RegionDocument):Promise<void>{
  if(d.behaviors.some(b=>String(b.type)===TRAP_BEHAVIOR))return;
  const created=await d.createEmbeddedDocuments("RegionBehavior",[{name:"Scene Tools Hazard",type:TRAP_BEHAVIOR,system:{}}] as never);
  if(!created?.length)throw Error("Hazard behavior creation was cancelled.");
}
/** Native Region controls create a Scene record and bind it to the existing geometry. */
export async function ensureRegionHazard(region:RegionDocument):Promise<Hazard>{
  gm();
  if(region.parent?.regions.get(region.id!)!==region)throw Error("This Region no longer exists.");
  let hazard=hazardForRegion(region);
  if(!hazard){
    hazard=sceneHazard(region.parent,foundry.utils.randomID());
    await updateTrap(hazard,{...blankTrap(),name:region.name||"New hazard",triggerRegionId:region.id});
  }
  await ensureBehavior(region);
  return hazard;
}
export const regionBehaviorEnabled=(d:RegionDocument)=>d.behaviors.some(b=>String(b.type)===TRAP_BEHAVIOR&&!b.disabled);
export function behaviorEnabled(d:Hazard):boolean {const region=triggerRegion(d);return !!region&&regionBehaviorEnabled(region);}
export function operational(d: Hazard): boolean {
  if (!hazardsAvailable()) return false;
  const t = trapData(d); if (!behaviorEnabled(d) || !t?.armed) return false;
  const region=triggerRegion(d,t);
  return !!region && intact(d) && !hazardIssues(t,d).length;
}
export async function saveTrap(d: Hazard, value: TrapConfig): Promise<void> {
  gm(); const t = validateTrap(value), scene = d.parent;
  if (game.scenes?.get(scene.id!) !== scene) throw Error("This scene no longer exists.");
  const current=trapData(d);
  if(current){
    t.triggerRegionId=current.triggerRegionId;
    t.moveProgress=current.moveProgress;t.engaged=current.engaged;
    t.detected=!current.armed&&t.armed?[]:current.detected;
    if(t.deviceId===current.deviceId)t.anchor=current.anchor;
  }
  if(t.triggerRegionId && !scene.regions.has(t.triggerRegionId))throw Error("The saved Trigger Region no longer exists. Delete this hazard and create a new one.");
  const oldBody=scene.tokens.get(current?.bodyId??"");
  if(current?.bodyId && !oldBody?.actor)throw Error("The saved Hazard Actor no longer exists. Delete this hazard and create a new one.");
  await updateTrap(d,{...t,armed:false});
  if(!t.triggerRegionId){
    const [region]=(await scene.createEmbeddedDocuments("Region",[{name:`${t.name||"Untitled hazard"}-Tigger`,visibility:CONST.REGION_VISIBILITY.GAMEMASTER,shapes:[]}] as unknown as RegionDocument.CreateData[]))??[];
    if(!region)throw Error("Automatic Trigger Region creation was cancelled. The hazard draft is saved.");
    try{await updateTrap(d,{triggerRegionId:region.id});}
    catch(error){await region.delete();if(scene.regions.has(region.id!))throw Error("Trigger Region setup failed and cleanup was cancelled. Check the scene before saving again.");throw error;}
    t.triggerRegionId=region.id!;
  }
  const trigger=triggerRegion(d,t);if(trigger)await ensureBehavior(trigger);
  // Only the saved body reference identifies this hazard's Actor.
  const sameTemplate=(foundry.utils.getProperty(oldBody??{},`flags.${MODULE_ID}.hazardActorTemplateId`)??"")===t.hazardActorTemplateId;
  const body=oldBody?.actor&&sameTemplate?oldBody:undefined;
  let created:TokenDocument|undefined;
  if(body){t.bodyId=body.id!;t.anchor=center(body);}
  else {
    created=await createTemplateHazardActor(d,t,oldBody);t.bodyId=created.id!;t.anchor=center(created);
    t.hp=Number(foundry.utils.getProperty(created.actor!,"system.derivedStats.hp.max"));
  }
  const previousHP=body?.actor?foundry.utils.deepClone(foundry.utils.getProperty(body.actor,"system.derivedStats.hp")):undefined;
  const changeHP=!t.hazardActorTemplateId&&!!body&&t.hp>0&&current?.hp!==t.hp;
  if(changeHP)await setHazardHP(body!,t.hp);
  if(hazardIssues(t,d).length)t.armed=false;
  try{await updateTrap(d,{...t});}
  catch(error){if(created)await removeHazardToken(created);if(changeHP&&body?.actor)await body.actor.update({"system.derivedStats.hp":previousHP} as object);throw error;}
  const token=scene.tokens.get(t.bodyId),actor=token&&game.actors?.get(token.actorId!);
  if(token)await token.update({"texture.src":t.tokenIcon} as object);
  if(actor&&foundry.utils.getProperty(actor,`flags.${MODULE_ID}.hazardOwned`))await actor.update({img:t.tokenIcon,"prototypeToken.texture.src":t.tokenIcon} as object);
  await syncAccessPoint(d);
  if(created&&oldBody&&oldBody.id!==created.id)await removeHazardToken(oldBody);
}
export function presets(): TrapConfig[] {return game.settings!.get(MODULE_ID, "trapPresets").presets;}
export async function savePreset(t: TrapConfig,actor?:Actor|null): Promise<void> {
  gm(); const saved = presets().filter(p => p.name !== t.name);
  if (saved.length >= 200) throw Error("The world already has 200 hazard presets.");
  const preset=portableTrap(t);
  if(actor){const data=actor.toObject();preset.deviceTemplate=validateDevice({name:data.name,type:data.type,img:data.img,system:data.system,items:data.items});}
  await game.settings!.set(MODULE_ID, "trapPresets", {presets: [...saved, preset]});
}
export function hazardDeletionDocuments(d:Hazard,draftAPId=""):{regions:RegionDocument[];aps:TokenDocument[];bodies:TokenDocument[]}{
  const t=trapData(d),scene=d.parent!;
  if(!t)return {regions:[],aps:[],bodies:[]};
  const regions=scene.regions.filter(region=>region.id===triggerRegion(d,t)?.id);
  const aps=scene.tokens.filter(token=>token.id===t?.apId||token.id===draftAPId);
  const bodies=scene.tokens.filter(token=>token.id===t?.bodyId);
  return {regions,aps,bodies};
}
/** Keep the disarmed record until all linked document deletions succeed, so failures can be retried. */
export async function deleteHazard(d:Hazard,draftAPId=""):Promise<void>{
  gm();const scene=d.parent!;if(!trapData(d))return;
  await updateTrap(d,{armed:false});
  const {regions,aps,bodies}=hazardDeletionDocuments(d,draftAPId);
  for(const ap of aps){await ap.delete();if(scene.tokens.has(ap.id!))throw Error("Hazard access point deletion was cancelled.");}
  for(const body of bodies){
    if(scene.tokens.has(body.id!))await removeHazardToken(body);
  }
  for(const actor of game.actors??[])if(foundry.utils.getProperty(actor,`flags.${MODULE_ID}.hazardOwned`)&&foundry.utils.getProperty(actor,`flags.${MODULE_ID}.hazardSource`)===d.uuid)await deleteUnusedHazardActor(actor);
  for(const region of regions){await region.delete();if(scene.regions.has(region.id!))throw Error("Hazard trigger Region deletion was cancelled.");}
  await scene.update({[`flags.${MODULE_ID}.hazards.-=${d.id}`]:null} as Scene.UpdateData);
  if(d.config)throw Error("Hazard record deletion was cancelled.");
}
