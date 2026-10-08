export type Data = Record<string, unknown>;
export const COMMON_GRIDS = [50, 70, 100, 140, 150, 200, 256, 300];
export const record = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
export const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const positive = (value: unknown, fallback = 100): number => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
export function basename(path: string): string {
  const name = path.split(/[?#]/)[0]!.split("/").filter(Boolean).at(-1) ?? path;
  try { return decodeURIComponent(name); } catch { return name; }
}
export const stem = (path: string): string => basename(path).replace(/\.[^.]+$/, "").toLowerCase().replace(/(?:[ _-](?:scene|foundry|map|grid|gridless))+$/g, "");

export function gridSuggestions(width: number, height: number, filename: string, preferred = 100) {
  const px = basename(filename).match(/(?:^|[ _-])(\d{2,4})\s*(?:px|ppi)(?:[ _.-]|$)/i);
  const counts = basename(filename).match(/(?:^|[ _-])(\d+)\s*[x×]\s*(\d+)(?:[ _.-]|$)/i);
  let hint = px ? Number(px[1]) : 0;
  if (!hint && counts) {
    const x = width / Number(counts[1]), y = height / Number(counts[2]);
    if (Math.abs(x - y) < 1 && x >= 50) hint = Math.round(x);
  }
  const remainder = (n: number) => Math.abs(n - Math.round(n));
  return [...new Set([...COMMON_GRIDS, preferred, ...(hint >= 50 ? [hint] : [])])]
    .filter(n => n >= 50 && Number.isFinite(n))
    .map(size => ({size, columns: width / size, rows: height / size,
      score: remainder(width / size) + remainder(height / size), hint: size === hint}))
    .sort((a, b) => Number(b.hint) - Number(a.hint) || a.score - b.score || Number(b.size === preferred) - Number(a.size === preferred) || a.size - b.size);
}

export interface ImportFile { path: string; kind: "Foundry Scene" | "Universal VTT"; data: Data; }
export function identifyImport(value: unknown, path: string): ImportFile | null {
  const data = record(value);
  const resolution = record(data.resolution);
  const size = record(resolution.map_size);
  if (positive(resolution.pixels_per_grid, 0) && positive(size.x, 0) && positive(size.y, 0) && Array.isArray(data.line_of_sight)) {
    return {path, kind: "Universal VTT", data};
  }
  if (typeof data.name === "string" && positive(data.width, 0) && positive(data.height, 0)
    && (typeof record(data.background).src === "string" || typeof data.img === "string")
    && (Array.isArray(data.walls) || Array.isArray(data.lights) || Object.keys(record(data.grid)).length > 0)) {
    return {path, kind: "Foundry Scene", data};
  }
  return null;
}

/** Convert map coordinates to pixels relative to the image origin; UVTT scenes use zero padding. */
export function universalScene(data: Data, width: number, height: number, distance: number): Data {
  const resolution = record(data.resolution), size = record(resolution.map_size), origin = record(resolution.map_origin);
  const sx = width / positive(size.x), sy = height / positive(size.y);
  if (Math.abs(sx - sy) > 1) throw new Error("Universal VTT dimensions do not match this map's aspect ratio. Choose the matching map image.");
  const point = (value: unknown): [number, number] => {
    const p = record(value);
    if (typeof p.x !== "number" || typeof p.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error("Invalid Universal VTT coordinate.");
    return [(p.x - Number(origin.x ?? 0)) * sx, (p.y - Number(origin.y ?? 0)) * sy];
  };
  const walls: Data[] = [];
  for (const line of [...list(data.line_of_sight), ...list(data.objects_line_of_sight)]) {
    const points = list(line);
    for (let i = 1; i < points.length; i++) walls.push({c: [...point(points[i - 1]), ...point(points[i])], move: 20, sight: 20, light: 20, sound: 20});
  }
  for (const value of list(data.portals)) {
    const portal = record(value), bounds = list(portal.bounds);
    if (bounds.length !== 2) throw new Error("Invalid Universal VTT portal bounds.");
    // UVTT closed means blocks light (door); false describes a transparent window.
    walls.push({c: [...point(bounds[0]), ...point(bounds[1])], move: 20, sight: portal.closed ? 20 : 0,
      light: portal.closed ? 20 : 0, sound: 20, door: portal.closed ? 1 : 0, ds: 0});
  }
  const lights = list(data.lights).map(value => {
    const light = record(value), [x, y] = point(light.position);
    const color = String(light.color ?? "ffffffff").replace(/^#/, "");
    const rgb = color.length === 8 ? color.slice(2) : color;
    return {x, y, config: {dim: positive(light.range, 0) * distance, bright: positive(light.range, 0) * distance / 2,
      color: /^[\da-f]{6}$/i.test(rgb) ? `#${rgb}` : null, alpha: Math.min(1, Math.max(0, Number(light.intensity ?? 1) * 0.05)), angle: 360}};
  });
  return {width, height, padding: 0, walls, lights, grid: {type: 1, size: Math.round(sx), distance}};
}

export function nativeScene(data: Data): Data {
  const result = structuredClone(data);
  for (const key of ["_id", "_stats", "folder", "sort", "thumb", "ownership", "active", "navigation"]) delete result[key];
  // World links cannot be assumed to refer to the same documents in another world.
  for (const key of ["journal", "journalEntryPage", "playlist", "playlistSound"]) delete result[key];
  return result;
}

export function resolveAsset(path: string, files: string[]): string | null {
  if (files.includes(path)) return path;
  const matches = files.filter(file => basename(file) === basename(path));
  return matches.length === 1 ? matches[0]! : null;
}
