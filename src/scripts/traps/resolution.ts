import {executeHazardAttack} from "./combat-tools.js";
import {MODULE_ID} from "../settings.js";
import {type Hazard, gm, trapData, createHazardToken, removeHazardToken} from "./documents.js";
import {blankAction, type TrapAction, type ActionOf} from "./model.js";

export async function attackHazard(d: Hazard, token: TokenDocument, action: ActionOf<"attack">): Promise<{status: "started"; messageId: string} | {status: "cancelled" | "spent"}> {
  gm(); const t = trapData(d)!;
  const device = d.parent!.tokens.get(t.bodyId), weapon = device?.actor?.items.find(i => String(i.type) === "weapon" && (i.id === action.weapon || i.name === action.weapon));
  if (!device?.object || !token.object || !weapon) throw Error("The hazard actor or its configured native weapon is unavailable.");
  if (!(Number(foundry.utils.getProperty(device.actor!, "system.derivedStats.hp.value")) > 0)) throw Error("The selected attacking actor is destroyed.");
  const skill = foundry.utils.getProperty(weapon, "system.weaponSkill");
  if (typeof skill === "string" && skill && !device.actor!.items.some(item => String(item.type) === "skill" && item.name === skill))
    throw Error(`The hazard Actor is missing the native '${skill}' skill required by '${weapon.name}'. Add that skill to the Actor and its template before starting a new activation.`);
  try {return await executeHazardAttack(device.object, token.object, weapon.id!);}
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "HAZARD_ATTACK_SPENT") return {status: "spent"};
    throw error;
  }
}

