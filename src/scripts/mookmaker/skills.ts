import {
  getSkillClassifications,
  normalizeSkillKey,
  type SkillCategory,
} from "./skill-settings.js";

export type SkillTargets = Partial<Record<SkillCategory, number>>;

export function getCurrentCombatNumber(actor: Actor): number | null {
  const classifications = getSkillClassifications();
  const counts = new Map<number, number>();

  for (const item of actor.items) {
    if (
      String(item.type) !== "skill" ||
      !item.name ||
      classifications[normalizeSkillKey(item.name)] !== 1
    ) continue;
    const stat = String(foundry.utils.getProperty(item, "system.stat") ?? "");
    const statValue = Number(
      foundry.utils.getProperty(actor, `system.stats.${stat}.value`),
    );
    const skillLevel = Number(foundry.utils.getProperty(item, "system.level"));
    const base = statValue + skillLevel;
    if (!Number.isInteger(base) || base < 0 || base > 20) continue;
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort(
    ([leftBase, leftCount], [rightBase, rightCount]) =>
      rightCount - leftCount || leftBase - rightBase,
  );
  const first = ranked[0];
  if (!first) return null;
  const second = ranked[1];
  if (second && first[1] === second[1]) return null;
  return first[0];
}

export function getSkillUpdates(
  actor: Actor,
  targets: SkillTargets,
  willOverride: number,
  reflexOverride?: number,
): object[] {
  const classifications = getSkillClassifications();
  return Array.from(actor.items).flatMap((item) => {
    if (String(item.type) !== "skill" || !item.id || !item.name) return [];
    const category = classifications[normalizeSkillKey(item.name)];
    const target = category ? targets[category] : undefined;
    if (target === undefined) return [];

    const stat = String(foundry.utils.getProperty(item, "system.stat") ?? "");
    const statValue =
      stat === "will"
        ? willOverride
        : stat === "ref" && reflexOverride !== undefined
          ? reflexOverride
        : Number(foundry.utils.getProperty(actor, `system.stats.${stat}.value`));
    if (!Number.isFinite(statValue)) return [];
    return [{ _id: item.id, "system.level": Math.max(0, target - statValue) }];
  });
}

export function getSkillTarget(
  selection: string,
  customTarget: string,
): number | null {
  if (selection === "unchanged") return null;
  if (selection === "set-custom" && /^(?:[0-9]|1[0-8])$/.test(customTarget)) {
    return Number(customTarget);
  }
  return Number.NaN;
}
