import { MODULE_ID } from "./constants.js";
import {
  DEFAULT_SKILL_CLASSIFICATIONS,
  getSkillClassificationRows,
  normalizeSkillKey,
  saveSkillClassifications,
  type SkillCategory,
  type SkillClassifications,
} from "./skill-settings.js";

export class SkillClassificationForm extends FormApplication {
  static override get defaultOptions(): FormApplication.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "pneuma-mook-maker-skill-classifications",
      classes: ["pneuma-mook-maker", "pneuma-mook-maker-skill-config"],
      title: "PNEUMA_MOOK_MAKER.Settings.SkillClassifications.Title",
      template: `modules/${MODULE_ID}/templates/skill-classifications.hbs`,
      width: 520,
      height: 680,
      closeOnSubmit: true,
      submitOnChange: false,
    });
  }

  override getData(): object {
    return {
      skills: getSkillClassificationRows().map((skill) => ({
        ...skill,
        isCombat: skill.category === 1,
        isSecondary: skill.category === 2,
        isTertiary: skill.category === 3,
      })),
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const filter = html.find<HTMLInputElement>('[data-action="filter-skills"]');
    filter.on("input", () => {
      const query = String(filter.val() ?? "").trim().toLocaleLowerCase();
      html.find<HTMLElement>("[data-skill-row]").each((_index, row) => {
        const name = row.dataset.skillName?.toLocaleLowerCase() ?? "";
        row.hidden = Boolean(query) && !name.includes(query);
      });
    });
    html.find('[data-action="reset-skill-classifications"]').on("click", async () => {
      const defaults: SkillClassifications = {};
      for (const row of getSkillClassificationRows()) {
        const key = normalizeSkillKey(row.name);
        defaults[key] = DEFAULT_SKILL_CLASSIFICATIONS[row.name]
          ?? DEFAULT_SKILL_CLASSIFICATIONS[key]
          ?? (key.includes("martial arts") ? 1 : 3);
      }
      await saveSkillClassifications(defaults);
      this.render(true);
      ui.notifications?.info(
        game.i18n!.localize("PNEUMA_MOOK_MAKER.Settings.SkillClassifications.ResetComplete"),
      );
    });
  }

  protected override async _updateObject(
    _event: Event,
    formData: Record<string, unknown>,
  ): Promise<void> {
    const classifications: SkillClassifications = {};
    for (const row of getSkillClassificationRows()) {
      const value = Number(formData[row.key]);
      if (value === 1 || value === 2 || value === 3) {
        classifications[row.key] = value as SkillCategory;
      }
    }
    await saveSkillClassifications(classifications);
    ui.notifications?.info(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Settings.SkillClassifications.Saved"),
    );
  }
}

