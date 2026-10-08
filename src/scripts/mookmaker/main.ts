import { MODULE_ID } from "./constants.js";
import { ensureMookMakerFolders } from "./folders.js";
import { registerSkillClassificationSettings } from "./skill-settings.js";
import {
  registerTemplateTokenTagging,
  registerTokenHudAction,
} from "./tokens.js";

export function registerMookMaker(): void {
  console.info(`${MODULE_ID} | Initializing`);

  registerSkillClassificationSettings();
  registerTemplateTokenTagging();
  registerTokenHudAction();
}

export async function readyMookMaker(): Promise<void> {
  console.info(`${MODULE_ID} | Ready`);
  await ensureMookMakerFolders();
}
