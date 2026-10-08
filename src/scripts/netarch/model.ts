import type {APData, Audience, Discovery, Pulse, ArchitectureColor, ScannerRoll} from "./data.js";
import { DEFAULT_COLOR, MODULE_ID, PALETTE, SCHEMA_VERSION } from "./constants.js";

export const isAP = (doc: Pick<TokenDocument, "flags"> | null | undefined) => doc?.flags?.[MODULE_ID]?.accessPoint === true;
export const apData = (doc: TokenDocument | null | undefined): Partial<APData> => doc?.flags?.[MODULE_ID] ?? {};
export const blankDiscovery = (): Discovery => ({ revealed: false, public: false, users: [], runners: [] });

export function freshAP(type: unknown = "computer", netarch: unknown = "") {
  return {
    version: SCHEMA_VERSION, accessPoint: true,
    type: typeof type === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(type) ? type : "computer",
    netarch: typeof netarch === "string" ? netarch : "",
    discovery: blankDiscovery(), pulse: null, showName: false,
  };
}

export function audienceAllows(audience: Audience | null | undefined, user: User | null | undefined) {
  if (!user || !audience) return false;
  return Boolean(user.isGM || audience.public === true || audience.users?.includes(user.id!));
}

export function canSeeAP(doc: TokenDocument | null | undefined, user: User | null | undefined) {
  if (!isAP(doc)) return false;
  const state = apData(doc).discovery;
  return Boolean(user?.isGM || (state?.revealed === true && audienceAllows(state, user)));
}

export function mergeDiscovery(previous: Discovery | undefined, audience: Audience, runnerUuid: string = "") {
  const old = previous?.revealed ? previous : blankDiscovery();
  return {
    revealed: true,
    public: Boolean(old.public || audience.public),
    users: [...new Set<string>([...(old.users ?? []), ...(audience.users ?? [])])],
    runners: [...new Set<string>([...(old.runners ?? []), ...(runnerUuid ? [runnerUuid] : [])])],
  };
}

export function pulseProgress(pulse: Pulse | null | undefined, now: number) {
  if (!pulse || !Number.isFinite(pulse.started) || !Number.isFinite(pulse.duration) || pulse.duration <= 0) return null;
  const elapsed = now - pulse.started;
  if (elapsed < 0 || (!pulse.loop && (!Number.isFinite(pulse.count) || elapsed >= pulse.count * pulse.duration))) return null;
  return (elapsed % pulse.duration) / pulse.duration;
}

export function canSeePulse(doc: TokenDocument | null | undefined, user: User | null | undefined, now: number) {
  const data = apData(doc);
  return Boolean(data.discovery?.revealed && canSeeAP(doc, user)
    && audienceAllows(data.pulse?.audience, user) && pulseProgress(data.pulse, now) !== null);
}

export function architectureColor(uuid: string | undefined, overrides: ArchitectureColor[] = []) {
  if (!uuid) return DEFAULT_COLOR;
  const explicit = overrides.find((entry) => entry.uuid === uuid)?.color;
  if (/^#[\da-f]{6}$/i.test(explicit ?? "")) return explicit!;
  let hash = 2166136261;
  for (const character of uuid) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

export function validateRadius(value: unknown, { allowZero = true } = {}) {
  if (value === "" || value == null) throw new Error("Enter a radius.");
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
    throw new Error(allowZero ? "Radius must be zero or greater." : "Radius must be greater than zero.");
  }
  return number;
}

export function tokenCenter(doc: TokenDocument, gridSize: number) {
  return { x: doc.x + (doc.width ?? 1) * gridSize / 2, y: doc.y + (doc.height ?? 1) * gridSize / 2 };
}

export function sceneDistance(from: TokenDocument | null | undefined, to: TokenDocument | null | undefined, grid: Scene["grid"] | undefined) {
  if (!from || !to || !grid || !("measurePath" in grid) || typeof grid.measurePath !== "function"
    || !Number.isFinite(grid.size) || grid.size <= 0) return null;
  const a = from.object?.center ?? tokenCenter(from, grid.size);
  const b = to.object?.center ?? tokenCenter(to, grid.size);
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
  // Scene.grid is Foundry 12's grid instance, including its diagonal/hex rules.
  const distance = grid.measurePath([a, b], {}).distance;
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

export const withinRadius = (distance: number | null, radius: number) => radius === 0 || (distance !== null && distance <= radius + 1e-8);

export function scanContext(roll: ScannerRoll, sceneId: string | null | undefined) {
  if (roll?.ability !== "scanner" || !roll.entityData?.actor || !Number.isFinite(roll.resultTotal)) return null;
  return {
    actorId: roll.entityData.actor,
    tokenId: roll.entityData.token ?? null,
    sceneId: sceneId ?? null,
    total: roll.resultTotal!,
  };
}

export const escapeHTML = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character: string) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character as "&" | "<" | ">" | '"' | "'"]);

