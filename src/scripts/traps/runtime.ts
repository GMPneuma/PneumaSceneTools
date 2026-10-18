import {hazardsAvailable, HAZARD_DEPENDENCY_MESSAGE} from "./dependency.js";
import {MODULE_ID} from "../settings.js";
import {authority, triggerRegion, trapData, traps, syncAccessPoint, updateTrap,  cleanupHazardActor} from "./documents.js";
import {hasTrigger} from "./model.js";
import {activation, isActivationAction} from "./activation-state.js";
import {resolve} from "./activation.js";
import {enqueue} from "./queue.js";
import {cleanupEffects} from "./effect-cleanup.js";
import {eligible, proposeTargets, scanCamera, deviceMoved} from "./triggers.js";

// Preserve existing entry points while keeping implementation responsibilities separate.
export {activation} from "./activation-state.js";
export type {Activation} from "./activation-state.js";
export {card} from "./activation-card.js";
export {resolve, applyCombatEffect} from "./activation.js";
export {enqueue} from "./queue.js";
export {cleanupEffects} from "./effect-cleanup.js";
export {cameraSees, propose, regionEvent, registerBehavior, manualTrigger} from "./triggers.js";

const hitPoints = new Map<string, number>();
const currentScene=(scene:Scene|null|undefined):scene is Scene=>!!scene&&canvas.ready&&scene.id===canvas.scene?.id;
/** Persist deactivation for destroyed bodies, including unlinked token Actors. Healing never reactivates. */
async function disableDestroyedHazards(scene:Scene):Promise<void>{
  if(!authority()||!currentScene(scene))return;
  for(const d of traps(scene)){
    const t=trapData(d)!,body=scene.tokens.get(t.bodyId),hp=Number(foundry.utils.getProperty(body?.actor??{},"system.derivedStats.hp.value"));
    if(t.armed&&body?.actor&&Number.isFinite(hp)&&hp<=0)await updateTrap(d,{armed:false});
  }
}
// Coalesce maintenance only; player actions and damage events retain their ordering.
const pendingMaintenance = new Map<Scene, {destroyed: boolean; scan: boolean}>();
function maintain(scene: Scene, destroyed = false, scan = true): void {
  if (!authority()||!currentScene(scene)) return;
  const pending = pendingMaintenance.get(scene);
  if (pending) {pending.destroyed ||= destroyed; pending.scan ||= scan; return;}
  const work = {destroyed, scan};pendingMaintenance.set(scene, work);
  void enqueue(async () => {
    pendingMaintenance.delete(scene);
    if (!authority()||!currentScene(scene)) return;
    if (work.destroyed) await disableDestroyedHazards(scene);
    await cleanupEffects(scene);
    if (work.scan && scene.id === canvas.scene?.id) for (const d of traps(scene)) await scanCamera(d);
  });
}
function actorScenes(actor: Actor): Scene[] {
  return (currentScene(canvas.scene)?[canvas.scene]:[]).filter(scene =>
    scene.tokens.some(token => token.actor === actor || token.actor?.uuid === actor.uuid || (!actor.isToken && token.actorId === actor.id)));
}
export function registerRuntime():void {
  Hooks.on("renderChatMessage",(message:ChatMessage,html:JQuery)=>{
    if (!activation(message)) return;
    html.find("[data-trap-message]").on("click",event=>{
      event.preventDefault();
      const id=(event.currentTarget as HTMLElement).dataset.trapMessage!;
      ui.sidebar?.activateTab("chat");
      const target=Array.from(document.querySelectorAll<HTMLElement>('#chat-log [data-message-id]')).find(element=>element.dataset.messageId===id);
      if(!target){ui.notifications?.warn("That card is not loaded in chat. Scroll up in chat to load earlier messages.");return;}
      target.scrollIntoView({behavior:"smooth",block:"center"});
      target.animate([{outline:"2px solid currentColor"},{outline:"2px solid transparent"}],{duration:1500});
    });
    if (!hazardsAvailable()) {html.find("[data-trap-action]").prop("disabled",true).attr("title",HAZARD_DEPENDENCY_MESSAGE);return;}
    html.find("[data-trap-action]").prop("disabled",!authority()).on("click",event=>{
      event.preventDefault(); const action=(event.currentTarget as HTMLElement).dataset.trapAction!;
      if (!isActivationAction(action)) return;
      const revision=activation(message)!.revision;
      html.find("[data-trap-action]").prop("disabled",true);
      enqueue(async()=>{try{await resolve(message,action,revision);}finally{ui.chat?.updateMessage(message);}});
    });
  });
  if (!hazardsAvailable()) return;
  Hooks.on("canvasReady",()=>{
    hitPoints.clear();
    for (const token of canvas.scene?.tokens??[]) {if(token.actor)hitPoints.set(token.actor.uuid,Number(foundry.utils.getProperty(token.actor,"system.derivedStats.hp.value")));}
    if(canvas.scene)maintain(canvas.scene,true);
  });
  Hooks.on("createToken",(token:TokenDocument)=>{if(token.actor)hitPoints.set(token.actor.uuid,Number(foundry.utils.getProperty(token.actor,"system.derivedStats.hp.value")));enqueue(async()=>{
    if(!authority()||!currentScene(token.parent))return;
    for(const d of traps(token.parent)){const t=trapData(d)!;

      if(hasTrigger(t,"detect"))await scanCamera(d);
    }
  });});
  Hooks.on("updateToken",(token:TokenDocument,change:Record<string,unknown>)=>{
    if(!currentScene(token.parent))return;
    if (["x","y","elevation","rotation","hidden","width","height"].some(k=>k in change)) enqueue(async()=>{if(currentScene(token.parent))await deviceMoved(token);});
    // Membership also changes for plain effect-area Regions with no trap behavior.
    if (("_regions" in change||"delta" in change||Object.keys(change).some(k=>k.startsWith("delta."))) && token.parent) maintain(token.parent,true,false);
  });
  Hooks.on("deleteToken",(token:TokenDocument)=>{enqueue(async()=>{
    if (!authority() || !currentScene(token.parent))return;
    if(token.actor){const ids=token.actor.effects.filter(e=>foundry.utils.getProperty(e,`flags.${MODULE_ID}.trapEffect.token`)===token.uuid).map(e=>e.id!);if(ids.length)await token.actor.deleteEmbeddedDocuments("ActiveEffect",ids);}
    for(const d of traps(token.parent)){const t=trapData(d)!;if(t.bodyId===token.id){await updateTrap(d,{armed:false});await syncAccessPoint(d);}}
    await cleanupEffects(token.parent);await cleanupHazardActor(token);
  });});
  Hooks.on("updateCombat",(combat:Combat,change:Record<string,unknown>)=>{
    if (!("turn" in change || "round" in change) || !currentScene(combat.scene))return;
    const scene=combat.scene,current=combat.combatant?.tokenId;
    const event=`Combat.${combat.id}.${combat.round}.${combat.turn}`;
    enqueue(async()=>{if(!authority()||!currentScene(scene))return;
      for(const d of traps(scene)){
        const t=trapData(d)!;
        if(hasTrigger(t,"detect"))await scanCamera(d);
        if(current===t.bodyId&&hasTrigger(t,"deviceTurn")){
          for(const target of triggerRegion(d,t)?.tokens??[])if(eligible(t,target)&&Number(foundry.utils.getProperty(target.actor??{},"system.derivedStats.hp.value"))>0)await proposeTargets(d,target,event+".deviceTurn");
        }
      }
      await cleanupEffects(scene);
    });
  });
  Hooks.on("updateWorldTime",()=>{if(canvas.scene)maintain(canvas.scene);});
  for(const hook of ["createWall","updateWall","deleteWall"])Hooks.on(hook,(wall:WallDocument)=>{
    if(wall.parent?.id===canvas.scene?.id)maintain(wall.parent!);
  });
  Hooks.on("updateScene",(scene:Scene,change:Record<string,unknown>)=>{
    if(scene.id===canvas.scene?.id && Object.keys(change).some(key=>["globalLight","globalLightThreshold","darkness","grid","width","height","padding"].includes(key.split(".")[0]!)))maintain(scene);
  });
  Hooks.on("updateActor",(actor:Actor,change:Record<string,unknown>={})=>{
    const old=hitPoints.get(actor.uuid),next=Number(foundry.utils.getProperty(actor,"system.derivedStats.hp.value"));hitPoints.set(actor.uuid,next);
    if(Object.is(old,next) && !Object.keys(change).some(key=>key==="ownership" || key.startsWith("ownership.")))return;
    if(old===undefined && !Number.isFinite(next))return;
    if(old!==undefined&&next<old)void enqueue(async()=>{
      if(!authority())return;
      const ids=actor.effects.filter(e=>foundry.utils.getProperty(e,`flags.${MODULE_ID}.trapEffect.endOnDamage`)===true).map(e=>e.id!);
      if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
    });
    for(const scene of actorScenes(actor))maintain(scene,true);
  });
  Hooks.on("deleteActiveEffect",(effect:ActiveEffect)=>{
    if(!foundry.utils.getProperty(effect,`flags.${MODULE_ID}.trapEffect`))return;
    const actor=effect.parent;
    if(actor?.documentName === "Actor")for(const scene of actorScenes(actor))maintain(scene,false,false);
  });
  Hooks.on("deleteActor",(actor:Actor)=>{hitPoints.delete(actor.uuid);for(const scene of actorScenes(actor))maintain(scene,false,false);});
  Hooks.on("ready",()=>{if(!currentScene(canvas.scene))return;for(const token of canvas.scene.tokens){if(token.actor)hitPoints.set(token.actor.uuid,Number(foundry.utils.getProperty(token.actor,"system.derivedStats.hp.value")));}maintain(canvas.scene,true);});
  Hooks.on("canvasTearDown",()=>{hitPoints.clear();});
  for(const hook of ["updateUser","userConnected"])Hooks.on(hook,()=>{if(game.user?.isGM)for(const message of game.messages??[]){const a=activation(message);if(a&&!["done","skipped"].includes(a.state))ui.chat?.updateMessage(message);}});
  Hooks.on("deleteRegion",(region:RegionDocument)=>enqueue(async()=>{
    if(authority() && currentScene(region.parent))await cleanupEffects(region.parent);

  }));
}
