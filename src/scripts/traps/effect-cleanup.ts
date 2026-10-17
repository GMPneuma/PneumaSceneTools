import {MODULE_ID} from "../settings.js";
import {authority, traps, trapData, effectRegion, intact, removeHazardToken} from "./documents.js";
export async function cleanupEffects(scene: Scene): Promise<void> {
  if (!authority())
    return;
  const hazards = new Map(traps(scene).map(d => [d.uuid, d]));
  const tokens = new Map(Array.from(scene.tokens, token => [token.uuid, token]));
  for (const token of scene.tokens) {
    if (!token.actor)
      continue;
    const ids: string[] = [];
    for (const effect of token.actor.effects) {
      const flag = foundry.utils.getProperty(effect, `flags.${MODULE_ID}.trapEffect`) as {
        region: string;
        token: string;
        expires: number | null;
        untilExit: boolean;
        conditionToken?: string | null;
      } | undefined;
      if (!flag?.region || flag.token !== token.uuid)
        continue;
      const d = hazards.get(flag.region);
      const t = d && trapData(d), area = d && t ? effectRegion(d, t) : undefined;
      const instance = flag.conditionToken ? tokens.get(flag.conditionToken) : undefined;
      if (flag.conditionToken && (!instance || !instance.actor || Number(foundry.utils.getProperty(instance.actor, "system.derivedStats.hp.value")) <= 0)) {
        ids.push(effect.id!);
        continue;
      }
      if (flag.expires !== null && flag.expires <= game.time!.worldTime || flag.untilExit && (!d || !intact(d) || !area || !area.tokens.has(token)))
        ids.push(effect.id!);
    }
    if (ids.length)
      await token.actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
  for (const instance of [...scene.tokens]) {
    const condition = foundry.utils.getProperty(instance, `flags.${MODULE_ID}.hazardCondition`) as {
      target: string;
      retainWithoutEffects?: boolean;
    } | undefined;
    if (!condition)
      continue;
    const target = tokens.get(condition.target);
    if (!target?.actor || Number(foundry.utils.getProperty(instance.actor ?? {}, "system.derivedStats.hp.value")) <= 0 || !condition.retainWithoutEffects && !target.actor.effects.some(e => foundry.utils.getProperty(e, `flags.${MODULE_ID}.trapEffect.conditionToken`) === instance.uuid))
      await removeHazardToken(instance);
  }
}
