declare const game: any;
import { MODULE_ID, TYPES, iconPath } from "./constants.js";

export function accessPointTypes({ includeDisabled = false }: any = {}) {
  const saved = game.settings?.get(MODULE_ID, "apTypes");
  const entries = saved?.entries ?? TYPES.map((type: any) => ({ id: type.id, label: type.label, img: iconPath(type.id), enabled: true }));
  return entries.filter((type: any) => includeDisabled || type.enabled !== false).map((type: any) => ({ ...type }));
}
export const typeInfo = (id: any) => accessPointTypes({ includeDisabled: true }).find((type: any) => type.id === id);
export const typeImage = (id: any) => typeInfo(id)?.img || iconPath("generic");

export function validateTypes(entries: any) {
  if (!Array.isArray(entries) || !entries.length) throw new Error("Keep at least one access point type.");
  const ids = new Set<any>(), names = new Set<any>();
  const normalized = entries.map((entry: any) => {
    const id = String(entry.id ?? ""), label = String(entry.label ?? "").trim(), img = String(entry.img ?? "").trim();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new Error("Invalid or duplicate type identifier.");
    if (!label || label.length > 80 || names.has(label.toLowerCase())) throw new Error("Use a unique name of 1–80 characters for each type.");
    if (!img || /^(?:javascript|data):/i.test(img)) throw new Error("Choose an image file for each type.");
    ids.add(id); names.add(label.toLowerCase());
    return { id, label, img, enabled: entry.enabled !== false };
  });
  if (!normalized.some((entry: any) => entry.enabled)) throw new Error("Keep at least one type enabled.");
  return normalized;
}

