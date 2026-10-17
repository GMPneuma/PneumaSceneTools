import { MODULE_ID } from "../settings.js";
import { accessPointTypes } from "../netarch/types.js";
import { triggerRegion, findHazard, type Hazard } from "./records.js";
import { hazardActorTemplates } from "./actors.js";
import { hasTrigger, type TrapConfig } from "./model.js";
export interface HazardIssue {
  message: string;
  field: string;
  effectIndex?: number;
}
/** Structural validation permits drafts; readiness is checked again at activation time. */
export function validateHazardReadiness(t: TrapConfig, d: Hazard): HazardIssue[] {
  const scene = d.parent!, issues: HazardIssue[] = [];
  const issue = (message: string, field: string, effectIndex?: number) => { issues.push({ message, field, effectIndex }); };
  if (!t.name.trim())
    issue("Enter a name.", "name");
  if (!t.hazardActorTemplateId && !scene.tokens.get(t.bodyId)?.actor)
    issue("Save to create the hazard Actor.", "tokenIcon");
  if (t.hazardActorTemplateId && !hazardActorTemplates().some(a => a.id === t.hazardActorTemplateId))
    issue("Choose an available Hazard Actor template.", "hazardActorTemplateId");
  if (t.hazardActorTemplateId && scene.tokens.get(t.bodyId)?.actor && foundry.utils.getProperty(scene.tokens.get(t.bodyId)!, `flags.${MODULE_ID}.hazardActorTemplateId`) !== t.hazardActorTemplateId)
    issue("Save to replace the hazard actor with the selected template.", "hazardActorTemplateId");
  if ((t.hazardActorTemplateId || t.hp > 0) && (!t.bodyId || !scene.tokens.get(t.bodyId)?.actor))
    issue("Save to create the hazard actor.", "hazardActorTemplateId");
  const trigger = triggerRegion(d, t);
  if (!trigger)
    issue("Trigger Region is missing. Save to create a blank replacement Region.", "triggerRegionId");
  else if (!trigger.shapes.length)
    issue("Draw the trigger area using native Region controls.", "triggerRegionId");
  const body = scene.tokens.get(t.bodyId);
  if (body?.actor && !(Number(foundry.utils.getProperty(body.actor, "system.derivedStats.hp.value")) > 0))
    issue("Restore the hazard Actor to positive HP before activation.", "hazardActorTemplateId");
  if (hasTrigger(t, "deviceTurn") && !scene.tokens.get(t.bodyId)?.actor)
    issue("Save to create this hazard's turn actor.", "hazardActorTemplateId");
  if (hasTrigger(t, "detect") && (!scene.tokens.get(t.deviceId)?.actor || t.range <= 0))
    issue("Configure the camera actor and detection range.", "deviceId");
  if (!t.actions.length)
    issue("Add an effect.", "actions");
  if (t.apType && !accessPointTypes().some(a => a.id === t.apType))
    issue("Choose an available access point type.", "apType");
  for (const [i, a] of t.actions.entries()) {
    const prefix = `Effect ${i + 1}: `;
    if (a.kind === "triggerHazard" && (!a.hazardId || a.hazardId === d.id || !findHazard(scene, a.hazardId)))
      issue(prefix + "choose another hazard.", "hazardId", i);
    if (a.kind === "attack") {
      const actor = scene.tokens.get(t.bodyId)?.actor;
      if (!actor)
        issue(prefix + "choose an attacking actor.", "hazardActorTemplateId", i);
      else if (!actor.items.some(item => String(item.type) === "weapon" && (item.id === a.weapon || item.name === a.weapon)))
        issue(prefix + "choose its weapon.", "weapon", i);
    }
    if (a.kind === "damage" && !a.formula)
      issue(prefix + "choose damage dice.", "formula", i);
    if (a.kind === "movePenalty" && (!a.formula && !a.moveReduction || a.formula && Number.isFinite(Number(a.formula)) && Number(a.formula) <= 0))
      issue(prefix + "set a MOVE penalty.", "formula", i);
    if (a.kind === "status" && !CONFIG.statusEffects.some(s => typeof s !== "string" && s.id === a.status))
      issue(prefix + "choose a status effect.", "status", i);
    if (a.kind === "spawnCondition") {
      const template = game.actors?.get(a.actorTemplateId);
      if (a.actorTemplateId ? !template || !["mook", "character"].includes(String(template.type)) || !(Number(foundry.utils.getProperty(template, "system.derivedStats.hp.value")) > 0) : a.hp <= 0 || (!a.statuses.length && !a.moveReduction))
        issue(prefix + "choose a template Actor with positive HP.", "actorTemplateId", i);
    }
  }
  return issues;
}
/** Retain the existing message-only interface for runtime callers and macros. */
export function hazardIssues(t: TrapConfig, d: Hazard, report?: (message: string, field: string, effectIndex?: number) => void): string[] {
  return validateHazardReadiness(t, d).map(issue => {
    report?.(issue.message, issue.field, issue.effectIndex);
    return issue.message;
  });
}
