import {canUndoModular, recordModularEdit, undoModularEdit} from './modular-undo.js';
import {cellTile, expandModularScene, shrinkModularScene, modularLayout, modularOrigin, requireGM, rotateModularTile, removeModularTile} from "./modular-scenes.js";
import type {Direction} from "./modular-model.js";
import {assertStoredChanges} from "./persistence.js";

type Picker = (scene: Scene, column: number, row: number) => void;
let editing: {scene: Scene; column: number; row: number; picker: Picker} | undefined;
let root: HTMLElement | undefined;
let busy = false;
let frame = 0;
export function setModularCanvasBusy(value: boolean) {busy = value; root?.querySelectorAll('button').forEach(button => {button.disabled = value || button.dataset.atMinimum === 'true';});}
export function stopModularCanvas() {editing = undefined; root?.remove(); root = undefined;cancelAnimationFrame(frame);}
export function startModularCanvas(scene: Scene, picker: Picker, column = 0, row = 0) {
  requireGM(); editing = {scene, column, row, picker}; refreshModularCanvas();
}
/** Screen-space controls follow world coordinates; no scene documents are created for the UI. */
export function refreshModularCanvas() {
  root?.remove();root = undefined;
  const state = editing;
  if (!state || canvas.scene?.id !== state.scene.id || !canvas.ready || !game.user?.isGM) return;
  const layout = modularLayout(state.scene);
  if (!layout) return stopModularCanvas();
  const origin = modularOrigin(state.scene);
  state.column = Math.min(state.column, layout.columns - 1);state.row = Math.min(state.row, layout.rows - 1);
  root = document.createElement('div'); root.id = 'pneuma-modular-canvas';root.setAttribute('aria-label', 'Live modular scene controls');
  // Structural positioning must exist before attachment: an existing Foundry
  // session may not have loaded a newly added manifest stylesheet yet. A normal
  // body child becomes a flex item and pushes the native sidebar to the left.
  Object.assign(root.style, {position:'fixed', inset:'0', margin:'0', pointerEvents:'none', zIndex:'60'});
  const highlight=document.createElementNS('http://www.w3.org/2000/svg','svg');
  highlight.classList.add('modular-live-highlight');highlight.setAttribute('aria-hidden','true');
  Object.assign(highlight.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
  for(const [stroke,width,fill] of [['#000','8','none'],['var(--color-border-highlight, #ff6400)','4','rgba(255, 180, 0, 0.14)']]){
    const outline=document.createElementNS('http://www.w3.org/2000/svg','polygon');
    outline.setAttribute('stroke',stroke!);outline.setAttribute('stroke-width',width!);outline.setAttribute('fill',fill!);
    outline.setAttribute('stroke-linejoin','round');highlight.append(outline);
  }
  root.append(highlight);
  const button = (label: string, text: string, action: () => void) => {
    const element = document.createElement('button');element.type = 'button';element.title = label;element.setAttribute('aria-label',label);element.textContent = text;element.disabled = busy;
    Object.assign(element.style, {pointerEvents:'auto', width:'auto', minHeight:'30px', whiteSpace:'nowrap'});
    element.addEventListener('pointerdown', event => event.stopPropagation());
    element.addEventListener('click', event => {event.stopPropagation();if (!busy) action();});return element;
  };
  for (let row = 0; row < layout.rows; row++) for (let column = 0; column < layout.columns; column++) {
    const occupied = !!cellTile(state.scene, column, row);
    const element = button(`${occupied ? 'Edit tile' : 'Place tile'} at column ${column + 1}, row ${row + 1}`, occupied ? 'Edit Tile' : '+ Place Tile', () => {
      state.column = column;state.row = row; refreshModularCanvas();state.picker(state.scene, column, row);
    });
    element.className = 'modular-live-cell';element.dataset.column = String(column);element.dataset.row = String(row);
    element.setAttribute('aria-pressed',String(column===state.column&&row===state.row));
    element.dataset.worldX = String(origin.x + (column + 0.5) * layout.width);element.dataset.worldY = String(origin.y + (row + 0.5) * layout.height);root.append(element);
  }
  const tile = cellTile(state.scene, state.column, state.row);
  if (tile) {
    const toolbar = document.createElement('div');toolbar.className = 'modular-live-toolbar';
    Object.assign(toolbar.style, {display:'flex', gap:'4px', pointerEvents:'none'});
    toolbar.dataset.worldX = String(origin.x + (state.column + 0.5) * layout.width);toolbar.dataset.worldY = String(origin.y + (state.row + 0.5) * layout.height);toolbar.dataset.offsetY = '38';
    toolbar.append(button('Replace selected tile', 'Replace Tile', () => state.picker(state.scene, state.column, state.row)),
      button('Rotate 90° counterclockwise', '↶ 90°', () => void run(() => rotateModularTile(state.scene, state.column, state.row, -90))),
      button('Rotate 90° clockwise', '↷ 90°', () => void run(() => rotateModularTile(state.scene, state.column, state.row, 90))),
      button('Remove selected tile', 'Remove', () => void run(async () => {
        if (await Dialog.confirm({title:'Remove tile?', content:'<p>Remove the selected tile? The space and source image are kept.</p>'})) await removeModularTile(state.scene, state.column, state.row);
      })));
    root.append(toolbar);
  }
  const width = layout.width * layout.columns, height = layout.height * layout.rows;
  for (const [direction, text, x, y] of [
    ['north', '↑', width / 2, 0], ['south', '↓', width / 2, height],
    ['west', '←', 0, height / 2], ['east', '→', width, height / 2],
  ] as const) {
    const element = button(`Expand scene ${direction}`, text, () => void run(async () => {
      await expandModularScene(state.scene, direction as Direction);
      const updated = modularLayout(state.scene)!;
      if (direction === 'west') state.column = 0;
      if (direction === 'east') state.column = updated.columns - 1;
      if (direction === 'north') state.row = 0;
      if (direction === 'south') state.row = updated.rows - 1;
    }));
    element.className = 'modular-live-expand';element.dataset.direction = direction;element.dataset.worldX = String(origin.x + x);element.dataset.worldY = String(origin.y + y);root.append(element);
    element.dataset.atMinimum = String(!!layout.awaitingFirstTile);element.disabled = busy || !!layout.awaitingFirstTile;
    if (layout.awaitingFirstTile) element.title = 'Place the first tile to set the scene size before expanding.';
    const shrink = button(`Shrink scene from ${direction}`, '\u2212', () => void run(async () => {
      if (await shrinkModularScene(state.scene, direction)) {
        if (direction === 'west') state.column = Math.max(0, state.column - 1);
        if (direction === 'north') state.row = Math.max(0, state.row - 1);
      }
    }));
    shrink.className = 'modular-live-shrink';shrink.dataset.shrink = direction;
    shrink.dataset.worldX = String(origin.x + x);shrink.dataset.worldY = String(origin.y + y);
    shrink.dataset.edgeOffsetX = direction === 'north' || direction === 'south' ? '42' : '0';
    shrink.dataset.edgeOffsetY = direction === 'west' || direction === 'east' ? '42' : '0';
    shrink.dataset.atMinimum = String(direction === 'north' || direction === 'south' ? layout.rows === 1 : layout.columns === 1);
    shrink.disabled = busy || shrink.dataset.atMinimum === 'true';root.append(shrink);
  }
  const undo = button('Undo last modular edit', 'Undo', () => void run(() => undoModularEdit(state.scene), false));
  undo.dataset.atMinimum = String(!canUndoModular(state.scene, false));undo.disabled = busy || undo.dataset.atMinimum === 'true';
  Object.assign(undo.style, {position:'absolute', bottom:'25px', left:'calc(50% - 150px)'});root.append(undo);
  const done = button('Finish modular scene editing', 'Done Building', () => void run(async () => {
    const {thumb} = await state.scene.createThumbnail();
    if (!thumb) throw new Error('Could not generate the scene thumbnail. Try Done Building again.');
    requireGM();
    await state.scene.update({thumb});
    assertStoredChanges(state.scene, {thumb});
    if (editing === state) {Hooks.callAll('pneumaModularFinished', state.scene);stopModularCanvas();}
  }, false));done.className = 'modular-live-done';
  Object.assign(done.style, {position:'absolute', bottom:'25px', left:'50%', transform:'translateX(-50%)'});root.append(done);
  root.querySelectorAll<HTMLElement>('[data-world-x]').forEach(element => {
    Object.assign(element.style, {position:'absolute', transform:'translate(-50%,-50%)'});
  });
  document.body.append(root);positionControls();
  Hooks.callAll('pneumaModularTarget', state.scene, state.column, state.row);
}
async function run(action: () => Promise<unknown>, record = true) {
  if (busy) return;
  setModularCanvasBusy(true);
  try {requireGM();if (record && editing) await recordModularEdit(editing.scene, action);else await action();Hooks.callAll('pneumaModularChanged');} catch(error) {ui.notifications?.error(error instanceof Error ? error.message : String(error));}
  finally {setModularCanvasBusy(false);refreshModularCanvas();}
}
function positionControls() {
  if (!root || !editing || !canvas.stage) return;
  const bounds = document.getElementById('board')?.getBoundingClientRect();
  const matrix = canvas.stage.worldTransform;
  const layout=modularLayout(editing.scene);
  if(layout){
    const origin=modularOrigin(editing.scene),x=origin.x+editing.column*layout.width,y=origin.y+editing.row*layout.height;
    const points=[[x,y],[x+layout.width,y],[x+layout.width,y+layout.height],[x,y+layout.height]]
      .map(([wx,wy])=>`${matrix.a*wx!+matrix.c*wy!+matrix.tx+(bounds?.left??0)},${matrix.b*wx!+matrix.d*wy!+matrix.ty+(bounds?.top??0)}`).join(' ');
    root.querySelectorAll('.modular-live-highlight polygon').forEach(outline=>outline.setAttribute('points',points));
  }
  const sidebar = document.getElementById('sidebar')?.getBoundingClientRect();
  const right = sidebar && sidebar.width > 50 ? sidebar.left - 24 : window.innerWidth - 40;
  root.querySelectorAll<HTMLElement>('[data-world-x]').forEach(element => {
    const wx = Number(element.dataset.worldX), wy = Number(element.dataset.worldY);
    let x = matrix.a * wx + matrix.c * wy + matrix.tx + (bounds?.left ?? 0);
    let y = matrix.b * wx + matrix.d * wy + matrix.ty + (bounds?.top ?? 0) + Number(element.dataset.offsetY ?? 0);
    const edge = !!element.dataset.direction || !!element.dataset.shrink;
    element.hidden = !edge && (x < 85 || x > right || y < 70 || y > window.innerHeight - 75);
    if (edge) {x = Math.max(100, Math.min(right, x));y = Math.max(90, Math.min(window.innerHeight - 80, y));}
    const offsetX = Number(element.dataset.edgeOffsetX ?? 0);
    x += x + offsetX > right ? -offsetX : offsetX;
    y += Number(element.dataset.edgeOffsetY ?? 0);
    element.style.left = `${x}px`;element.style.top = `${y}px`;
  });
}
export function registerModularCanvas() {
  Hooks.on('canvasPan', () => {cancelAnimationFrame(frame);frame = requestAnimationFrame(positionControls);});
  Hooks.on('canvasTearDown', () => {root?.remove();root = undefined;});
  Hooks.on('canvasReady', () => {
    if (editing && canvas.scene?.id !== editing.scene.id) stopModularCanvas();else refreshModularCanvas();
  });
  let refreshPending = false;
  const schedule = (scene: Scene | null) => {
    if (!editing || scene?.id !== editing.scene.id || busy || refreshPending) return;
    refreshPending = true;
    queueMicrotask(() => {
      refreshPending = false;
      if (!editing || scene?.id !== editing.scene.id || busy) return;
      canUndoModular(editing.scene);
      refreshModularCanvas();
    });
  };
  Hooks.on('updateScene', (scene: Scene) => schedule(scene));
  for (const type of ['Tile', 'Wall', 'Token', 'AmbientLight', 'AmbientSound', 'Note', 'MeasuredTemplate', 'Drawing', 'Region']) {
    for (const action of ['create', 'update', 'delete']) Hooks.on(action + type, (document: {parent: Scene | null}) => schedule(document.parent));
  }
  for (const action of ['create', 'update', 'delete']) Hooks.on(action + 'RegionBehavior', (document: {parent: {parent: Scene | null} | null}) => schedule(document.parent?.parent ?? null));
  Hooks.on('deleteScene', (scene: Scene) => {if (scene.id === editing?.scene.id) stopModularCanvas();});
  if (typeof window !== 'undefined') window.addEventListener('resize', positionControls);
}
