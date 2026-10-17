import {registerArtworkSettings} from "../token-artwork.js";
import {ensureVehicleTemplate} from "../template-spawning.js";
import {registerVehicleRotation} from "../vehicle-rotation.js";
import {registerVehicleSeats} from "../vehicle-seats.js";
import { MODULE_ID } from "./constants.js";
import { ensureMookMakerFolders } from "./folders.js";
import { registerSkillClassificationSettings } from "./skill-settings.js";
import {
  registerTemplateTokenTagging,
  registerTokenHudAction,
} from "./tokens.js";

export function registerMookMaker(): void {
  console.info(`${MODULE_ID} | Initializing`);

  registerArtworkSettings();
  registerSkillClassificationSettings();
  registerTemplateTokenTagging();
  registerVehicleRotation();
  registerVehicleSeats();
  registerTokenHudAction();
}

export async function readyMookMaker(): Promise<void> {
  console.info(`${MODULE_ID} | Ready`);
  await ensureMookMakerFolders();
  await ensureVehicleTemplate();
}
