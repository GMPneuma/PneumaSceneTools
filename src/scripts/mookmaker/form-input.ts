import { getArmorUpdates } from "./armor.js";
import type {ApplyMookChanges} from "./apply-mook.js";
import { getBulletDodgingChoices, type BulletDodging } from "./bullet-dodging.js";
import {
  getSkillTarget,
  getSkillUpdates,
  type SkillTargets,
} from "./skills.js";
import { getStatsForHitPoints } from "./stats.js";
import { type AvailableRole } from "./roles.js";
import {getCivilianCombatNumber} from "./skill-settings.js";
import {getWeaponUpdates} from "./weapons.js";


export function readMookForm(html: JQuery, token: Token, availableRoles: AvailableRole[], initialName: string): ApplyMookChanges {
  const newName = String(
    html.find<HTMLInputElement>('input[name="name"]').val() ?? "",
  ).trim();
  if (!newName) {
    throw new Error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.NameRequired"),
    );
  }

  if (token.document.actorLink) {
    throw new Error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.UnlinkedOnly"),
    );
  }

  const selectedMove = Number(
    html.find<HTMLInputElement>('input[name="move"]:checked').val(),
  );
  if (!Number.isInteger(selectedMove) || selectedMove < 2 || selectedMove > 8) {
    throw new Error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.MoveRequired"),
    );
  }

  const selectedHitPoints = Number(
    html.find<HTMLInputElement>('input[name="hitpoints"]:checked').val(),
  );
  const hitPointStats = getStatsForHitPoints(selectedHitPoints);
  if (!hitPointStats) {
    throw new Error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.HitpointsRequired"),
    );
  }

  const roleSelection = String(
    html.find<HTMLSelectElement>('select[name="role"]').val() ?? "none",
  );
  const selectedRole = availableRoles.find((role) => role.key === roleSelection);
  const roleName = selectedRole?.name ?? "";
  const roleLevelText = String(
    html.find<HTMLInputElement>('input[name="level"]').val() ?? "",
  );
  const roleLevel = Number(roleLevelText);
  if (roleName && (!/^\d$/.test(roleLevelText) || !Number.isInteger(roleLevel))) {
    throw new Error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.RoleLevelRequired"),
    );
  }

  const bodyArmor = String(
    html.find<HTMLInputElement>('input[name="bodyArmor"]:checked').val() ??
      "None",
  );
  const headArmor = String(
    html.find<HTMLInputElement>('input[name="headArmor"]:checked').val() ??
      "None",
  );
  const actor = token.actor;
  if (!actor) {
    throw new Error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.ApplyFailed"),
    );
  }
  const displayName = Number(
    html.find<HTMLSelectElement>('select[name="displayName"]').val() ??
      token.document.displayName,
  );
  const tokenDisposition = Number(
    html.find<HTMLSelectElement>('select[name="tokenDisposition"]').val() ??
      token.document.disposition,
  );
  const selectedWeaponIds = [1, 2]
    .map((row) => String(
      html.find<HTMLSelectElement>(`select[name="weapon${row}"]`).val() ?? "",
    ))
    .filter(Boolean);
  if (new Set(selectedWeaponIds).size !== selectedWeaponIds.length) {
    throw new Error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.DuplicateWeapon"),
    );
  }
  const weaponUpdates = getWeaponUpdates(actor, selectedWeaponIds);
  const armorResult = getArmorUpdates(actor, bodyArmor, headArmor);
  if (armorResult.missingArmor) {
    throw new Error(
      game.i18n!.format("PNEUMA_MOOK_MAKER.Form.ArmorMissing", {
        armor: armorResult.missingArmor,
      }),
    );
  }


  const combatSelection = String(
    html.find<HTMLInputElement>('input[name="combatNumber"]:checked').val() ??
      "No change",
  );
  let combatNumber: number | null = null;
  if (combatSelection === "Civilian") {
    combatNumber = getCivilianCombatNumber();
  }
  else if (combatSelection === "custom") {
    const customCombatNumber = String(
      html.find<HTMLInputElement>('input[name="customCombatNumber"]').val() ?? "",
    );
    const customValue = Number(customCombatNumber);
    if (
      /^\d{1,2}$/.test(customCombatNumber) &&
      customValue >= 0 &&
      customValue <= 20
    ) {
      combatNumber = customValue;
    } else {
      throw new Error(
        game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.CombatNumberRequired"),
      );
    }
  } else if (combatSelection !== "No change") {
    combatNumber = Number(combatSelection);
  }

  const skillTargets: SkillTargets = {};
  if (combatNumber !== null && Number.isFinite(combatNumber)) {
    skillTargets[1] = combatNumber;
  }
  for (const [category, name] of [
    [2, "secondarySkills"],
    [3, "tertiarySkills"],
  ] as const) {
    const selection = String(
      html.find<HTMLInputElement>(`input[name="${name}"]:checked`).val() ?? "unchanged",
    );
    const customTarget = String(
      html.find<HTMLInputElement>(`input[name="${name}Target"]`).val() ?? "",
    );
    const target = getSkillTarget(selection, customTarget);
    if (Number.isNaN(target)) {
      throw new Error(game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SkillAdjustmentRequired"));
    }
    if (target !== null) skillTargets[category] = target;
  }

  const bulletDodging = String(html.find<HTMLSelectElement>('select[name="bulletDodging"]').val() ?? "unchanged") as BulletDodging;
  if (!getBulletDodgingChoices().includes(bulletDodging)) {
    throw new Error(game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.DodgeInvalid"));
  }
  const skillUpdates = getSkillUpdates(
    actor,
    skillTargets,
    hitPointStats.will,
    bulletDodging === "reflex" ? 8 : undefined,
  );

  return {
      token,
      actor,
      initialName,
      newName,
      displayName,
      tokenDisposition,
      move: selectedMove,
      hitPoints: selectedHitPoints,
      hitPointStats,
      roleName,
      roleLevel,
      roleSource: selectedRole?.source,
      armorUpdates: armorResult.updates,
      weaponUpdates,
      skillUpdates,
      bulletDodging,
    };
}
