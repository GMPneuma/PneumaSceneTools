import { getArmorUpdates, getCurrentArmorSelections } from "./armor.js";
import { applyMookChanges } from "./apply-mook.js";
import { getBulletDodgingChoices, type BulletDodging } from "./bullet-dodging.js";
import {
  getSkillTarget,
  getCurrentCombatNumber,
  getSkillUpdates,
  type SkillTargets,
} from "./skills.js";
import { getStatsForHitPoints } from "./stats.js";
import { confirmPurgeGear } from "./purge.js";
import { confirmPromotion } from "./promotion.js";
import { getAvailableSystemRoles, type AvailableRole } from "./roles.js";
import {
  areTokenControlsVisible,
  getCivilianCombatNumber,
} from "./skill-settings.js";
import {
  getWeaponInventoryChoices,
  getWeaponUpdates,
  type WeaponInventoryChoices,
} from "./weapons.js";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function getRadioChoices(
  name: string,
  values: readonly string[],
  selected: string,
  className = "pneuma-mook-maker-radio-row",
  suffix = "",
  labels: Readonly<Record<string, string>> = {},
): string {
  const choices = values
    .map(
      (value) => `
        <label class="pneuma-mook-maker-radio">
          <input type="radio" name="${name}" value="${value}"${value === selected ? " checked" : ""}>
          <span>${escapeHtml(labels[value] ?? value)}</span>
        </label>`,
    )
    .join("");

  return `<div class="${className}">${choices}${suffix}</div>`;
}

function getSkillAdjustmentOptions(name: string): string {
  return `
    <div class="pneuma-mook-maker-skill-adjustment" data-skill-adjustment="${name}">
      <div class="pneuma-mook-maker-radio-column">
        <label class="pneuma-mook-maker-radio">
          <input type="radio" name="${name}" value="unchanged" checked>
          <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Unchanged")}</span>
        </label>
        <label class="pneuma-mook-maker-radio pneuma-mook-maker-set-custom">
          <input type="radio" name="${name}" value="set-custom">
          <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SetSkillTarget")}</span>
          <input type="text" name="${name}Target" inputmode="numeric" pattern="(?:[0-9]|1[0-8])"
            maxlength="2" aria-label="${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SkillTarget")}">
        </label>
      </div>
    </div>`;
}

function getWeaponRows(choices: WeaponInventoryChoices): string {
  const none = game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.None");
  const weaponOptions = choices.weapons
    .map((weapon) => `<option value="${escapeHtml(weapon.id)}">${escapeHtml(weapon.name)}</option>`)
    .join("");
  return [0, 1].map((index) => {
    const selectedId = choices.selectedWeaponIds[index] ?? "";
    return `
      <div class="pneuma-mook-maker-weapon-slot">
        <h4>${game.i18n!.format("PNEUMA_MOOK_MAKER.Form.WeaponNumber", { number: index + 1 })}</h4>
        <select name="weapon${index + 1}" aria-label="${game.i18n!.format("PNEUMA_MOOK_MAKER.Form.WeaponNumber", { number: index + 1 })}">
          <option value="">${none}</option>
          ${weaponOptions}
        </select>
      </div>
      <input type="hidden" name="initialWeapon${index + 1}" value="${escapeHtml(selectedId)}">`;
  }).join("");
}

function getSelectOptions(
  choices: ReadonlyArray<{ value: number; label: string }>,
  selected: number,
): string {
  return choices.map(({ value, label }) =>
    `<option value="${value}"${value === selected ? " selected" : ""}>${game.i18n!.localize(label)}</option>`,
  ).join("");
}

