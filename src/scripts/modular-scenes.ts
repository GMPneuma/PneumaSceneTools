import {markModularMutation} from './modular-undo.js';
import {MODULE_ID} from "./settings.js";
import {ensureSceneToolsFolder} from "./world-folders.js";
import {imageDimensions} from "./scene-import.js";
import {assertStoredChanges} from "./persistence.js";
import {cellGeometry, expandLayout, shrinkLayout, tilesInRemovedEdge, translateContents, validateLayout, type Direction, type ModularLayout, type Row} from "./modular-model.js";

export const MODULAR_FLAG = "modularScene";
/** Native playable-area origin, excluding the surrounding canvas padding. */
export function modularOrigin(scene: Scene) {
  const {sceneX: x, sceneY: y} = scene.getDimensions();
  return {x, y};
}
function resizeContents(scene: Scene, source: Row, width: number, height: number, dx = 0, dy = 0) {
  const before = modularOrigin(scene);
  const after = modularOrigin(new Scene({...scene.toObject(), width, height} as Scene.CreateData));
  return translateContents(source, dx + after.x - before.x, dy + after.y - before.y);
}
function tileGeometry(scene: Scene, layout: ModularLayout, column: number, row: number, rotation: number) {
  const geometry = cellGeometry(layout, column, row, rotation), origin = modularOrigin(scene);
  return {...geometry, x: geometry.x + origin.x, y: geometry.y + origin.y};
}
export function modularLayout(scene?: Scene | null): ModularLayout | undefined {
  const value = scene && foundry.utils.getProperty(scene, `flags.${MODULE_ID}.${MODULAR_FLAG}`);
  return value ? validateLayout(value) : undefined;
}
export function requireGM() {
  if (!game.user?.isGM) throw new Error("Only a GM can edit modular scenes.");
  if (game.users?.activeGM && game.users.activeGM.id !== game.user.id) throw new Error("The active GM manages modular scenes to prevent simultaneous edits.");
}
export function cellTile(scene: Scene, column: number, row: number) {
  return scene.tiles.find(tile => {
    const cell = foundry.utils.getProperty(tile, `flags.${MODULE_ID}.modularCell`) as {column: number; row: number} | undefined;
    return cell?.column === column && cell.row === row;
  });
}
function checkedLayout(scene: Scene) {
  requireGM();
  const layout = modularLayout(scene);
  if (!layout) throw new Error("Choose a modular scene.");
  if (scene.width !== layout.width * layout.columns || scene.height !== layout.height * layout.rows) throw new Error("Scene dimensions were changed outside the creator. Restore its original modular dimensions before editing.");
  return layout;
}
export async function createModularScene(name: string, path: string, grid: number): Promise<Scene> {
  requireGM();
  if (!name.trim()) throw new Error("Enter a scene name.");
  if (!Number.isInteger(grid) || grid < 50 || grid > 1000) throw new Error("Grid size must be 50–1000 pixels.");
  const size = path ? await imageDimensions(path) : {width:grid * 10, height:grid * 10};
  const layout = validateLayout({version: 1, ...size, columns: 1, rows: 1, ...(!path ? {awaitingFirstTile:true} : {})});
  const folder = await ensureSceneToolsFolder("Scene", "Modular Scenes");
  requireGM();
  const scene = await Scene.create({name: name.trim(), folder: folder.id, width: size.width, height: size.height, padding: 0.15,
    active: false, navigation: false, tokenVision: false,
    globalLight: game.settings!.get(MODULE_ID, "defaultGlobalLight"), darkness: game.settings!.get(MODULE_ID, "defaultDarkness"),
    grid: {type: 1, size: grid, distance: game.system!.grid.distance, units: game.system!.grid.units},
    flags: {[MODULE_ID]: {[MODULAR_FLAG]: layout}},
    tiles: [],
  } as unknown as Scene.CreateData);
  if (!scene) throw new Error("Foundry did not create the modular scene.");
  return scene;
}
export async function createNamedModularScene(name: string) {
  return createModularScene(name, '', game.settings!.get(MODULE_ID, 'defaultGrid') || 100);
}
export async function placeModularTile(scene: Scene, column: number, row: number, path: string) {
  let layout = checkedLayout(scene);
  const before = JSON.stringify(scene.toObject());
  const size = await imageDimensions(path);
  checkedLayout(scene);
  if (JSON.stringify(scene.toObject()) !== before) throw new Error('The scene changed while reading the tile. Try placing it again.');
  if (layout.awaitingFirstTile && !Array.from(scene.tiles).length) {
    if (column !== 0 || row !== 0 || layout.columns !== 1 || layout.rows !== 1) throw new Error('Place the first tile before expanding.');
    layout = validateLayout({...layout, ...size});
    const changes = {...resizeContents(scene, scene.toObject() as Row, size.width, size.height), width:size.width, height:size.height, [`flags.${MODULE_ID}.${MODULAR_FLAG}`]:layout};
    markModularMutation(scene);
    await scene.update(changes as Scene.UpdateData, {autoReposition:false});
    assertStoredChanges(scene, changes);
  }
  if (size.width !== layout.width || size.height !== layout.height) throw new Error(`This image is ${size.width} × ${size.height}. Choose an image matching this scene's ${layout.width} × ${layout.height} spaces.`);
  checkedLayout(scene);
  const tile = cellTile(scene, column, row);
  const geometry = tileGeometry(scene, layout, column, row, tile?.rotation ?? 0);
  const data = {...geometry, texture: {src: path}, overhead: false, locked: true, flags: {[MODULE_ID]: {modularCell: {column, row}}}};
  markModularMutation(scene);
  if (tile) await tile.update({...geometry, "texture.src": path} as never);
  else await scene.createEmbeddedDocuments("Tile", [data as unknown as TileDocument.CreateData]);
  assertStoredChanges(cellTile(scene, column, row), {...geometry, "texture.src": path});
  if (layout.awaitingFirstTile) {
    const changes = {[`flags.${MODULE_ID}.${MODULAR_FLAG}`]:{...layout, awaitingFirstTile:false}};
    await scene.update(changes as Scene.UpdateData);
    assertStoredChanges(scene, changes);
  }
}
export async function rotateModularTile(scene: Scene, column: number, row: number, delta: number) {
  const layout = checkedLayout(scene), tile = cellTile(scene, column, row);
  if (!tile) throw new Error("Choose an occupied space to rotate.");
  if (delta !== 90 && delta !== -90) throw new Error("Rotation must be 90 degrees.");
  const geometry = tileGeometry(scene, layout, column, row, tile.rotation + delta);
  markModularMutation(scene);
  await tile.update(geometry);
  assertStoredChanges(tile, geometry);
}
export async function removeModularTile(scene: Scene, column: number, row: number) {
  checkedLayout(scene);
  const tile = cellTile(scene, column, row);
  if (tile) {markModularMutation(scene);await tile.delete();}
  if (cellTile(scene, column, row)) throw new Error("Foundry did not remove the tile. Retry after checking module hooks and permissions.");
}
export async function expandModularScene(scene: Scene, direction: Direction) {
  const current = checkedLayout(scene);
  if (current.awaitingFirstTile) throw new Error('Place the first tile to set the scene size before expanding.');
  const {layout, dx, dy} = expandLayout(current, direction);
  const contents = resizeContents(scene, scene.toObject() as Row, layout.width * layout.columns, layout.height * layout.rows, dx, dy);
  for (const tile of contents.tiles ?? []) {
    const cell = tile.flags?.[MODULE_ID]?.modularCell;
    if (cell) tile.flags = {...tile.flags, [MODULE_ID]: {...tile.flags[MODULE_ID], modularCell: {...cell, column: cell.column + (dx ? 1 : 0), row: cell.row + (dy ? 1 : 0)}}};
  }
  // One native Scene update keeps resize and embedded-document translation together.
  const changes: Row = {...contents, width: layout.width * layout.columns, height: layout.height * layout.rows,
    [`flags.${MODULE_ID}.${MODULAR_FLAG}`]: layout};
  markModularMutation(scene);
  await scene.update(changes as Scene.UpdateData, {autoReposition: false});
  assertStoredChanges(scene, changes);
}
export async function shrinkModularScene(scene: Scene, direction: Direction): Promise<boolean> {
  const current = checkedLayout(scene);
  const {layout, dx, dy} = shrinkLayout(current, direction);
  const source = scene.toObject() as Row;
  const removed = tilesInRemovedEdge(source, current, direction, modularOrigin(scene));
  if (removed.length && !await Dialog.confirm({title: "Shrink map?", defaultYes: false,
    content: `<p>Remove the ${direction} ${direction === "north" || direction === "south" ? "row" : "column"}?</p><p><strong>This will delete ${removed.length} placed tile${removed.length === 1 ? "" : "s"} intersecting that edge.</strong> Source image files are kept.</p>`})) return false;
  checkedLayout(scene);
  if (JSON.stringify(scene.toObject()) !== JSON.stringify(source)) throw new Error("The scene changed while confirming. Check the edge and try again.");
  const ids = new Set(removed.map(tile => String(tile._id)));
  const kept = {...source, tiles: source.tiles.filter((tile: Row) => !ids.has(tile._id))};
  const contents = resizeContents(scene, kept, layout.width * layout.columns, layout.height * layout.rows, dx, dy);
  for (const tile of contents.tiles ?? []) {
    const cell = tile.flags?.[MODULE_ID]?.modularCell;
    if (cell) tile.flags = {...tile.flags, [MODULE_ID]: {...tile.flags[MODULE_ID], modularCell: {...cell,
      column: cell.column + (dx ? -1 : 0), row: cell.row + (dy ? -1 : 0)}}};
  }
  const changes: Row = {...contents, width: layout.width * layout.columns, height: layout.height * layout.rows,
    [`flags.${MODULE_ID}.${MODULAR_FLAG}`]: layout};
  try {
    markModularMutation(scene);

    if (ids.size) await scene.deleteEmbeddedDocuments("Tile", [...ids]);
    if (scene.tiles.some(tile => ids.has(tile.id!))) throw new Error("Foundry did not delete all edge tiles.");
    await scene.update(changes as Scene.UpdateData, {autoReposition: false});
    assertStoredChanges(scene, changes);
    return true;
  } catch (error) {
    // Native deletion and Scene resize are separate operations. Restore removed
    // tiles and original coordinates if either operation fails or is cancelled.
    try {
      const missing = removed.filter(tile => !scene.tiles.some(existing => existing.id === tile._id));
      if (missing.length) await scene.createEmbeddedDocuments("Tile", missing as TileDocument.CreateData[], {keepId: true});
      const restore: Row = {...translateContents(source, 0, 0), width: source.width, height: source.height,
        [`flags.${MODULE_ID}.${MODULAR_FLAG}`]: current};
      await scene.update(restore as Scene.UpdateData, {autoReposition: false});
      // Compare by ID: restored Tile order can differ from the original array.
      const {tiles, ...rest} = restore;
      assertStoredChanges(scene, rest);
      for (const tile of tiles) assertStoredChanges(scene.tiles.find(existing => existing.id === tile._id), tile);
    } catch (restoreError) {
      throw new Error(`Shrink failed and could not fully restore the scene. Check its tiles and dimensions. ${String(error)}; ${String(restoreError)}`);
    }
    throw error;
  }
}
