import {MODULE_ID} from "./settings.js";
import {ensureSceneToolsFolder} from "./world-folders.js";

export function armoredChassisData(equipped = false) {
  return {name: "Armored Chassis (armor)", type: "armor", img: "icons/svg/shield.svg",
    flags: {[MODULE_ID]: {armoredChassis: true}},
    system: {equipped: equipped ? "equipped" : "owned", isBodyLocation: true,
      bodyLocation: {sp: 13, ablation: 0}, isHeadLocation: false,
      headLocation: {sp: 0, ablation: 0}, isShield: false, penalty: 0}};
}

export async function ensureWorldChassis(): Promise<void> {
  const folder = await ensureSceneToolsFolder("Item");
  if (game.items?.some(item => foundry.utils.getProperty(item, `flags.${MODULE_ID}.armoredChassis`) === true)) return;
  const created = await Item.createDocuments([{...armoredChassisData(), folder: folder.id} as unknown as Item.CreateData]);
  if (!created?.length) throw new Error("Creating Armored Chassis was cancelled.");
}
