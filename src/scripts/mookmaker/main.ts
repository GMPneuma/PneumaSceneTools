import { MODULE_ID, SUPPORTED_SYSTEM_ID } from "./constants.js";
import { ensureMookMakerFolders } from "./folders.js";
import { registerSkillClassificationSettings } from "./skill-settings.js";
import {
  registerTemplateTokenTagging,
  registerTokenHudAction,
} from "./tokens.js";

export interface PneumaMookMakerApi {
  readonly moduleId: typeof MODULE_ID;
}

export function registerMookMaker(): void {
  console.info(`${MODULE_ID} | Initializing`);

  registerSkillClassificationSettings();
  if (game.system?.id === SUPPORTED_SYSTEM_ID) {
    registerTemplateTokenTagging();
    registerTokenHudAction();
  }
}

export async function readyMookMaker(): Promise<void> {
  console.info(`${MODULE_ID} | Ready`);
  if (game.system?.id !== SUPPORTED_SYSTEM_ID) {
    const message = `${MODULE_ID} requires the Cyberpunk RED Core system (${SUPPORTED_SYSTEM_ID}).`;
    console.error(`${MODULE_ID} | ${message}`);
    ui.notifications?.error(message, { permanent: true });
    return;
  }
  await ensureMookMakerFolders();
}
