import {registerFeature} from "./lifecycle.js";
import {registerDefaults} from "./settings.js";
import {openSceneCreator, registerSceneCreator} from "./creator.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";
export {MODULE_ID} from "./settings.js";
registerFeature({
  name: "Scene Creator",
  register() { registerDefaults(); registerSceneCreator(); return {openSceneCreator}; },
  async ready() {
    if (game.user?.isGM && game.users?.activeGM?.id === game.user.id) await ensureSceneToolsFolder("Scene",WORLD_FOLDERS.scenes);
  },
});
