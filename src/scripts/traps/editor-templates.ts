import {MODULE_ID} from "../settings.js";

export const hazardEditorPartials = ["hazard-field", "hazard-button", "hazard-controls", "hazard-sidebar", "hazard-effects", "hazard-access-point", "hazard-trigger-summary", "hazard-effect-editor", "hazard-trigger-editor"].map(name => `modules/${MODULE_ID}/templates/${name}.hbs`);
export async function loadHazardEditorTemplates(): Promise<void> {
  await loadTemplates(hazardEditorPartials);
}
