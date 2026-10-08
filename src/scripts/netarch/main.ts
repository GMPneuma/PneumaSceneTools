import { MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { ensureTemplates, registerTokenGuards } from "./templates.js";
import { APPresentation } from "./presentation.js";
import { APEditor, openScanner, refreshPanels, registerUI } from "./ui.js";
import { hideAPs, pulseAPs, requireGM, revealAPs, stopPulses } from "./actions.js";
import { installScannerIntegration, registerScannerHooks } from "./scanner.js";

import { APTypeManager } from "./type-manager.js";

const presentation = new APPresentation();

export function registerNetArchScanner() {
  registerSettings(() => { presentation.queueRefresh(); refreshPanels(); });
  game.settings!.registerMenu(MODULE_ID, "manageTypes", { name: "Access point types", label: "Manage Types", hint: "Add, rename, disable, and choose artwork for AP types.", icon: "fas fa-list", type: APTypeManager, restricted: true });
  registerTokenGuards();
  registerUI();
  presentation.registerHooks();
  registerScannerHooks(openScanner);
}

export function netArchScannerApi() {
  return Object.freeze({
    openScanner, reveal: revealAPs, hide: hideAPs, pulse: pulseAPs, stopPulses,
    ensureTemplates,
    edit: (tokenDocument: TokenDocument) => { requireGM(); return new APEditor(tokenDocument).render(true); },
  });
}

export async function readyNetArchScanner() {
  try { await installScannerIntegration(); }
  catch (error) {
    console.error(`${MODULE_ID} | Scanner integration`, error);
    if (game.user!.isGM) ui.notifications?.warn("Automatic Scanner integration is unavailable. Use the Scanner button in the token toolbar.", { permanent: true });
  }
  await ensureTemplates();
  if (canvas.ready) presentation.queueRefresh();
  console.info(`${MODULE_ID} | Ready`);
}

