import {registerSceneCreator} from "./creator.js";
import {registerDefaults} from "./settings.js";
import {MODULE_ID} from "./settings.js";
import {openSceneCreator} from "./creator.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";
import {registerMookMaker, readyMookMaker} from "./mookmaker/main.js";
import {registerNetArchScanner, readyNetArchScanner, netArchScannerApi} from "./netarch/main.js";
export {MODULE_ID} from "./settings.js";

const supported = () => game.system?.id === "cyberpunk-red-core" && Number(game.release?.generation) === 12;
function registerFeature(name: string, register: () => void) {
  try { register(); }
  catch (error) { console.error(`${MODULE_ID} | ${name} initialization failed`, error); ui.notifications?.error(`${name} initialization failed. See the console.`); }
}

Hooks.once("init", () => {
  registerDefaults();
  registerSceneCreator();
  if (!supported()) return;
  registerFeature("MookMaker", registerMookMaker);
  registerFeature("NetArch Scanner", registerNetArchScanner);
  const module = game.modules?.get(MODULE_ID) as unknown as {api?: object} | undefined;
  if (module) {
    const scanner = netArchScannerApi();
    module.api = Object.freeze({moduleId: MODULE_ID, openSceneCreator, ensureFolder: ensureSceneToolsFolder,
      folders: WORLD_FOLDERS, mookMaker: {moduleId: MODULE_ID}, netArchScanner: scanner, ...scanner});
  }
});

Hooks.once("ready", async () => {
  if (game.user?.isGM) {
    try { await ensureSceneToolsFolder("Scene", WORLD_FOLDERS.scenes); }
    catch (error) { console.error(`${MODULE_ID} | Scene folder startup failed`, error); ui.notifications?.error("SceneTools scene folders could not be created. See the console."); }
  }
  if (!supported()) return;
  for (const ready of [readyMookMaker, readyNetArchScanner]) {
    try { await ready(); }
    catch (error) { console.error(`${MODULE_ID} | Feature startup failed`, error); ui.notifications?.error("SceneTools feature startup failed. See the console."); }
  }
});
