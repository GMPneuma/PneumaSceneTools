declare const FormApplication: any;
declare const foundry: any;
declare const game: any;
declare const FilePicker: any;
declare const ui: any;
import { MODULE_ID, iconPath } from "./constants.js";
import { accessPointTypes, validateTypes } from "./types.js";
import { ensureTemplates } from "./templates.js";

export class APTypeManager extends FormApplication {
  types: any;

  constructor(...args: any[]) { super(...args); this.types = accessPointTypes({ includeDisabled: true }); }
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Manage Access Point Types", classes: ["pneuma-scanner", "pneuma-type-manager"],
      template: `modules/${MODULE_ID}/templates/type-manager.hbs`, width: 640, height: "auto",
      closeOnSubmit: true, submitOnChange: false, submitOnClose: false,
    });
  }
  getData() {
    if (!game.user.isGM) throw new Error("Only a GM can manage access point types.");
    return { types: this.types };
  }
  capture(root: any) {
    this.types = [...root.querySelectorAll("[data-type-row]")].map((row: any) => ({
      id: row.dataset.typeRow, label: row.querySelector('[data-field="label"]').value,
      img: row.querySelector('[data-field="img"]').value,
      enabled: row.querySelector('[data-field="enabled"]').checked,
    }));
  }
  activateListeners(html: any) {
    super.activateListeners(html);
    const root = html[0] ?? html;
    root.querySelector('[data-action="add-type"]').addEventListener("click", () => {
      this.capture(root);
      this.types.push({ id: foundry.utils.randomID(), label: "", img: iconPath("generic"), enabled: true });
      this.render(false);
    });
    root.querySelectorAll('[data-action="browse-type"]').forEach((button: any) => button.addEventListener("click", () => {
      const input = button.closest("[data-type-row]").querySelector('[data-field="img"]');
      new FilePicker({ type: "image", current: input.value, callback: (path: any) => { input.value = path; } }).browse();
    }));
  }
  async _updateObject() {
    if (!game.user.isGM) throw new Error("Only a GM can manage access point types.");
    try {
      this.capture(this.element[0]);
      const entries = validateTypes(this.types);
      await game.settings.set(MODULE_ID, "apTypes", { entries });
      await ensureTemplates();
    } catch (error: any) { ui.notifications.error(error.message); throw error; }
  }
}