function getMookMakerForm(token: Token, availableRoles: AvailableRole[]): string {
  const name = escapeHtml(token.document.name ?? token.actor?.name ?? "");
  const actor = token.actor ?? {};
  const actorDocument = token.actor;
  const civilianCombatNumber = getCivilianCombatNumber();
  const currentCombatNumber = actorDocument
    ? getCurrentCombatNumber(actorDocument)
    : null;
  const currentCombatSelection = currentCombatNumber === civilianCombatNumber
    ? "Civilian"
    : currentCombatNumber !== null && currentCombatNumber >= 10 && currentCombatNumber <= 14
      ? String(currentCombatNumber)
      : currentCombatNumber !== null
        ? "custom"
        : "No change";
  const customCombatValue = currentCombatSelection === "custom"
    ? String(currentCombatNumber)
    : "";
  const customCombatChoice = `
    <label class="pneuma-mook-maker-radio pneuma-mook-maker-custom-choice">
      <input type="radio" name="combatNumber" value="custom"${currentCombatSelection === "custom" ? " checked" : ""}>
      <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Custom")}</span>
      <input class="pneuma-mook-maker-custom-number" name="customCombatNumber" type="text"
        inputmode="numeric" pattern="(?:[0-9]|1[0-9]|20)" maxlength="2" value="${customCombatValue}"
        aria-label="${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.CustomCombatNumber")}"${currentCombatSelection === "custom" ? "" : " disabled"}>
    </label>`;
  const combatChoices = getRadioChoices(
    "combatNumber",
    ["No change", "Civilian", "10", "11", "12", "13", "14"],
    currentCombatSelection,
    "pneuma-mook-maker-radio-column",
    customCombatChoice,
    {
      Civilian: game.i18n!.format("PNEUMA_MOOK_MAKER.Form.CivilianCombatNumber", {
        number: civilianCombatNumber,
      }),
    },
  );
  const armorChoices = [
    "None",
    "Leathers",
    "Kevlar",
    "LightArmorJack",
    "MedArmorJack",
  ];
  const armorSelections = actorDocument
    ? getCurrentArmorSelections(actorDocument)
    : { body: "None", head: "None" };
  const weaponChoices = actorDocument
    ? getWeaponInventoryChoices(actorDocument)
    : { weapons: [], selectedWeaponIds: [] };
  const activeRole = String(
    foundry.utils.getProperty(actor, "system.roleInfo.activeRole") ?? "",
  );
  const activeRoleKey = availableRoles.find(
    (role) => role.name.toLocaleLowerCase() === activeRole.toLocaleLowerCase(),
  )?.key ?? "none";
  const roleOptions = availableRoles.map(
    (role) =>
      `<option value="${escapeHtml(role.key)}"${activeRoleKey === role.key ? " selected" : ""}>${escapeHtml(role.name)}</option>`,
  ).join("");
  const activeRoleItem = actorDocument?.items.find(
    (item) => String(item.type) === "role" && item.name === activeRole,
  );
  const activeRoleLevel = Number(
    activeRoleItem
      ? foundry.utils.getProperty(activeRoleItem, "system.rank") ?? 0
      : 0,
  );
  const currentHitPoints = String(
    foundry.utils.getProperty(actor, "system.derivedStats.hp.value") ?? "",
  );
  const currentMove = String(
    foundry.utils.getProperty(actor, "system.stats.move.value") ?? "",
  );
  const tokenControls = areTokenControlsVisible()
    ? `
      <div class="pneuma-mook-maker-token-row">
        <label>
          <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.DisplayName")}</span>
          <select name="displayName">
            ${getSelectOptions([
              { value: 0, label: "PNEUMA_MOOK_MAKER.Form.DisplayNameNever" },
              { value: 10, label: "PNEUMA_MOOK_MAKER.Form.DisplayNameControl" },
              { value: 20, label: "PNEUMA_MOOK_MAKER.Form.DisplayNameOwnerHover" },
              { value: 30, label: "PNEUMA_MOOK_MAKER.Form.DisplayNameHover" },
              { value: 40, label: "PNEUMA_MOOK_MAKER.Form.DisplayNameOwner" },
              { value: 50, label: "PNEUMA_MOOK_MAKER.Form.DisplayNameAlways" },
            ], Number(token.document.displayName))}
          </select>
        </label>
        <label>
          <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.TokenDisposition")}</span>
          <select name="tokenDisposition">
            ${getSelectOptions([
              { value: -2, label: "PNEUMA_MOOK_MAKER.Form.DispositionSecret" },
              { value: -1, label: "PNEUMA_MOOK_MAKER.Form.DispositionHostile" },
              { value: 0, label: "PNEUMA_MOOK_MAKER.Form.DispositionNeutral" },
              { value: 1, label: "PNEUMA_MOOK_MAKER.Form.DispositionFriendly" },
            ], Number(token.document.disposition))}
          </select>
        </label>
      </div>`
    : "";
  return `
    <form class="pneuma-mook-maker-form">
      <header class="pneuma-mook-maker-form-header">
        <h2>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Header")}</h2>
      </header>
      <fieldset class="pneuma-mook-maker-section pneuma-mook-maker-section-mook">
        <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SectionMook")}</legend>
        <div class="pneuma-mook-maker-mook-layout">
        <div class="pneuma-mook-maker-mook-fields">
        <div class="pneuma-mook-maker-identity-row">
          <label class="pneuma-mook-maker-identity-name" for="pneuma-mook-maker-name">
            <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Name")}</span>
            <input id="pneuma-mook-maker-name" name="name" type="text" value="${name}" size="25" autocomplete="off">
          </label>
          <label for="pneuma-mook-maker-role">
            <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Role")}</span>
            <select id="pneuma-mook-maker-role" name="role">
              <option value="none"${activeRoleKey === "none" ? " selected" : ""}>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.None")}</option>
              ${roleOptions}
            </select>
          </label>
          <label class="pneuma-mook-maker-level" for="pneuma-mook-maker-level">
            <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Level")}</span>
            <input id="pneuma-mook-maker-level" name="level" type="text" inputmode="numeric"
              pattern="[0-9]" maxlength="1" value="${activeRoleLevel}" autocomplete="off">
          </label>
        </div>
        ${tokenControls}
        </div>
        <div class="pneuma-mook-maker-secondary-actions">
          <button class="pneuma-mook-maker-purge" type="button" data-action="purge-gear">
            <i class="fas fa-trash"></i>
            ${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PurgeGear")}
          </button>
          <button class="pneuma-mook-maker-promote" type="button" data-action="promote">
            <i class="fas fa-user-graduate"></i>
            ${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Promote")}
          </button>
        </div>
        </div>
      </fieldset>
      <fieldset class="pneuma-mook-maker-section pneuma-mook-maker-section-stats">
        <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SectionStats")}</legend>
        <div class="pneuma-mook-maker-stat-grid">
        <fieldset>
          <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.CombatNumber")}</legend>
          <div class="pneuma-mook-maker-combat-layout">
            <div class="pneuma-mook-maker-primary-combat-options">
              ${combatChoices}
            </div>
            <div class="pneuma-mook-maker-non-combat-pane">
              <label class="pneuma-mook-maker-bullet-dodging">
                <span>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.CanDodgeBullets")}</span>
                <select name="bulletDodging">
                  ${getBulletDodgingChoices().map(choice => `<option value="${choice}">${game.i18n!.localize({
                    unchanged: "PNEUMA_MOOK_MAKER.Form.Unchanged",
                    reflex: "PNEUMA_MOOK_MAKER.Form.DodgeReflex",
                    coprocessor: "PNEUMA_MOOK_MAKER.Form.DodgeCoprocessor",
                  }[choice])}</option>`).join("")}
                </select>
              </label>
              <div class="pneuma-mook-maker-non-combat-options">
                <fieldset>
                  <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SecondarySkills")}</legend>
                  ${getSkillAdjustmentOptions("secondarySkills")}
                </fieldset>
                <fieldset>
                  <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.TertiarySkills")}</legend>
                  ${getSkillAdjustmentOptions("tertiarySkills")}
                </fieldset>
              </div>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Hitpoints")}</legend>
          ${getRadioChoices("hitpoints", ["20", "25", "30", "35", "40", "45", "50"], currentHitPoints, "pneuma-mook-maker-radio-column")}
        </fieldset>
        <fieldset>
          <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Move")}</legend>
          ${getRadioChoices("move", ["2", "3", "4", "5", "6", "7", "8"], currentMove, "pneuma-mook-maker-radio-column")}
        </fieldset>
        </div>
      </fieldset>
      <fieldset class="pneuma-mook-maker-section pneuma-mook-maker-section-gear">
        <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SectionGear")}</legend>
        <div class="pneuma-mook-maker-armor-grid">
        <fieldset>
          <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.BodyArmor")}</legend>
          ${getRadioChoices("bodyArmor", armorChoices, armorSelections.body, "pneuma-mook-maker-radio-column")}
        </fieldset>
        <fieldset>
          <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.HeadArmor")}</legend>
          ${getRadioChoices("headArmor", armorChoices, armorSelections.head, "pneuma-mook-maker-radio-column")}
        </fieldset>
        <fieldset class="pneuma-mook-maker-weapons">
          <legend>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Weapons")}</legend>
          ${getWeaponRows(weaponChoices)}
        </fieldset>
        <p class="pneuma-mook-maker-armor-note">
          <i class="fas fa-circle-info"></i>
          ${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.ArmorInventoryNote")}
        </p>
        </div>
      </fieldset>
      <div class="pneuma-mook-maker-form-actions">
        <button type="button" data-action="apply">
          <i class="fas fa-check"></i>
          ${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Apply")}
        </button>
        <button type="button" data-action="cancel">
          <i class="fas fa-times"></i>
          ${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Cancel")}
        </button>
      </div>
    </form>`;
}

