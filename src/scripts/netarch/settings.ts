import type {ScannerSettings} from "./data.js";
import { ensureTemplates } from "./templates.js";
import { MODULE_ID } from "./constants.js";

export const setting = <K extends keyof ScannerSettings>(key: K): ScannerSettings[K] => game.settings!.get(MODULE_ID, key) as ScannerSettings[K];

export function pulseCount() {
  const count = Number(setting("pulseCount"));
  return Number.isFinite(count) ? Math.max(1, Math.min(20, Math.floor(count))) : 5;
}
export const pulseLabel = () => { const count = pulseCount(); return `Pulse ${count} ${count === 1 ? "time" : "times"}`; };

export function registerSettings(onChange: () => void) {
  const defaults = {scope: "world", config: true, onChange} as const;
  game.settings!.register(MODULE_ID, "apTypes", {...defaults, config: false, type: Object, default: {} });
  Hooks.on("renderSettingsConfig", (_app: SettingsConfig, html: JQuery) => groupRevealSettings(html));
  game.settings!.register(MODULE_ID, "revealStyle", {...defaults,
    name: "AP reveal style", hint: "Show AP artwork over fog, or also provide a small circle of vision around it.",
    type: String, default: "fog", choices: { fog: "Above fog of war", vision: "Small vision circle" },
  });
  game.settings!.register(MODULE_ID, "visionRadius", {...defaults,
    name: "Vision-circle radius", hint: "Measured in the scene's distance units. A value of 0.5 means half a meter on meter-based maps.",
    type: Number, default: 0.5, range: { min: 0.1, max: 10, step: 0.1 },
  });
  game.settings!.register(MODULE_ID, "scannerRadius", {...defaults,
    name: "Default Scanner selection radius", hint: "A GM selection filter, not a rules limit. Zero lists every AP. Adjustable in the Scanner window.",
    type: Number, default: 0,
  });
  // Use the former preference as the default until the positive option is saved.
  game.settings!.register(MODULE_ID, "hideRevealAll", {...defaults, config: false, type: Boolean, default: false });
  game.settings!.register(MODULE_ID, "showRevealAll", {...defaults, name: "Show 'Reveal to all' option", hint: "Show the Reveal to all column and bulk checkbox in the Scanner window. Existing discoveries are unchanged.", type: Boolean, default: !setting("hideRevealAll") });
  game.settings!.register(MODULE_ID, "autoPulse", {...defaults, name: "Pulse when revealing an AP", type: Boolean, default: true });
  game.settings!.register(MODULE_ID, "pulseCount", {...defaults, name: "Number of pulses", hint: "Used by finite pulses and the Scanner checkbox labels. Looping is selected in the AP list.", type: Number, default: 5, range: { min: 1, max: 20, step: 1 } });
  game.settings!.register(MODULE_ID, "pulseDuration", {...defaults, name: "Seconds per pulse", hint: "Lower values pulse faster. Saving updates running pulses as well as new pulses.", onChange: async (value: number) => { try { const { updateActivePulseSpeed } = await import("./actions.js"); await updateActivePulseSpeed(value); } catch (error) { ui.notifications?.error((error instanceof Error ? error.message : String(error))); } finally { onChange?.(); } }, type: Number, default: 1.4, range: { min: 0.4, max: 5, step: 0.1 } });
  // Retained only as the fallback for APs created before per-token name controls.
  game.settings!.register(MODULE_ID, "showLabels", {...defaults, config: false, type: Boolean, default: true });
  game.settings!.register(MODULE_ID, "autoScanner", {...defaults, name: "Open GM controls after a Scanner roll", type: Boolean, default: true });
  game.settings!.register(MODULE_ID, "netarchColors", {...defaults, config: false, type: Object, default: { entries: [] } });
}

export function groupRevealSettings(html: JQuery | HTMLElement) {
  const root = html instanceof HTMLElement ? html : html[0]!;
  const style = root.querySelector<HTMLInputElement>(`[name="${MODULE_ID}.revealStyle"]`);
  const radius = root.querySelector(`[name="${MODULE_ID}.visionRadius"]`);
  if (!style || !radius || style.closest(".pneuma-ap-reveal-settings")) return;
  const styleRow = style.closest(".form-group"), radiusRow = radius.closest(".form-group");
  if (!styleRow || !radiusRow) return;
  const group = document.createElement("fieldset");
  group.className = "pneuma-ap-reveal-settings";
  const legend = document.createElement("legend");
  legend.textContent = "Access point visibility";
  group.append(legend);
  styleRow.before(group);
  group.append(styleRow, radiusRow);
  if (game.user!.isGM) {
    const row = document.createElement("div");
    row.className = "form-group";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Re-create default AP templates";
    button.title = "Create missing default templates. Existing templates are found in any Actor folder and are preserved.";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const count = await ensureTemplates({ defaults: true, manual: true });
        ui.notifications?.info(count ? `Created ${count} missing AP templates.` : "All default AP templates already exist.");
      } catch (error) { ui.notifications?.error((error instanceof Error ? error.message : String(error))); }
      finally { button.disabled = false; }
    });
    row.append(button);
    group.after(row);
  }
  const sync = () => {
    const disabled = style.value !== "vision";
    radiusRow.querySelectorAll("input").forEach((input) => { input.disabled = disabled; });
    radiusRow.classList.toggle("ap-radius-disabled", disabled);
  };
  style.addEventListener("change", sync);
  sync();
}