export async function nativeRoll(actor: Actor, type: "skill" | "attack", item: Item): Promise<void> {
  const sheet = actor.sheet as ActorSheet & {_onRoll?(event: unknown): Promise<void>};
  if (!sheet?._onRoll) throw Error("This Actor does not provide the native CPR roll handler.");
  const control = document.createElement("a"); control.dataset.itemId = item.id!; control.dataset.rollType = type; control.dataset.rollTitle = item.name;
  await sheet._onRoll({currentTarget: control, target: control, type: "click", ctrlKey: false, metaKey: false, shiftKey: false});
}
export async function rollCheck(token: TokenDocument, skillName: string): Promise<void> {
  gm(); const item = token.actor?.items.find(i => String(i.type) === "skill" && (i.id === skillName || i.name.toLowerCase() === skillName.toLowerCase()));
  if (!item || !token.actor) throw Error(`No native skill named '${skillName}' on ${token.name}. Use its sheet to adjudicate the check.`);
  await nativeRoll(token.actor, "skill", item);
}
export async function rollAmount(formula: string, actor: Actor): Promise<number> {
  if (!formula || !Roll.validate(formula)) throw Error("Enter a valid dice formula.");
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({speaker: ChatMessage.getSpeaker({actor}), flavor: "Hazard effect", whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id!)});
  if (!Number.isFinite(roll.total)) throw Error("The roll did not produce a number.");
  return Math.max(0, Math.floor(roll.total!));
}
export async function applyAction(d: Hazard, token: TokenDocument, action: TrapAction, receipt: string, rolled?:number, conditionToken?:string): Promise<void> {
  gm(); const actor = token.actor, scene = d.parent!;
  if (!actor || !scene.tokens.has(token.id!)) throw Error("The target no longer exists.");
  if (action.kind === "notice") return;
  if(action.kind==="direct"){
    if(action.formula)await applyAction(d,token,{...action,kind:"damage"},receipt+":damage",rolled,conditionToken);
    for(const status of action.statuses)await applyAction(d,token,{...action,kind:"status",status},receipt+":"+status,undefined,conditionToken);
    if(action.moveReduction>0)await applyAction(d,token,{...action,kind:"movePenalty",formula:String(action.moveReduction)},receipt+":move",action.moveReduction,conditionToken);
    return;
  }
  if(action.kind==="spawnCondition"){
    if(action.actorTemplateId){
      const template=game.actors?.get(action.actorTemplateId);
      if(!template||!(Number(foundry.utils.getProperty(template,"system.derivedStats.hp.value"))>0))throw Error("Choose a template Actor with positive HP.");
      const effects=template.effects.filter(e=>!e.disabled).map(e=>e.toObject());
      const native=await template.getTokenDocument({x:token.x+(token.width??1)*scene.grid.size,y:token.y,elevation:token.elevation,hidden:token.hidden,width:0.5,height:0.5,actorLink:false,
        flags:{[MODULE_ID]:{artworkSpawned:true,hazardCondition:{region:d.uuid,target:token.uuid,receipt,templateActorId:template.id,retainWithoutEffects:!effects.length}}}} as object);
      const [instance]=(await scene.createEmbeddedDocuments("Token",[native.toObject()] as TokenDocument.CreateData[]))??[];
      if(!instance)throw Error("Condition instance creation was cancelled.");
      try{
        for(const effect of effects){
          const {_id,...data}=effect;
          const created=await actor.createEmbeddedDocuments("ActiveEffect",[{...data,origin:d.uuid,flags:{...data.flags,[MODULE_ID]:{trapEffect:{region:d.uuid,token:token.uuid,receipt,conditionToken:instance.uuid,untilExit:false,expires:null,endOnDamage:false}}}}] as unknown as ActiveEffect.CreateData[]);
          if(!created?.length)throw Error("Condition effect creation was cancelled.");
        }
      }catch(error){
        const ids=actor.effects.filter(e=>foundry.utils.getProperty(e,`flags.${MODULE_ID}.trapEffect.conditionToken`)===instance.uuid).map(e=>e.id!);
        if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
        await instance.delete();throw error;
      }
      return;
    }

    if(action.hp<=0||(!action.statuses.length&&!action.moveReduction))throw Error("Set condition HP and at least one condition effect.");
    const instance=await createHazardToken(scene,action.name||"Hazard condition",action.hp,{x:token.x+(token.width??1)*scene.grid.size,y:token.y,elevation:token.elevation,hidden:token.hidden,width:0.5,height:0.5},
      {hazardCondition:{region:d.uuid,target:token.uuid,receipt}});
    try{
      await applyAction(d,token,{...blankAction("direct"),...action,kind:"direct",formula:""},receipt,undefined,instance.uuid);
    }catch(error){
      const ids=actor.effects.filter(e=>foundry.utils.getProperty(e,`flags.${MODULE_ID}.trapEffect.conditionToken`)===instance.uuid).map(e=>e.id!);
      if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
      await removeHazardToken(instance);throw error;
    }
    return;
  }
  if (action.kind === "attack") {
    await attackHazard(d, token, action); return;
  }
  if (action.kind === "door") {
    if (!action.wallIds.length || action.wallIds.some(id => !scene.walls.get(id)?.door)) throw Error("Choose existing door walls.");
    await scene.updateEmbeddedDocuments("Wall", action.wallIds.map(_id => ({_id, ds: CONST.WALL_DOOR_STATES.CLOSED})) as WallDocument.UpdateData[]); return;
  }
  if (action.kind === "relocate") {if(action.elevation>=token.elevation)throw Error("The landing elevation must be below the target.");await token.update({elevation: action.elevation}); return;}
  if (action.kind === "damage") {
    const version = game.system!.version.replace(/^v/, "").split(".").map(Number);
    if ((version[0] ?? 0) === 0 && (version[1] ?? 0) < 92) throw Error("Hazard damage requires CPR 0.92 or later. Use the native sheet on older systems.");
    const native = actor as Actor & {_applyDamage?: (...args: unknown[]) => Promise<void>};
    if (!native._applyDamage) throw Error("Native CPR damage application is unavailable.");
    const total = rolled ?? await rollAmount(action.formula, actor);
    await native._applyDamage(total, 0, "body", action.armor === "ignore" ? 0 : action.ablation, "basic",
      action.armor === "ignore" ? 100 : action.armor === "half" ? 50 : 0, 0, true,
      {useShield: false, damageReductionRole: true, damageReductionAE: true, brainDamageReduction: true});
    return;
  }
  if (action.kind === "triggerHazard") throw Error("Linked hazards must resolve through their activation.");
  let data: Record<string, unknown>;
  if (action.kind === "movePenalty") {
    const reduction = rolled ?? await rollAmount(action.formula, actor);
    data = {name: action.name || "Hazard movement penalty", img: "icons/svg/net.svg", changes: [{key: "system.stats.move.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(-reduction), priority: 20}]};
  } else {
    const status = CONFIG.statusEffects.find(s => typeof s !== "string" && s.id === action.status);
    if (!status || typeof status === "string") throw Error("The configured native status is unavailable.");
    data = foundry.utils.deepClone(status) as unknown as Record<string, unknown>;
    delete data.id; delete data._id;
    data.statuses = [action.status];
  }
  data.origin = d.uuid;
  data.duration = action.seconds > 0 ? {seconds: action.seconds, startTime: game.time!.worldTime} : {};
  data.flags = {...(data.flags as object ?? {}), [MODULE_ID]: {trapEffect: {region: d.uuid, token: token.uuid, receipt, conditionToken:conditionToken??null, untilExit: action.untilExit,
    expires: action.seconds > 0 ? game.time!.worldTime + action.seconds : null, endOnDamage: action.endOnDamage}}};
  const created = await actor.createEmbeddedDocuments("ActiveEffect", [data] as unknown as ActiveEffect.CreateData[]);
  if (!created?.length) throw Error("Effect creation was cancelled.");
}