export async function showMookMakerMenu(token: Token): Promise<void> {
  const actorName = token.actor?.name ?? token.document.name;
  const initialName = token.document.name ?? token.actor?.name ?? "";
  let availableRoles: AvailableRole[];
  try {
    availableRoles = await getAvailableSystemRoles();
  } catch (error) {
    console.error("pneuma-scenetools | MookMaker | Failed to discover Cyberpunk RED roles", error);
    ui.notifications?.error("MookMaker could not load roles from the Cyberpunk RED system.");
    return;
  }

  const dialog = new Dialog(
    {
      title: game.i18n!.format("PNEUMA_MOOK_MAKER.Menu.Title", { name: actorName }),
      content: getMookMakerForm(token, availableRoles),
      buttons: {},
      render: (html) => {
      for (const row of [1, 2]) {
        const initialWeaponId = String(
          html.find<HTMLInputElement>(`input[name="initialWeapon${row}"]`).val() ?? "",
        );
        html.find<HTMLSelectElement>(`select[name="weapon${row}"]`)
          .val(initialWeaponId);
      }
      const customNumber = html.find<HTMLInputElement>(
        ".pneuma-mook-maker-custom-number",
      );
      html.find<HTMLInputElement>('input[name="combatNumber"]').on("change", (event) => {
        const isCustom = (event.currentTarget as HTMLInputElement).value === "custom";
        customNumber.prop("disabled", !isCustom);
        if (isCustom) customNumber.trigger("focus");
      });
      customNumber.on("input", (event) => {
        const input = event.currentTarget as HTMLInputElement;
        input.value = input.value.replace(/\D/g, "").slice(0, 2);
        if (Number(input.value) > 20) input.value = "20";
      });
      html.find<HTMLInputElement>('#pneuma-mook-maker-level').on("input", (event) => {
        const input = event.currentTarget as HTMLInputElement;
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
      });
      html
        .find<HTMLInputElement>('input[name="secondarySkillsTarget"], input[name="tertiarySkillsTarget"]')
        .on("focus", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const adjustmentName = input.name.replace(/Target$/, "");
          html
            .find<HTMLInputElement>(`input[name="${adjustmentName}"][value="set-custom"]`)
            .prop("checked", true)
            .trigger("change");
        })
        .on("input", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          input.value = input.value.replace(/\D/g, "").slice(0, 2);
          if (Number(input.value) > 18) input.value = "18";
          const adjustmentName = input.name.replace(/Target$/, "");
          html
            .find<HTMLInputElement>(`input[name="${adjustmentName}"][value="set-custom"]`)
            .prop("checked", true);
        });

      html.find('[data-action="apply"]').on("click", async () => {
        const applyButton = html.find<HTMLButtonElement>('[data-action="apply"]');
        if (applyButton.prop("disabled")) return;
        const newName = String(
          html.find<HTMLInputElement>('input[name="name"]').val() ?? "",
        ).trim();
        if (!newName) {
          ui.notifications?.warn(
            game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.NameRequired"),
          );
          return;
        }

        if (token.document.actorLink) {
          ui.notifications?.warn(
            game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.UnlinkedOnly"),
          );
          return;
        }

        const selectedMove = Number(
          html.find<HTMLInputElement>('input[name="move"]:checked').val(),
        );
        if (!Number.isInteger(selectedMove) || selectedMove < 2 || selectedMove > 8) {
          ui.notifications?.warn(
            game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.MoveRequired"),
          );
          return;
        }

        const selectedHitPoints = Number(
          html.find<HTMLInputElement>('input[name="hitpoints"]:checked').val(),
        );
        const hitPointStats = getStatsForHitPoints(selectedHitPoints);
        if (!hitPointStats) {
          ui.notifications?.warn(
            game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.HitpointsRequired"),
          );
          return;
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
          ui.notifications?.warn(
            game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.RoleLevelRequired"),
          );
          return;
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
          ui.notifications?.error(
            game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.ApplyFailed"),
          );
          return;
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
          ui.notifications?.warn(
            game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.DuplicateWeapon"),
          );
          return;
        }
        const weaponUpdates = getWeaponUpdates(actor, selectedWeaponIds);
        const armorResult = getArmorUpdates(actor, bodyArmor, headArmor);
        if (armorResult.missingArmor) {
          ui.notifications?.error(
            game.i18n!.format("PNEUMA_MOOK_MAKER.Form.ArmorMissing", {
              armor: armorResult.missingArmor,
            }),
          );
          return;
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
            ui.notifications?.warn(
              game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.CombatNumberRequired"),
            );
            return;
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
            ui.notifications?.warn(game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SkillAdjustmentRequired"));
            return;
          }
          if (target !== null) skillTargets[category] = target;
        }

        const bulletDodging = String(html.find<HTMLSelectElement>('select[name="bulletDodging"]').val() ?? "unchanged") as BulletDodging;
        if (!getBulletDodgingChoices().includes(bulletDodging)) {
          ui.notifications?.warn(game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.DodgeInvalid"));
          return;
        }
        const skillUpdates = getSkillUpdates(
          actor,
          skillTargets,
          hitPointStats.will,
          bulletDodging === "reflex" ? 8 : undefined,
        );

        applyButton.prop("disabled", true);
        try {
          const nameChanged = await applyMookChanges({
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
          });
          if (nameChanged) {
            ui.notifications?.info(
              game.i18n!.format("PNEUMA_MOOK_MAKER.Form.Renamed", {
                name: newName,
              }),
            );
          }
        } catch (error) {
          ui.notifications?.error(
            error instanceof Error ? error.message : game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.ApplyFailed"),
          );
          applyButton.prop("disabled", false);
          return;
        }

        dialog.close();
      });
      html.find('[data-action="cancel"]').on("click", () => dialog.close());
      html.find('[data-action="purge-gear"]').on("click", async () => {
        if (await confirmPurgeGear(token)) {
          dialog.close();
          await showMookMakerMenu(token);
        }
      });
      html.find('[data-action="promote"]').on("click", () => {
        confirmPromotion(token, dialog);
      });
      },
    },
    { width: 650 },
  );
  dialog.render(true);
}

