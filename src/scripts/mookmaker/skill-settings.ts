import { MODULE_ID } from "./constants.js";
import { SkillClassificationForm } from "./skill-classification-form.js";

export type SkillCategory = 1 | 2 | 3;
export type SkillClassifications = Record<string, SkillCategory>;

const SETTING_KEY = "skillClassifications";
const PURGE_CONFIRMATION_SETTING_KEY = "confirmPurgeGear";
const SHOW_TOKEN_CONTROLS_SETTING_KEY = "showTokenControls";
const PURGE_AMMUNITION_SETTING_KEY = "purgeAmmunition";
const RETAIN_WEAPON_AMMUNITION_SETTING_KEY = "retainWeaponAmmunition";
const CIVILIAN_COMBAT_NUMBER_SETTING_KEY = "civilianCombatNumber";

export const DEFAULT_SKILL_CLASSIFICATIONS: SkillClassifications = {
  Accounting: 3,
  Acting: 2,
  "Air Vehicle Tech": 2,
  "Animal Handling": 3,
  Archery: 1,
  Athletics: 2,
  Autofire: 1,
  "Basic Tech": 3,
  Brawling: 1,
  Bribery: 3,
  Bureaucracy: 3,
  Business: 3,
  Composition: 3,
  "Conceal/Reveal Object": 2,
  Concentration: 2,
  Contortionist: 3,
  Conversation: 2,
  Criminology: 3,
  Cryptography: 3,
  Cybertech: 3,
  Dance: 3,
  Deduction: 2,
  Demolitions: 2,
  "Drive Land Vehicle": 2,
  Education: 2,
  "Electronics/Security Tech": 2,
  Endurance: 2,
  Evasion: 1,
  "First Aid": 2,
  Forgery: 3,
  Gamble: 3,
  Handgun: 1,
  "Heavy Weapons": 1,
  "Human Perception": 3,
  Interrogation: 3,
  "Land Vehicle Tech": 3,
  "Language (Streetslang)": 3,
  "Library Search": 3,
  "Lip Reading": 3,
  "Local Expert (Your Home)": 3,
  "Melee Weapon": 1,
  "Paint/Draw/Sculpt": 3,
  Paramedic: 3,
  Perception: 2,
  "Personal Grooming": 3,
  Persuasion: 3,
  "Photography/Film": 3,
  "Pick Lock": 2,
  "Pick Pocket": 2,
  "Pilot Air Vehicle": 2,
  "Pilot Sea Vehicle": 2,
  "Resist Torture/Drugs": 2,
  Riding: 3,
  "Sea Vehicle Tech": 2,
  "Shoulder Arms": 1,
  Stealth: 1,
  Streetwise: 3,
  Tactics: 2,
  Tracking: 3,
  Trading: 3,
  "Wardrobe & Style": 3,
  Weaponstech: 3,
  "Wilderness Survival": 3,
};

/** Creates a durable lookup key while preserving the user-facing skill name. */
export function normalizeSkillKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeClassifications(
  classifications: SkillClassifications,
): SkillClassifications {
  return Object.fromEntries(
    Object.entries(classifications).map(([name, category]) => [
      normalizeSkillKey(name),
      category,
    ]),
  );
}

function getKnownSkillNames(): string[] {
  const names = new Map<string, string>();
  for (const name of Object.keys(DEFAULT_SKILL_CLASSIFICATIONS)) {
    names.set(normalizeSkillKey(name), name);
  }
  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) {
      if (String(item.type) === "skill" && item.name) {
        names.set(normalizeSkillKey(item.name), item.name);
      }
    }
  }
  return Array.from(names.values()).sort((left, right) => left.localeCompare(right));
}

export interface SkillClassificationRow {
  key: string;
  name: string;
  category: SkillCategory;
}

export function getSkillClassificationRows(): SkillClassificationRow[] {
  const classifications = getSkillClassifications();
  return getKnownSkillNames().map((name) => {
    const key = normalizeSkillKey(name);
    return {
      key,
      name,
      category: classifications[key] ?? (key.includes("martial arts") ? 1 : 3),
    };
  });
}

type SettingsApi = {
  get(scope: string, key: string): unknown;
  register(scope: string, key: string, data: object): void;
};

function getSettingsApi(): SettingsApi {
  return game.settings as unknown as SettingsApi;
}

