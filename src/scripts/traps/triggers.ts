import {MODULE_ID} from "../settings.js";
import {requireHazards} from "./dependency.js";
import {isAP} from "../netarch/model.js";
import {type Hazard, authority, center, triggerRegion, effectRegion, operational, regionBehaviorEnabled, TRAP_BEHAVIOR, trapData, traps, syncAccessPoint, updateTrap} from "./documents.js";
import {hasTrigger, type TrapConfig} from "./model.js";
import {activation, type Activation} from "./activation-state.js";
import {card} from "./activation-card.js";
import {enqueue} from "./queue.js";
import {cleanupEffects} from "./effect-cleanup.js";
export function eligible(t: TrapConfig, target: TokenDocument): boolean {
  if (!target.actor || isAP(target) || target.id === t.bodyId || target.id === t.deviceId || foundry.utils.getProperty(target, `flags.${MODULE_ID}.hazardBody`) || foundry.utils.getProperty(target, `flags.${MODULE_ID}.hazardCondition`))
    return false;
  return t.targets === "all" || target.actor.hasPlayerOwner;
}
export function cameraSees(d: Hazard, target: TokenDocument, point = center(target)): boolean {
  const t = trapData(d)!, scene = d.parent!, source = scene.tokens.get(t.deviceId);
  if (!source || target.elevation < (d.elevation.bottom ?? -Infinity) || target.elevation > (d.elevation.top ?? Infinity) || scene.id !== canvas.scene?.id)
    return false;
  const origin = center(source), radius = t.range * scene.grid.size / scene.grid.distance;
  const distance = Math.hypot(point.x - origin.x, point.y - origin.y, (target.elevation - source.elevation) * scene.grid.size / scene.grid.distance);
  if (distance > radius)
    return false;
  if (t.walls && CONFIG.Canvas.polygonBackends.sight.testCollision(origin, point, {type: "sight", mode: "any"}))
    return false;
  if (!t.darkness && !scene.globalLight) {
    const light = canvas.effects?.lightSources;
    if (!light || !Array.from(light.values()).some(source => source.active && source.shape.contains(point.x, point.y)))
      return false;
  }
  return true;
}
export async function propose(d: Hazard, target: TokenDocument, event: string, chain: string[] = [], batch = foundry.utils.randomID()): Promise<void> {
  if (!authority() || !operational(d))
    return;
  const t = trapData(d)!;
  if (chain.includes(d.uuid) || chain.length >= 100 || !eligible(t, target))
    return;
  const existing = game.messages!.some(m => {
    const a = activation(m);
    return a?.region === d.uuid && a.target === target.uuid
      && (!["done", "skipped"].includes(a.state) || a.event === event && event.startsWith("Combat."));
  });
  if (existing)
    return;
  const a: Activation = {region: d.uuid, target: target.uuid, event, kind: "trap", state: "pending", index: 0, config: structuredClone(t), chain: [...chain, d.uuid], error: "", batch, targetName: target.name, rolled: null, revision: 0};
  await ChatMessage.create({
    content: card(a), whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id!),
    speaker: {alias: "Scene Tools · Hazards"}, flags: {[MODULE_ID]: {trapActivation: a}}
  } as unknown as ChatMessage.CreateData);
}
export async function proposeTargets(d: Hazard, target: TokenDocument, event: string, chain: string[] = []): Promise<void> {
  const t = trapData(d)!, area = effectRegion(d, t);
  if (!area)
    throw Error("The affected Region no longer exists.");
  const targets = t.targetMode === "region" ? Array.from(area.tokens) : [target];
  const batch = foundry.utils.randomID();
  for (const token of targets)
    await propose(d, token, event, chain, batch);
}
/** Consume native Region membership and movement segments; Foundry handles shape holes and elevation. */
export async function regionEvent(event: RegionDocument.RegionEvent, behaviorId?: string): Promise<void> {
  const region = event.region;
  if (!authority() || !regionBehaviorEnabled(region))
    return;
  if (behaviorId && region.behaviors.find(b => String(b.type) === TRAP_BEHAVIOR && !b.disabled)?.id !== behaviorId)
    return;
  if (event.name === CONST.REGION_EVENTS.TOKEN_EXIT) {
    await cleanupEffects(region.parent!);
    return;
  }
  for (const d of traps(region.parent!))
    if (triggerRegion(d)?.id === region.id)
      await hazardRegionEvent(d, event);
}
async function hazardRegionEvent(d: Hazard, event: RegionDocument.RegionEvent): Promise<void> {
  const t = trapData(d)!, region = event.region;
  const data = event.data as {
    token?: TokenDocument;
    teleport?: boolean;
    segments?: Region.MovementSegment[];
    combatant?: Combatant;
  };
  const token = data.token;
  if (!token)
    return;
  if (event.name === CONST.REGION_EVENTS.TOKEN_EXIT) {
    await cleanupEffects(d.parent!);
    return;
  }
  if (!operational(d) || !eligible(t, token))
    return;
  if (hasTrigger(t, "enter") && (event.name === CONST.REGION_EVENTS.TOKEN_ENTER || event.name === CONST.REGION_EVENTS.TOKEN_MOVE && !data.teleport && data.segments?.some(s => s.type === 1)))
    await proposeTargets(d, token, "Entered hazard Region");
  if (hasTrigger(t, "move") && event.name === CONST.REGION_EVENTS.TOKEN_MOVE && !data.teleport) {
    const grid = d.parent!.grid;
    if (!("measurePath" in grid))
      throw Error("Native Region movement measurement is unavailable.");
    const moved = (data.segments ?? []).filter(s => s.type === 0).reduce((n, s) => n + grid.measurePath([s.from, s.to], {}).distance, 0);
    const startsInside = data.segments?.[0]?.type === 0;
    const distance = (startsInside ? t.moveProgress[token.id!] ?? 0 : 0) + moved;
    if (moved > 0 && (t.distance === 0 || distance >= t.distance))
      await proposeTargets(d, token, "Movement inside hazard Region");
    await updateTrap(d, {[`moveProgress.${token.id}`]: region.tokens.has(token) && t.distance > 0 ? distance % t.distance : 0});
  }
  if (hasTrigger(t, "turnStart") && event.name === CONST.REGION_EVENTS.TOKEN_TURN_START && region.tokens.has(token)) {
    const combat = data.combatant?.parent;
    await proposeTargets(d, token, `Combat.${combat?.id}.${combat?.round}.${combat?.turn}.turnStart`);
  }
  if (hasTrigger(t, "turnEnd") && event.name === CONST.REGION_EVENTS.TOKEN_TURN_END) {
    const combat = data.combatant?.parent;
    await proposeTargets(d, token, `Combat.${combat?.id}.${combat?.round}.${combat?.turn}.turnEnd`);
  }
}
export function registerBehavior(): void {
  class TrapBehavior extends foundry.data.regionBehaviors.RegionBehaviorType<{}> {
    static override defineSchema() {return {};}
    static override events = Object.fromEntries([
      CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT, CONST.REGION_EVENTS.TOKEN_MOVE,
      CONST.REGION_EVENTS.TOKEN_TURN_START, CONST.REGION_EVENTS.TOKEN_TURN_END
    ].map(name => [name, async function(this: TrapBehavior, event: RegionDocument.RegionEvent) {await enqueue(() => regionEvent(event, this.behavior?.id ?? undefined));}]));
  }
  const config = CONFIG as unknown as {
    RegionBehavior: {
      dataModels: Record<string, unknown>;
    };
  };
  config.RegionBehavior.dataModels[TRAP_BEHAVIOR] = TrapBehavior;
}
export async function deviceMoved(token: TokenDocument): Promise<void> {
  if (!authority() || !token.parent)
    return;
  for (const instance of token.parent.tokens) {
    if (foundry.utils.getProperty(instance, `flags.${MODULE_ID}.hazardCondition.target`) === token.uuid)
      await instance.update({x: token.x + (token.width ?? 1) * token.parent.grid.size, y: token.y, elevation: token.elevation, hidden: token.hidden});
  }
  for (const d of traps(token.parent)) {
    const t = trapData(d)!;
    if (t.bodyId === token.id) {
      await updateTrap(d, {anchor: center(token)});
      await syncAccessPoint(d);
    }
    await scanCamera(d);
  }
}
export async function scanCamera(d: Hazard): Promise<void> {
  if (!hasTrigger(trapData(d)!, "detect"))
    return;
  if (!operational(d)) {
    if (trapData(d)!.detected.length)
      await updateTrap(d, {detected: []});
    return;
  }
  const t = trapData(d)!, seen = d.parent!.tokens.filter(target => eligible(t, target) && cameraSees(d, target));
  for (const target of seen)
    if (!t.detected.includes(target.id!))
      await proposeTargets(d, target, "Camera detected target");
  const ids = seen.map(t => t.id!);
  if (JSON.stringify(ids) !== JSON.stringify(t.detected))
    await updateTrap(d, {detected: ids});
}
export async function manualTrigger(d: Hazard, tokens: TokenDocument[]): Promise<void> {
  requireHazards();
  if (!authority())
    throw Error("Use the active GM client to trigger hazards.");
  if (!operational(d))
    throw Error("Complete and activate the hazard before triggering it.");
  if (!tokens.length)
    throw Error("Select target tokens first.");
  for (const token of tokens)
    await proposeTargets(d, token, "Manual trigger");
}
