import {MODULE_ID} from "../settings.js";
import type {Activation} from "./activation-state.js";
interface SceneEffectRequest {
  provider: string;
  group: string;
  source: string;
  index: number;
  target: string;
  title: string;
  label: string;
  damage?: {armor: "full" | "half" | "ignore"; ablation: number};
  formula?: string;
  result?: string;
  avoidance?: {skill: string; dv: number};
}
type AttackResult = {
  status: "started";
  messageId: string;
} | {
  status: "cancelled";
};
type ChooseStatuses = (selected: string[], slot: number, options: {
  allowedIds: string[];
}) => Promise<string[] | null>;
interface CombatToolsAPI {
  sceneEffects?: {
    version: number;
    create(request: SceneEffectRequest): Promise<string>;
    getAvoidanceResult?(query: {cardId: string; provider: string; source: string; index: number; target: string}): {skill: string; dv: number; total: number; passed: boolean} | null;
  };
  sceneAttack?: {
    version: number;
    execute(source: Token, target: Token, weaponId: string): Promise<AttackResult>;
  };
  statusPicker?: {
    version: number;
    choose: ChooseStatuses;
  };
}
function combatTools(): {
  active: boolean;
  api?: CombatToolsAPI;
} | undefined {
  return game.modules?.get("pneuma-combattools") as unknown as {
    active: boolean;
    api?: CombatToolsAPI;
  } | undefined;
}
export function requireEffectCards(): NonNullable<CombatToolsAPI["sceneEffects"]> {
  const module = combatTools();
  if (!module?.active || !module.api?.sceneEffects)
    throw Error("Update Combat Tools for hazard effect cards.");
  return module.api.sceneEffects;
}
function requireAvoidanceResults() {
  const api = requireEffectCards();
  if (api.version < 3 || !api.getAvoidanceResult) throw Error("Update Combat Tools for avoidance results (sceneEffects API v3 required).");
  return api;
}
export function getAvoidanceResult(cardId: string, source: string, index: number, target: string) {
  return requireAvoidanceResults().getAvoidanceResult!({cardId, provider: MODULE_ID, source, index, target});
}
export function createEffectCard(a: Activation, source: string, label: string, details: {
  formula?: string;
  result?: string;
}): Promise<string> {
  const effect = a.config.actions[a.index];
  const avoidance = !details.result && effect?.resistSkill && ["damage", "direct", "status", "movePenalty"].includes(effect.kind) ? {skill: effect.resistSkill, dv: effect.resistDV} : undefined;
  const api = avoidance ? requireAvoidanceResults() : requireEffectCards();
  const damage = effect && (effect.kind === "damage" || effect.kind === "direct" && !!effect.formula) ? {armor: effect.armor, ablation: effect.ablation} : undefined;
  if (damage && api.version < 4) throw Error("Update Combat Tools for native hazard damage cards (sceneEffects API v4 required).");
  return api.create({
    provider: MODULE_ID, group: `${a.region}:${a.batch}:${a.index}`,
    source, index: a.index, target: a.target, title: a.config.name, label, avoidance, damage, ...details
  });
}
export function executeHazardAttack(source: Token, target: Token, weaponId: string): Promise<AttackResult> {
  const module = combatTools(), api = module?.api?.sceneAttack;
  if (!module?.active || !api || api.version < 2)
    throw Error("Update Combat Tools for hazard attacks (sceneAttack API v2 required).");
  return api.execute(source, target, weaponId);
}
export async function chooseCombatStatuses(selected: string[], allowedIds: string[]): Promise<string[] | null> {
  const module = combatTools();
  if (!module?.active)
    throw Error("Enable Combat Tools to use its categorized effect picker.");
  const picker = module.api?.statusPicker;
  if(picker?.version!==1)throw Error("Combat Tools statusPicker API v1 is required. Update Combat Tools and reload Foundry.");
  return picker.choose(selected,0,{allowedIds});

}
