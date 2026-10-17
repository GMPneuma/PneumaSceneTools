import {registerFeature} from "./lifecycle.js";
import {registerPatrolRuntime} from "./patrol-runtime.js";
import {openPatrols, registerPatrolUI} from "./patrol-ui.js";
registerFeature({name:"Patrol",register(){registerPatrolRuntime();registerPatrolUI();return {openPatrols};},async ready(){}});
import {registerModularCreator} from "./modular-creator.js";
registerFeature({name: "Modular Scene Creator", register: registerModularCreator, async ready() {}});
import "./traps/main.js";
import {registerMapPins} from "./map-pins.js";
import {registerDefaults} from "./settings.js";
import {registerSettingsLayout} from "./settings-layout.js";
import {openSceneCreator, registerSceneCreator} from "./creator.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";
export {MODULE_ID} from "./settings.js";
registerFeature({name: "Map pinning", register: registerMapPins, async ready() {}});
registerFeature({
  name: "Quick Scene Importer",
  register() { registerSettingsLayout(); registerDefaults(); registerSceneCreator(); return {openSceneCreator}; },
  async ready() {
    if (game.user?.isGM && game.users?.activeGM?.id === game.user.id) await ensureSceneToolsFolder("Scene",WORLD_FOLDERS.scenes);
  },
});
