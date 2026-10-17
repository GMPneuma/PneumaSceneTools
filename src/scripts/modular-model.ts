/** Geometry is independent of Foundry so expansion can be verified without a canvas. */
export interface ModularLayout {version: 1; width: number; height: number; columns: number; rows: number; awaitingFirstTile?: boolean}
export type Direction = "north" | "south" | "east" | "west";
export type Row = Record<string, any>;
export function validateLayout(value: unknown): ModularLayout {
  const layout = value as ModularLayout | undefined;
  if (!layout || layout.version !== 1 || ![layout.width, layout.height, layout.columns, layout.rows].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error("Invalid modular scene layout.");
  if (layout.width * layout.columns > 32768 || layout.height * layout.rows > 32768 || layout.columns * layout.rows > 400) throw new Error("Modular scenes are limited to 400 spaces and 32,768 pixels per side.");
  return {...layout};
}
export function expandLayout(value: ModularLayout, direction: Direction) {
  if (!["north", "south", "east", "west"].includes(direction)) throw new Error("Invalid expansion direction.");
  const layout = validateLayout(value);
  if (direction === "east" || direction === "west") layout.columns++; else layout.rows++;
  return {layout: validateLayout(layout), dx: direction === "west" ? layout.width : 0, dy: direction === "north" ? layout.height : 0};
}
export function shrinkLayout(value: ModularLayout, direction: Direction) {
  if (!["north", "south", "east", "west"].includes(direction)) throw new Error("Invalid shrink direction.");
  const layout = validateLayout(value);
  if (direction === "east" || direction === "west") {
    if (layout.columns === 1) throw new Error("Keep at least one column.");
    layout.columns--;
  } else {
    if (layout.rows === 1) throw new Error("Keep at least one row.");
    layout.rows--;
  }
  return {layout, dx: direction === "west" ? -layout.width : 0, dy: direction === "north" ? -layout.height : 0};
}
/** Include native Tiles intersecting the removed strip, not just module-owned tiles. */
export function tilesInRemovedEdge(source: Row, layout: ModularLayout, direction: Direction, origin = {x: 0, y: 0}): Row[] {
  shrinkLayout(layout, direction);
  const width = layout.width * layout.columns, height = layout.height * layout.rows;
  const left = direction === "east" ? width - layout.width : 0;
  const top = direction === "south" ? height - layout.height : 0;
  const right = direction === "west" ? layout.width : width;
  const bottom = direction === "north" ? layout.height : height;
  return (source.tiles ?? []).filter((tile: Row) => {
    const radians = Number(tile.rotation ?? 0) * Math.PI / 180;
    const w = Math.abs(Math.cos(radians)) * tile.width + Math.abs(Math.sin(radians)) * tile.height;
    const h = Math.abs(Math.sin(radians)) * tile.width + Math.abs(Math.cos(radians)) * tile.height;
    const cx = tile.x - origin.x + tile.width / 2, cy = tile.y - origin.y + tile.height / 2;
    return cx + w / 2 > left + 1e-6 && cx - w / 2 < right - 1e-6 && cy + h / 2 > top + 1e-6 && cy - h / 2 < bottom - 1e-6;
  });
}
export function cellGeometry(layout: ModularLayout, column: number, row: number, rotation = 0) {
  validateLayout(layout);
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || column >= layout.columns || row >= layout.rows) throw new Error("Choose a space inside the scene.");
  rotation = ((rotation % 360) + 360) % 360;
  // Rectangular images retain their aspect ratio when turned; fit within their space.
  const scale = rotation % 180 === 0 ? 1 : Math.min(layout.width / layout.height, layout.height / layout.width);
  const width = layout.width * scale, height = layout.height * scale;
  return {x: column * layout.width + (layout.width - width) / 2, y: row * layout.height + (layout.height - height) / 2, width, height, rotation};
}
/** Translate native embedded documents, preserving all unrelated fields and IDs. */
export function translateContents(source: Row, dx: number, dy: number): Row {
  const result: Row = {};
  for (const key of ["tiles", "tokens", "lights", "sounds", "notes", "templates", "drawings"]) {
    if (Array.isArray(source[key])) result[key] = source[key].map((doc: Row) => ({...doc, x: doc.x + dx, y: doc.y + dy}));
  }
  if (Array.isArray(source.walls)) result.walls = source.walls.map((doc: Row) => ({...doc, c: doc.c.map((n: number, i: number) => n + (i % 2 ? dy : dx))}));
  if (Array.isArray(source.regions)) result.regions = source.regions.map((doc: Row) => ({...doc, shapes: doc.shapes.map((shape: Row) => {
    if (shape.type === "polygon") return {...shape, points: shape.points.map((n: number, i: number) => n + (i % 2 ? dy : dx))};
    if (shape.type === "rectangle" || shape.type === "ellipse") return {...shape, x: shape.x + dx, y: shape.y + dy};
    throw new Error(`Cannot safely shift Region shape: ${shape.type}`);
  })}));
  if (source.initial && Number.isFinite(source.initial.x) && Number.isFinite(source.initial.y)) result.initial = {...source.initial, x: source.initial.x + dx, y: source.initial.y + dy};
  return result;
}