export function getSkillClassifications(): SkillClassifications {
  const stored = getSettingsApi().get(MODULE_ID, SETTING_KEY) as
    | SkillClassifications
    | undefined;
  const classifications: SkillClassifications = {
    ...normalizeClassifications(DEFAULT_SKILL_CLASSIFICATIONS),
    ...normalizeClassifications(stored ?? {}),
  };

  for (const name of getKnownSkillNames()) {
    const key = normalizeSkillKey(name);
    if (key.includes("martial arts") && classifications[key] === undefined) {
      classifications[key] = 1;
    }
  }

  return classifications;
}

export function isPurgeConfirmationEnabled(): boolean {
  return getSettingsApi().get(MODULE_ID, PURGE_CONFIRMATION_SETTING_KEY) === true;
}

export function areTokenControlsVisible(): boolean {
  return getSettingsApi().get(MODULE_ID, SHOW_TOKEN_CONTROLS_SETTING_KEY) !== false;
}

export function isPurgeAmmunitionEnabled(): boolean {
  return getSettingsApi().get(MODULE_ID, PURGE_AMMUNITION_SETTING_KEY) === true;
}

export function isRetainWeaponAmmunitionEnabled(): boolean {
  return getSettingsApi().get(MODULE_ID, RETAIN_WEAPON_AMMUNITION_SETTING_KEY) !== false;
}

export function getCivilianCombatNumber(): number {
  const value = Number(
    getSettingsApi().get(MODULE_ID, CIVILIAN_COMBAT_NUMBER_SETTING_KEY),
  );
  return Number.isInteger(value) && value >= 4 && value <= 18 ? value : 6;
}

export async function saveSkillClassifications(
  classifications: SkillClassifications,
): Promise<void> {
  await (game.settings as unknown as {
    set(scope: string, key: string, value: unknown): Promise<unknown>;
  }).set(MODULE_ID, SETTING_KEY, normalizeClassifications(classifications));
}

export function registerSkillClassificationSettings(): void {
  const settings = getSettingsApi();
  settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: normalizeClassifications(DEFAULT_SKILL_CLASSIFICATIONS),
    onChange: () => {
      console.info(`${MODULE_ID} | Skill classifications updated`);
    },
  });
  (game.settings as unknown as {
    registerMenu(scope: string, key: string, data: object): void;
  }).registerMenu(MODULE_ID, "skillClassificationsMenu", {
    name: "PNEUMA_MOOK_MAKER.Settings.SkillClassifications.Name",
    hint: "PNEUMA_MOOK_MAKER.Settings.SkillClassifications.Hint",
    label: "PNEUMA_MOOK_MAKER.Settings.SkillClassifications.Button",
    icon: "fas fa-list-check",
    type: SkillClassificationForm,
    restricted: true,
  });
  settings.register(MODULE_ID, PURGE_CONFIRMATION_SETTING_KEY, {
    name: "PNEUMA_MOOK_MAKER.Settings.ConfirmPurge.Name",
    hint: "PNEUMA_MOOK_MAKER.Settings.ConfirmPurge.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  settings.register(MODULE_ID, SHOW_TOKEN_CONTROLS_SETTING_KEY, {
    name: "PNEUMA_MOOK_MAKER.Settings.ShowTokenControls.Name",
    hint: "PNEUMA_MOOK_MAKER.Settings.ShowTokenControls.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  settings.register(MODULE_ID, PURGE_AMMUNITION_SETTING_KEY, {
    name: "PNEUMA_MOOK_MAKER.Settings.PurgeAmmunition.Name",
    hint: "PNEUMA_MOOK_MAKER.Settings.PurgeAmmunition.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
  settings.register(MODULE_ID, RETAIN_WEAPON_AMMUNITION_SETTING_KEY, {
    name: "PNEUMA_MOOK_MAKER.Settings.RetainWeaponAmmunition.Name",
    hint: "PNEUMA_MOOK_MAKER.Settings.RetainWeaponAmmunition.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  settings.register(MODULE_ID, CIVILIAN_COMBAT_NUMBER_SETTING_KEY, {
    name: "PNEUMA_MOOK_MAKER.Settings.CivilianCombatNumber.Name",
    hint: "PNEUMA_MOOK_MAKER.Settings.CivilianCombatNumber.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 6,
    range: { min: 4, max: 18, step: 1 },
  });
}
