import type {APType} from "./data.js";
import { MODULE_ID, iconPath } from "./constants.js";
import { accessPointTypes, validateTypes } from "./types.js";
import { ensureTemplates } from "./templates.js";

export class APTypeManager extends FormApplication {
  types: APType[];

  constructor(object = {}, options: Partial<FormApplicationOptions> = {}) { super(object, options); this.types = accessPointTypes({ includeDisabled: true }); }
  static override get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Manage Access Point Types", classes: ["pneuma-scanner", "pneuma-type-manager"],
      template: `modules/${MODULE_ID}/templates/type-manager.hbs`, width: 640, height: "auto",
      closeOnSubmit: true, submitOnChange: false, submitOnClose: false,
    }) as FormApplicationOptions;
  }
  override getData() {
    if (!game.user!.isGM) throw new Error("Only a GM can manage access point types.");
    return { types: this.types };
  }
  capture(root: HTMLElement) {
    this.types = [...root.querySelectorAll<HTMLInputElement>("[data-type-row]")].map((row) => ({
      id: row.dataset.typeRow!, label: row.querySelector<HTMLInputElement>('[data-field="label"]')!.value,
      img: row.querySelector<HTMLInputElement>('[data-field="img"]')!.value,
      enabled: row.querySelector<HTMLInputElement>('[data-field="enabled"]')!.checked,
    }));
  }
  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    const root = html[0]!;
    root.querySelector<HTMLInputElement>('[data-action="add-type"]')!.addEventListener("click", () => {
      this.capture(root);
      this.types.push({ id: foundry.utils.randomID(), label: "", img: iconPath("generic"), enabled: true });
      this.render(false);
    });
    root.querySelectorAll<HTMLInputElement>('[data-action="browse-type"]').forEach((button) => button.addEventListener("click", () => {
      const input = button.closest<HTMLElement>("[data-type-row]")!.querySelector<HTMLInputElement>('[data-field="img"]')!;
      new FilePicker({ type: "image", current: input.value, callback: (path) => { input.value = path; } }).browse();
    }));
  }
  protected override async _updateObject() {
    if (!game.user!.isGM) throw new Error("Only a GM can manage access point types.");
    try {
      this.capture(this.element[0]!);
      const entries = validateTypes(this.types);
      await game.settings!.set(MODULE_ID, "apTypes", { entries });
      await ensureTemplates();
    } catch (error) { ui.notifications?.error((error instanceof Error ? error.message : String(error))); throw error; }
  }
}

