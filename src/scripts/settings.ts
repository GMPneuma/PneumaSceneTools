export const MODULE_ID = "pneuma-scenetools";
declare global {
  interface SettingConfig {
    "pneuma-scenetools.defaultGrid": number;
    "pneuma-scenetools.defaultDarkness": number;
    "pneuma-scenetools.defaultGlobalLight": boolean;
  }
}
export function registerDefaults() {
  game.settings!.register(MODULE_ID, "defaultGrid", {name: "Default grid size", hint: "Pixels per square. Breaks ties between equally plausible image suggestions.", scope: "world", config: true, type: Number, default: 100, range: {min: 50, max: 500, step: 1}});
  game.settings!.register(MODULE_ID, "defaultDarkness", {name: "Default scene darkness", scope: "world", config: true, type: Number, default: 0, range: {min: 0, max: 1, step: 0.05}});
  game.settings!.register(MODULE_ID, "defaultGlobalLight", {name: "Default global illumination", scope: "world", config: true, type: Boolean, default: true});
}

