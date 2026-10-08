import {basename, record, type ImportFile} from "./scene-data.js";

export const isVideo = (path: string) => /\.(mp4|webm|m4v|ogv)(?:[?#].*)?$/i.test(path);
export const isImage = (path: string) => /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#].*)?$/i.test(path);
export const isMedia = (path: string) => isImage(path) || isVideo(path);
export const isOverlay = (path: string) => /overlay|foreground/i.test(basename(path));
export const isFoundryFolder = (path: string) => /^foundry(?:[ _-]*(?:walls|scenes))?$/i.test(basename(path.replace(/\/$/, "")));
export const parentPath = (path: string) => {
  const clean = path.split(/[?#]/)[0]!.replace(/\\/g, "/").replace(/\/$/, "");
  return clean.slice(0, Math.max(0, clean.lastIndexOf("/")));
};
export const scanRoot = (folder: string) => /^(?:images?|videos?|static|animated)(?:[ _-]*\d+k)?$/i.test(basename(folder)) ? parentPath(folder) : folder;

/** Regex mappings retain layout variants while removing exporter/publisher and media suffixes. */
export function mapIdentity(path: string): string {
  return basename(path)
    .replace(/-[a-z\d]{16}\.json$/i, ".json")
    .replace(/\.[^.]+$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^(?:fvtt[ _-]+(?:scene[ _-]+)?|cybermaps[ _-]+|sol[ _-]+)/, "")
    .replace(/(?:map|floor|level)[ _-]*(\d+)/g, " floor$1 ")
    .replace(/zoom(?:ed)?[ _-]*out/g, " zoomout ")
    .replace(/\bint\b/g, "interior")
    .replace(/\bext\b/g, "exterior")
    .replace(/\b\d+\s*[x×]\s*\d+\b/g, " ")
    .replace(/\b(?:vtt[ _-]*)?\d+k\b|\b\d+\s*(?:px|ppi)\b/g, " ")
    .replace(/\b(?:gridless|grid|gridded|overlay|foreground|image|video|animated|static|foundry|walls|scene|vtt)\b/g, " ")
    .replace(/[^a-z\d]+/g, " ").trim().replace(/\s+/g, " ");
}

export function nameScore(a: string, b: string, family = false): number {
  let left = mapIdentity(a), right = mapIdentity(b);
  if (!left || !right) return 0;
  if (family) {
    left = left.replace(/\b(?:floor\d+|zoomout)\b/g, "").trim();
    right = right.replace(/\b(?:floor\d+|zoomout)\b/g, "").trim();
  } else {
    const floorA = left.match(/\bfloor(\d+)\b/)?.[1], floorB = right.match(/\bfloor(\d+)\b/)?.[1];
    if (floorA && floorB && floorA !== floorB) return 0;
    if (/\bzoomout\b/.test(left) !== /\bzoomout\b/.test(right)) return 0;
  }
  if (left === right) return 100;
  const aa = new Set(left.split(/\s+/)), bb = new Set(right.split(/\s+/));
  const shared = [...aa].filter(word => bb.has(word)).length;
  return Math.round(100 * shared / Math.max(aa.size, bb.size));
}

function importNames(item: ImportFile): string[] {
  return [item.path, String(item.data.name ?? ""), String(record(item.data.background).src ?? item.data.img ?? "")].filter(Boolean);
}

function layoutCompatible(item: ImportFile, map: string): boolean {
  const source = mapIdentity(item.path), target = mapIdentity(map);
  if (!source) return true;
  const floorA = source.match(/\bfloor(\d+)\b/)?.[1], floorB = target.match(/\bfloor(\d+)\b/)?.[1];
  if (floorA && floorB && floorA !== floorB) return false;
  return /\bzoomout\b/.test(source) === /\bzoomout\b/.test(target);
}

export function importScore(item: ImportFile, map: string, family = false): number {
  if (!family && !layoutCompatible(item, map)) return 0;
  const score = Math.max(...importNames(item).map(name => nameScore(name, map, family)));
  // Folder convention breaks name-score ties; an unrelated name never becomes a match.
  return score ? score + (isFoundryFolder(parentPath(item.path)) ? 5 : 0) : 0;
}

export function rankImports(imports: ImportFile[], map: string) {
  return imports.map(item => ({item, score: importScore(item, map)}))
    .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path));
}

export function mediaForImport(item: ImportFile | undefined, selectedMap: string, files: string[], animated: boolean): string[] {
  const names = item ? importNames(item) : [selectedMap];
  return files.filter(path => isMedia(path) && !isOverlay(path) && isVideo(path) === animated)
    .filter(path => !item || layoutCompatible(item, path))
    .map(path => ({path, score: Math.max(...names.map(name => nameScore(name, path)))}))
    .filter(entry => entry.score >= 70)
    .sort((a, b) => b.score - a.score || Number(b.path === selectedMap) - Number(a.path === selectedMap)
      || Number(parentPath(b.path) === parentPath(selectedMap)) - Number(parentPath(a.path) === parentPath(selectedMap))
      || Math.abs(resolutionRank(a.path) - resolutionRank(selectedMap)) - Math.abs(resolutionRank(b.path) - resolutionRank(selectedMap))
      || a.path.localeCompare(b.path)).map(entry => entry.path);
}

function resolutionRank(path: string) { return Number(basename(path).match(/(?:^|[ _-])(?:vtt)?(\d+)k\b/i)?.[1] ?? 4); }

export function matchingOverlays(map: string, files: string[]): string[] {
  return files.filter(path => isMedia(path) && isOverlay(path) && nameScore(map, path) >= 70)
    .sort((a, b) => Number(isVideo(a)) - Number(isVideo(b)) || b.localeCompare(a));
}

export interface ScenePlan { selected?: ImportFile; maps: string[]; }

/** Resolution/format copies form one layout; uncovered layouts can still be imported without JSON. */
export function uncoveredVariants(map: string, imports: ImportFile[], files: string[]): string[] {
  const groups = new Map<string, string>();
  for (const path of files) {
    if (!isMedia(path) || isOverlay(path) || nameScore(map, path, true) < 50 || mapIdentity(path) === mapIdentity(map)) continue;
    const key = mapIdentity(path);
    if (imports.some(item => importScore(item, path) >= 70)) continue;
    const existing = groups.get(key);
    if (!existing || isVideo(existing) && !isVideo(path)) groups.set(key, path);
  }
  return [...groups.values()];
}
