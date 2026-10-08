import type {ScannerChatClass, ScannerRoll, ScannerOptions} from "./data.js";
import { MODULE_ID, SYSTEM_ID } from "./constants.js";
import { scanContext } from "./model.js";
import { activeGM } from "./templates.js";
import { setting } from "./settings.js";

const wrappedChatClasses = new WeakSet<ScannerChatClass>();

/** Decorate completed native roll cards; do not replace any system roll mechanics. */
export function wrapRollCards(chatClass: ScannerChatClass) {
  const original = chatClass.RenderRollCard;
  if (wrappedChatClasses.has(chatClass)) return;
  if (typeof original !== "function") throw new Error("The Cyberpunk RED roll-card entry point is unavailable.");
  if (typeof globalThis.libWrapper?.register !== "function") throw new Error("Enable libWrapper to use NetArch Scanner.");
  // Expose the imported class itself so libWrapper wraps the actual system method.
  globalThis.pneumaSceneToolsNetArchCompat = {chatClass};
  const wrapper = function(this: ScannerChatClass, wrapped: ScannerChatClass["RenderRollCard"], roll: ScannerRoll, ...args: unknown[]) {
    const context = scanContext(roll, canvas.scene?.id);
    const result = wrapped(roll, ...args);
    if (!context) return result;
    return Promise.resolve(result).then(async (message) => {
      if (!message) return message;
      try { await message.setFlag(MODULE_ID, "scan", context); }
      catch (error) {
        console.error(`${MODULE_ID} | Could not attach Scanner controls`, error);
        ui.notifications?.warn("Scanner rolled, but AP controls could not open. The GM can open them from the token toolbar.");
      }
      return message;
    });
  };
  libWrapper.register(MODULE_ID, "pneumaSceneToolsNetArchCompat.chatClass.RenderRollCard", wrapper, "WRAPPER");
  wrappedChatClasses.add(chatClass);
}

export async function installScannerIntegration() {
  const path = foundry.utils.getRoute(`systems/${SYSTEM_ID}/modules/chat/cpr-chat.js`);
  const { default: chatClass } = await import(path);
  wrapRollCards(chatClass);
}

export function resolveScan(message: ChatMessage) {
  const scan = message.getFlag(MODULE_ID, "scan");
  if (!scan || typeof scan.actorId !== "string" || !Number.isFinite(scan.total)) return null;
  const scene = game.scenes!.get(scan.sceneId ?? "") as Scene | undefined;
  if (!scene) return null;
  const explicit = scene.tokens.get(scan.tokenId ?? "");
  const matches = scene.tokens.filter((doc) => doc.actorId === scan.actorId);
  // A world-sheet roll with two copies of an Actor needs a GM token choice.
  const runnerId = explicit?.actorId === scan.actorId ? explicit!.id! : matches.length === 1 ? matches[0]!.id! : "";
  return { scene, runnerId, result: scan.total, messageId: message.id };
}

export function registerScannerHooks(openScanner: (options: ScannerOptions) => unknown) {
  const handled = new Set<string>();
  Hooks.on("updateChatMessage", (message: ChatMessage, changes: object) => {
    if (!game.user!.isGM || activeGM()?.id !== game.user!.id || !setting("autoScanner")) return;
    const path = `flags.${MODULE_ID}.scan`;
    if (!(foundry.utils.hasProperty(changes, path) || Object.hasOwn(changes, path)) || handled.has(message.id!)) return;
    const context = resolveScan(message);
    if (!context) return;
    handled.add(message.id!);
    if (handled.size > 250) handled.delete(handled.values().next().value!);
    try { openScanner(context); }
    catch (error) { console.error(`${MODULE_ID} | Scanner controls`, error); ui.notifications?.error((error instanceof Error ? error.message : String(error))); }
  });
  Hooks.on("renderChatMessage", (message: ChatMessage, html: JQuery) => {
    if (!game.user!.isGM || !message.getFlag(MODULE_ID, "scan")) return;
    const root = html[0]!;
    if (root!.querySelector(".pneuma-open-scanner")) return;
    const button = document.createElement("button");
    button.type = "button"; button.className = "pneuma-open-scanner";
    button.textContent = "Reveal Access Points to Netrunner";
    button.addEventListener("click", () => {
      const context = resolveScan(message);
      if (context) openScanner(context);
      else ui.notifications?.warn("The Scanner scene is no longer available. Open controls from the current scene's token toolbar.");
    });
    (root.querySelector(".message-content") ?? root!).append(button);
  });
}

