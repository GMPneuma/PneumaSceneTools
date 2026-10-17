import {requireEffectCards, createEffectCard, getAvoidanceResult} from "./combat-tools.js";
import {MODULE_ID} from "../settings.js";
import {requireHazards} from "./dependency.js";
import {findHazard, resolveHazard, authority, intact, hazardIssues, behaviorEnabled, trapData, updateTrap} from "./documents.js";
import {actionFormula, validateTrap, type TrapConfig} from "./model.js";
import {applyAction, attackHazard, rollCheck} from "./resolution.js";
import {activation, advanceEffect, markForReview, type Activation, type ActivationAction} from "./activation-state.js";
import {card, effectLabel} from "./activation-card.js";
import {proposeTargets} from "./triggers.js";
async function save(message: ChatMessage, a: Activation): Promise<void> {
  a.revision++;
  const removed = Object.fromEntries(["attackReceipt", "effectCard"].filter(key => !(key in a)).map(key => [`flags.${MODULE_ID}.trapActivation.-=${key}`, null]));
  if (!await message.update({content: card(a), [`flags.${MODULE_ID}.trapActivation`]: a, ...removed} as object))
    throw Error("Activation state could not be saved.");
}
export async function resolve(message: ChatMessage, action: ActivationAction, expectedRevision?: number): Promise<void> {
  requireHazards();
  if (!authority())
    throw Error("The active GM resolves hazard cards to prevent duplicate applications.");
  const original = activation(message);
  if (!original || ["done", "skipped"].includes(original.state))
    return;
  if (expectedRevision !== undefined && expectedRevision !== original.revision)
    throw Error("This hazard card changed. Review its current result before acting again.");
  const a = structuredClone(original);
  a.config = validateTrap(a.config);
  if (action === "disengage") {
    const source = await resolveHazard(a.region), t = source && trapData(source);
    if (source && t)
      await updateTrap(source, {engaged: t.engaged.filter(id => !a.target.endsWith("." + id))});
    a.state = "skipped";
    await save(message, a);
    return;
  }
  if (action === "skip") {
    a.state = "skipped";
    await save(message, a);
    return;
  }
  if (action === "omit" && ["ready", "review", "applying"].includes(a.state)) {
    advanceEffect(a);
    a.error = "";
    await save(message, a);
    return;
  }
  const d = await resolveHazard(a.region), token = await fromUuid(a.target) as TokenDocument | null;
  if (!d || d.documentName !== "SceneToolsHazard" || !token || token.documentName !== "Token" || token.parent?.id !== d.parent?.id || !trapData(d))
    throw Error("The hazard or target no longer exists. Dismiss this card.");
  // Activation is checked when proposing a trigger, not when resolving an existing card.
  if (!behaviorEnabled(d) || !intact(d) || hazardIssues(trapData(d)!, d).length)
    throw Error("The hazard is disabled or destroyed. Dismiss this card.");
  if (action === "roll" && a.state === "pending" && a.config.hazardType !== "notification") {
    await rollCheck(token, a.config.check);
    return;
  }
  if (action === "approve" && a.state === "pending") {
    // Ignore counters when checking that the GM is still approving the displayed configuration.
    const stable = (t: TrapConfig) => JSON.stringify({...validateTrap(t), anchor: {x: 0, y: 0}, armed: false, moveProgress: {}, detected: [], engaged: [], apId: ""});
    if (stable(trapData(d)!) !== stable(a.config))
      throw Error("Hazard configuration changed. Dismiss this card and trigger it again.");
    a.state = a.config.actions.length ? "ready" : "done";
    await save(message, a);
    return;
  }
  if (action !== "apply" || a.state !== "ready")
    return;
  if (a.effectCard?.index === a.index)
    throw Error("Resolve this effect on its Combat Tools card.");
  // Each effect still requires explicit GM resolution.
  const effect = a.config.actions[a.index];
  if (!effect)
    return;
  a.state = "applying";
  await save(message, a);
  try {
    if (["damage", "direct", "status", "movePenalty"].includes(effect.kind)) {
      const id = await createEffectCard(a, message.id!, effectLabel(effect), {formula: ["damage", "direct", "movePenalty"].includes(effect.kind) ? actionFormula(effect) || (effect.kind === "movePenalty" ? String(effect.moveReduction) : "") : ""});
      a.effectCard = {index: a.index, id};
      a.state = "ready";
      await save(message, a);
      return;
    }
    if (effect.kind === "spawnCondition") {
      requireEffectCards();
      await applyAction(d, token, effect, `${message.id}:${a.index}`);
      await createEffectCard(a, message.id!, effectLabel(effect), {result: `${effectLabel(effect)} created for ${token.name}.`});
    }
    else if (effect.kind === "attack") {
      const previous = game.messages!.find(m => {const other = activation(m); return other?.region === a.region && other.batch === a.batch && !!other.attackReceipt;});
      if (previous) {
        const receipt = activation(previous)!.attackReceipt!;
        if (receipt.state !== "started" && receipt.state !== "spent")
          throw Error("This activation's weapon attack needs GM review before any further attack.");
        a.attackReceipt = {...receipt};
      }
      else {
        a.attackReceipt = {state: "starting"};
        await save(message, a);
        const result = await attackHazard(d, token, effect);
        if (result.status === "cancelled") {
          delete a.attackReceipt;
          a.state = "ready";
          await save(message, a);
          return;
        }
        a.attackReceipt = result.status === "started" ? {state: "started", messageId: result.messageId} : {state: "spent"};
        await save(message, a);
      }
    }
    else if (effect.kind === "triggerHazard") {
      const child = findHazard(d.parent!, effect.hazardId);
      if (!child || !trapData(child))
        throw Error("The linked hazard no longer exists. Review or skip this effect.");
      await proposeTargets(child, token, `Linked: ${a.config.name}`, a.chain);
    }
    else
      await applyAction(d, token, effect, message.id! + ":" + a.index, a.rolled ?? undefined);
    advanceEffect(a);
    await save(message, a);
  }
  catch (error) {
    if (a.attackReceipt?.state === "starting")
      a.attackReceipt.state = "review";
    markForReview(a, error);
    await save(message, a);
  }
}
/** Combat Tools owns the card; SceneTools retains effect provenance and cleanup. */
export async function applyCombatEffect(source: string, index: number, cardId: string, amount?: number, avoided = false, applyDamage?: () => Promise<void>): Promise<string> {
  if (effectApplications.has(source))
    throw Error("This hazard effect is already applying.");
  effectApplications.add(source);
  try {
    return await applyCombatEffectOnce(source, index, cardId, amount, avoided, applyDamage);
  }
  finally {
    effectApplications.delete(source);
  }
}
const effectApplications = new Set<string>();
async function applyCombatEffectOnce(source: string, index: number, cardId: string, amount?: number, avoided = false, applyDamage?: () => Promise<void>): Promise<string> {
  requireHazards();
  if (!authority())
    throw Error("The active GM resolves hazard effects.");
  const message = game.messages!.get(source) as ChatMessage | undefined, original = message && activation(message);
  if (!message || !original || original.state !== "ready" || original.index !== index || original.effectCard?.id !== cardId || original.effectCard.index !== index)
    throw Error("The source hazard effect changed or was already resolved.");
  const a = structuredClone(original), d = await resolveHazard(a.region), token = await fromUuid(a.target) as TokenDocument | null;
  a.config = validateTrap(a.config);
  if (!d || !token?.actor || token.parent?.id !== d.parent?.id || !behaviorEnabled(d) || !intact(d) || hazardIssues(trapData(d)!, d).length)
    throw Error("The hazard or target is unavailable, disabled or destroyed.");
  if (activation(message)?.revision !== original.revision)
    throw Error("The source hazard card changed.");
  const effect = a.config.actions[index];
  if (!effect || !["damage", "direct", "status", "movePenalty", "spawnCondition"].includes(effect.kind))
    throw Error("Unsupported hazard effect.");
  const current = trapData(d)!;
  if (current.bodyId !== a.config.bodyId || JSON.stringify(current.actions[index]) !== JSON.stringify(effect))
    throw Error("Hazard configuration changed. Dismiss this effect and trigger it again.");
  if (effect.resistSkill) {
    const check = getAvoidanceResult(cardId, source, index, a.target);
    if (!check || check.skill !== effect.resistSkill || check.dv !== effect.resistDV || check.passed !== avoided)
      throw Error("Resolve avoidance on the Combat Tools card first.");
  } else if (avoided) throw Error("This effect has no avoidance check.");
  if (avoided) {
    advanceEffect(a);
    delete a.effectCard;
    await save(message, a);
    return `${token.name} avoided ${effectLabel(effect)}.`;
  }
  if (["damage", "direct", "movePenalty"].includes(effect.kind) && actionFormula(effect) && (amount === undefined || !Number.isFinite(amount) || amount < 0))
    throw Error("Roll the effect amount first.");
  a.state = "applying";
  await save(message, a);
  try {
    if (applyDamage && (effect.kind === "damage" || effect.kind === "direct" && !!effect.formula)) {
      await applyDamage();
      if (effect.kind === "direct") await applyAction(d, token, {...effect, formula: ""}, `${message.id}:${index}`, amount);
    } else await applyAction(d, token, effect, `${message.id}:${index}`, amount);
    advanceEffect(a);
    delete a.effectCard;
    await save(message, a);
    return `${effectLabel(effect)}${amount !== undefined ? ` (rolled ${amount})` : ""} applied to ${token.name}.`;
  }
  catch (error) {
    markForReview(a, error);
    await save(message, a);
    throw error;
  }
}
