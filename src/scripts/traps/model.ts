export const TRAP_VERSION = 1;
export const HAZARD_ICON = "modules/pneuma-scenetools/assets/hazard-sign.svg";
export const COUNTER_SKILL = "Electronics/Security Tech";
export type Trigger = "enter" | "move" | "turnStart" | "turnEnd" | "deviceTurn" | "detect" | "manual";
export type HazardType = "active" | "emplaced" | "environmental" | "notification";
export type ActionKind = "damage" | "status" | "movePenalty" | "attack" | "door" | "relocate" | "notice" | "triggerHazard" | "direct" | "spawnCondition";
interface ActionBase {
  name: string;
  resistSkill: string;
  resistDV: number;
}
interface EffectDuration {
  seconds: number;
  untilExit: boolean;
  endOnDamage: boolean;
}
interface DamageFields {
  formula: string;
  armor: "full" | "half" | "ignore";
  ablation: number;
}
interface ConditionFields {
  hp: number;
  statuses: string[];
  moveReduction: number;
}
export type TrapAction = ActionBase & (({
  kind: "damage";
} & DamageFields) | ({
  kind: "status";
  status: string;
} & EffectDuration) | ({
  kind: "movePenalty";
  formula: string;
  moveReduction: number;
} & EffectDuration) | {
  kind: "attack";
  actorId: string;
  weapon: string;
} | {
  kind: "door";
  wallIds: string[];
} | {
  kind: "relocate";
  elevation: number;
} | {
  kind: "notice";
} | {
  kind: "triggerHazard";
  hazardId: string;
} | ({
  kind: "direct";
} & DamageFields & ConditionFields & EffectDuration) | ({
  kind: "spawnCondition";
  actorTemplateId: string;
} & ConditionFields & EffectDuration));
export type ActionOf<K extends ActionKind> = Extract<TrapAction, {
  kind: K;
}>;
export const actionFormula = (action: TrapAction): string => "formula" in action ? action.formula : "";
export interface TrapConfig {
  tokenIcon: string;
  hazardActorTemplateId: string;
  hazardType: HazardType;
  triggers: Trigger[];
  triggerRegionId: string;
  hp: number;
  bodyId: string;
  targetMode: "triggering" | "region";
  version: 1;
  name: string;
  notes: string;
  armed: boolean;
  targets: "players" | "all";
  minElevation: number;
  maxElevation: number;
  distance: number;
  range: number;
  walls: boolean;
  darkness: boolean;
  check: string;
  dv: number;
  spotDV: number;
  disarmSkill: string;
  disarmDV: number;
  disarmSeconds: number;
  actions: TrapAction[];
  deviceId: string;
  anchor: {
    x: number;
    y: number;
  };
  apType: string;
  apId: string;
  moveProgress: Record<string, number>;
  detected: string[];
  engaged: string[];
  deviceTemplate: DeviceTemplate | null;
}
export const triggersOf = (t: TrapConfig): Trigger[] => t.triggers;
export const hasTrigger = (t: TrapConfig, trigger: Trigger) => triggersOf(t).includes(trigger);
export const hazardTypeOf = (t: TrapConfig): HazardType => t.hazardType;
export interface DeviceTemplate {
  name: string;
  type: "character" | "mook";
  img: string;
  system: Record<string, unknown>;
  items: Record<string, unknown>[];
}
export interface Point {
  x: number;
  y: number;
}
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Expected an object.");
  return v as Record<string, unknown>;
};
const str = (v: unknown, max = 4000): string => {
  if (typeof v !== "string" || v.length > max)
    throw Error("Invalid text field."); return v;
};
const num = (v: unknown, min = -1e7, max = 1e7): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error("Invalid numeric field."); return v;
};
const bool = (v: unknown): boolean => {
  if (typeof v !== "boolean")
    throw Error("Invalid checkbox field."); return v;
};
const choice = <T extends string>(v: unknown, list: readonly T[]): T => {
  if (!list.includes(v as T))
    throw Error("Invalid option."); return v as T;
};
const strings = (v: unknown): string[] => {
  if (!Array.isArray(v) || v.length > 100)
    throw Error("Invalid links."); return [...new Set(v.map(x => str(x, 100)))];
};
export function blankAction(): ActionOf<"notice">;
export function blankAction<K extends ActionKind>(kind: K): ActionOf<K>;
export function blankAction(kind: ActionKind = "notice"): TrapAction {
  return validateAction({kind});
}
export function blankTrap(): TrapConfig {
  return {
    tokenIcon: HAZARD_ICON, hazardActorTemplateId: "", triggerRegionId: "", hp: 0, bodyId: "", targetMode: "triggering", version: 1, hazardType: "emplaced", triggers: ["enter"], name: "New hazard", notes: "", armed: false, targets: "players", minElevation: -1e7,
    maxElevation: 1e7, distance: 0, range: 0, walls: true, darkness: false,
    check: "", dv: 0, spotDV: 0, disarmSkill: COUNTER_SKILL, disarmDV: 0, disarmSeconds: 0, actions: [],
    deviceId: "", anchor: {x: 0, y: 0}, apType: "", apId: "",
    moveProgress: {}, detected: [], engaged: [], deviceTemplate: null
  };
}
export function validateDevice(input: unknown): DeviceTemplate | null {
  if (input === null)
    return null;
  const value = object(input);
  if (!["character", "mook"].includes(String(value.type)) || !Array.isArray(value.items) || value.items.length > 500)
    throw Error("Invalid hazard actor template.");
  const clean = (v: unknown): unknown => {
    if (Array.isArray(v))
      return v.map(clean);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v).filter(([key]) => !["__proto__", "constructor", "prototype", "flags", "ownership", "folder", "_stats", "origin"].includes(key)).map(([key, value]) => [key, clean(value)]));
    return v;
  };
  const img = str(value.img, 1000);
  if (/^(?:javascript|data):/i.test(img))
    throw Error("Use a file path for hazard actor artwork.");
  return {
    name: str(value.name, 120), type: value.type as DeviceTemplate["type"], img, system: clean(object(value.system)) as Record<string, unknown>,
    items: value.items.map(i => {
      const item = object(i);
      return {
        ...(typeof item._id === "string" && /^[a-zA-Z0-9]{16}$/.test(item._id) ? {_id: item._id} : {}), name: str(item.name, 120), type: str(item.type, 100), img: typeof item.img === "string" ? item.img : "icons/svg/item-bag.svg",
        system: clean(object(item.system)), effects: Array.isArray(item.effects) ? clean(item.effects) : []
      };
    })
  };
}
export function validateAction(input: unknown): TrapAction {
  const a = object(input);
  const kind = choice<ActionKind>(a.kind, ["damage", "status", "movePenalty", "attack", "door", "relocate", "notice", "triggerHazard", "direct", "spawnCondition"]);
  const base = {name: str(a.name ?? ""), resistSkill: str(a.resistSkill ?? "", 120), resistDV: num(a.resistDV ?? 0, 0)};
  const formula = str(a.formula ?? "", 120);
  // Portable presets accept dice arithmetic, never executable macros or document references.
  if (formula && !/^[\d\s+dD*\/().-]+$/.test(formula))
    throw Error("Use dice arithmetic only (for example 1d6 + 2).");
  const duration = () => ({seconds: num(a.seconds ?? 0, 0), untilExit: bool(a.untilExit ?? false), endOnDamage: bool(a.endOnDamage ?? false)});
  const damage = () => ({formula, armor: choice(a.armor ?? "full", ["full", "half", "ignore"]), ablation: num(a.ablation ?? 0, 0, 100)});
  const condition = () => ({hp: num(a.hp ?? 0, 0), statuses: strings(a.statuses ?? []), moveReduction: num(a.moveReduction ?? 0, 0)});
  switch (kind) {
    case "damage": return {...base, kind, ...damage()};
    case "status": return {...base, kind, status: str(a.status ?? "", 100), ...duration()};
    case "movePenalty": return {...base, kind, formula, moveReduction: num(a.moveReduction ?? 0, 0), ...duration()};
    case "attack": return {...base, kind, actorId: str(a.actorId ?? "", 100), weapon: str(a.weapon ?? "", 120)};
    case "door": return {...base, kind, wallIds: strings(a.wallIds ?? [])};
    case "relocate": return {...base, kind, elevation: num(a.elevation ?? 0)};
    case "notice": return {...base, kind};
    case "triggerHazard": return {...base, kind, hazardId: str(a.hazardId ?? "", 100)};
    case "direct": return {...base, kind, ...damage(), ...condition(), ...duration()};
    case "spawnCondition": return {...base, kind, actorTemplateId: str(a.actorTemplateId ?? "", 100), ...condition(), ...duration()};
  }
}
export function validateTrap(input: unknown): TrapConfig {
  const t = object(input);
  if (t.version !== TRAP_VERSION)
    throw Error("Unsupported hazard version.");
  if (!Array.isArray(t.actions) || t.actions.length > 30)
    throw Error("Too many effects.");
  const anchor = object(t.anchor);
  const tokenIcon = str(t.tokenIcon ?? "icons/svg/hazard.svg", 1000).trim() || "icons/svg/hazard.svg";
  if (/^(?:javascript|data):/i.test(tokenIcon))
    throw Error("Use a file path for hazard token artwork.");
  const result: TrapConfig = {
    hazardType: "environmental", triggers: [], tokenIcon, hazardActorTemplateId: str(t.hazardActorTemplateId ?? "", 100), triggerRegionId: str(t.triggerRegionId ?? "", 100), hp: num(t.hp ?? 0, 0), bodyId: str(t.bodyId ?? "", 100), targetMode: choice(t.targetMode ?? "triggering", ["triggering", "region"]), version: 1, name: str(t.name, 120).trim(), notes: str(t.notes), armed: bool(t.armed),
    targets: choice(t.targets, ["players", "all"]),
    minElevation: num(t.minElevation), maxElevation: num(t.maxElevation), distance: num(t.distance, 0), range: num(t.range, 0),
    walls: bool(t.walls), darkness: bool(t.darkness),
    check: str(t.check, 120), dv: num(t.dv, 0), spotDV: num(t.spotDV, 0), disarmSkill: COUNTER_SKILL, disarmDV: num(t.disarmDV, 0),
    disarmSeconds: num(t.disarmSeconds, 0), actions: t.actions.map(validateAction), deviceId: str(t.deviceId, 100),
    anchor: {x: num(anchor.x), y: num(anchor.y)}, apType: str(t.apType, 100), apId: str(t.apId, 100),
    moveProgress: {}, detected: strings(t.detected), engaged: strings(t.engaged), deviceTemplate: validateDevice(t.deviceTemplate)
  };
  if (result.minElevation > result.maxElevation)
    throw Error("Check name and elevation bounds.");
  if (t.moveProgress)
    for (const [key, value] of Object.entries(object(t.moveProgress))) {
      if (/^[a-zA-Z0-9]+$/.test(key))
        result.moveProgress[key] = num(value, 0);
    }
  result.hazardType = choice<HazardType>(t.hazardType, ["active", "emplaced", "environmental", "notification"]);
  result.triggers = strings(t.triggers).map(v => choice<Trigger>(v, ["enter", "move", "turnStart", "turnEnd", "deviceTurn", "detect", "manual"]));
  return result;
}
export function portableTrap(trap: TrapConfig): TrapConfig {
  const normalized = validateTrap(trap);
  return {
    ...normalized, armed: false, triggerRegionId: "", bodyId: "", deviceId: "", anchor: {x: 0, y: 0}, apId: "",
    moveProgress: {}, detected: [], engaged: [], actions: normalized.actions.map(a => validateAction({...a, actorId: "", hazardId: "", wallIds: [], elevation: 0}))
  };
}
export function parsePresets(text: string): TrapConfig[] {
  if (text.length > 1000000)
    throw Error("Preset file exceeds 1 MB.");
  const file = object(JSON.parse(text));
  if (file.format !== "pneuma-scenetools-traps" || file.version !== 1 || !Array.isArray(file.presets) || file.presets.length > 200)
    throw Error("Invalid hazard preset file.");
  return file.presets.map(v => portableTrap(validateTrap(v)));
}
export function exportPresets(presets: TrapConfig[]): string {
  return JSON.stringify({format: "pneuma-scenetools-traps", version: 1, presets: presets.map(portableTrap)}, null, 2);
}
