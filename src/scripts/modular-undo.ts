import {requireGM} from './modular-scenes.js';
import {translateContents, type Row} from './modular-model.js';
import {assertStoredChanges} from './persistence.js';

type Entry = {before: Row; after: string};
const history = new WeakMap<Scene, Entry>();
const mutations = new WeakSet<Scene>();
export function markModularMutation(scene:Scene) {mutations.add(scene);}
function snapshot(scene: Scene): Row {
  const source = scene.toObject() as Row;
  return structuredClone({...translateContents(source, 0, 0), width:source.width, height:source.height,
    padding:source.padding, grid:source.grid, flags:source.flags});
}
function signature(data: Row) {
  return JSON.stringify(data, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : Array.isArray(value) && value.every(item => item?._id) ? [...value].sort((a,b) => a._id.localeCompare(b._id)) : value);
}
export function canUndoModular(scene: Scene, verify = true): boolean {
  const entry = history.get(scene);
  if (verify && entry && signature(snapshot(scene)) !== entry.after) history.delete(scene);
  return history.has(scene);
}
export async function recordModularEdit(scene: Scene, action: () => Promise<unknown>) {
  requireGM();
  const before = snapshot(scene);
  mutations.delete(scene);
  try {
    await action();
    const after = signature(snapshot(scene));
    if (after !== signature(before)) history.set(scene, {before, after});
  } catch (error) {
    if (signature(snapshot(scene)) !== signature(before)) {
      if (!mutations.has(scene)) {history.delete(scene);throw error;}
      try {await restore(scene,before);} catch {history.delete(scene);throw new Error('The edit failed and could not fully restore the scene. Check tiles, walls, and dimensions.');}
    }
    throw error;
  } finally {mutations.delete(scene);}
}
async function restore(scene: Scene, data: Row) {
  const ids = new Set((data.tiles ?? []).map((tile: Row) => tile._id));
  const extra = scene.tiles.filter(tile => !ids.has(tile.id)).map(tile => tile.id!);
  if (extra.length) await scene.deleteEmbeddedDocuments('Tile', extra);
  const missing = (data.tiles ?? []).filter((tile: Row) => !scene.tiles.some(existing => existing.id === tile._id));
  if (missing.length) await scene.createEmbeddedDocuments('Tile', missing, {keepId:true});
  if (data.walls) {
    const current = (scene.toObject() as Row).walls ?? [];
    const wallIds = new Set(data.walls.map((wall:Row) => wall._id));
    const extraWalls = current.filter((wall:Row) => !wallIds.has(wall._id)).map((wall:Row) => wall._id);
    if (extraWalls.length) await scene.deleteEmbeddedDocuments('Wall',extraWalls);
    const missingWalls = data.walls.filter((wall:Row) => !current.some((existing:Row) => existing._id === wall._id));
    if (missingWalls.length) await scene.createEmbeddedDocuments('Wall',missingWalls,{keepId:true});
  }
  // Replace objects so first-tile sizing flags and replaced tile data are restored exactly.
  await scene.update(data as Scene.UpdateData, {autoReposition:false, recursive:false});
  const {tiles, walls, ...rest} = data;
  assertStoredChanges(scene, rest);
  for (const tile of tiles ?? []) assertStoredChanges(scene.tiles.find(existing => existing.id === tile._id), tile);
  const savedWalls = (scene.toObject() as Row).walls ?? [];
  if(walls) {if(savedWalls.length !== walls.length)throw new Error('Undo could not restore every wall.');for(const wall of walls)assertStoredChanges(savedWalls.find((saved:Row)=>saved._id===wall._id),wall);}
  if (Array.from(scene.tiles).length !== ids.size) throw new Error('Undo could not restore every tile.');
}
export async function undoModularEdit(scene: Scene) {
  requireGM();
  if (!canUndoModular(scene)) throw new Error('No undo available. The scene may have changed outside the creator.');
  const entry = history.get(scene)!, current = snapshot(scene);
  try {await restore(scene, entry.before);history.delete(scene);}
  catch (error) {
    try {await restore(scene, current);} catch {history.delete(scene);throw new Error('Undo failed and could not fully restore the scene. Check its tiles and dimensions.');}
    throw error;
  }
}
