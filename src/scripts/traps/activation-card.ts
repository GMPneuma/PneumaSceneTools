import {actionFormula} from "./model.js";
import {escapeHTML as esc} from "../netarch/model.js";
import type {TrapAction} from "./model.js";
import type {Activation} from "./activation-state.js";
function button(action: string, label: string): string {return `<button type="button" data-trap-action="${action}">${esc(label)}</button>`;}
function messageLink(id:string,label:string):string {return `<button type="button" class="pneuma-chat-button" data-chat-role="player" data-trap-message="${esc(id)}"><i class="fas fa-comments" aria-hidden="true"></i> ${esc(label)}</button>`;}
export function effectLabel(effect: TrapAction): string {
  if (effect.name)
    return effect.name;
  if (effect.kind === "status") {
    const status = CONFIG.statusEffects.find(s => typeof s !== "string" && s.id === effect.status);
    return status && typeof status !== "string" ? game.i18n!.localize(status.name ?? effect.status) : effect.status;
  }
  if (effect.kind === "spawnCondition")
    return `Condition instance${effect.actorTemplateId ? ": " + (game.actors?.get(effect.actorTemplateId)?.name ?? "Missing template") : ""}`;
  return ({damage: "Direct Damage", direct: "Direct effect", movePenalty: "MOVE Penalty"} as Record<string, string>)[effect.kind] ?? effect.kind;
}
export function card(a: Activation): string {
  const current = a.config.actions[a.index];
  const avoidance = a.config.hazardType !== "notification" && !!a.config.check;
  let controls = "";
  if (a.state === "pending")
    controls = (avoidance ? button("roll", `Roll ${a.config.check} (DV ${a.config.dv})`) + button("skip", "Check passed / exempt") : "")
      + button("approve", avoidance ? "Check failed — trigger" : "Confirm trigger") + button("skip", "Dismiss");
  if (a.state === "ready")
    controls = button("apply", `${current && ["damage", "direct", "status", "movePenalty"].includes(current.kind) ? "Resolve:" : "Resolve"} ${current ? effectLabel(current) : "effect"}`) + button("omit", "Skip this effect") + button("skip", "End activation");
  if (a.state === "ready" && a.effectCard?.index === a.index)
    controls = `<p>Resolve this effect on its chat card.</p>${messageLink(a.effectCard.id,"View effect in chat")}` + button("omit", "Skip this effect") + button("skip", "End activation");
  if (a.state === "review" || a.state === "applying")
    controls = button("omit", "Reviewed — advance without repeating") + button("skip", "End activation");
  return `<section class="pneuma-trap-card"><h3>${esc(a.config.name)}</h3><p>Target: ${esc(a.targetName)}</p><p>${esc(a.event)} · ${esc(a.state)}</p>
    <p>${esc(a.config.notes)}</p>${current && (a.state !== "pending" || a.config.hazardType === "notification") ? `<p>Effect ${a.index + 1}/${a.config.actions.length}: ${esc(current.name || current.kind)} ${esc(actionFormula(current))}</p>` : ""}
    ${a.rolled !== null ? `<p>Rolled amount: <strong>${a.rolled}</strong> — awaiting GM application.</p>` : ""}
    ${a.attackReceipt?.messageId ? messageLink(a.attackReceipt.messageId,"View weapon attack in chat") : ""}
    ${a.attackReceipt?.state === "spent" ? "<p>Weapon attack skipped: this hazard actor already attacked this round.</p>" : ""}
    ${a.error ? `<p role="alert">${esc(a.error)} Check the Actor and chat before advancing; this effect will not be repeated automatically.</p>` : ""}${controls}</section>`;
}
