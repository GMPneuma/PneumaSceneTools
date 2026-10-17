import {tileThumbnail,loadTileThumbnail,clearTileThumbnails} from './modular-thumbnails.js';
import {recordModularEdit} from './modular-undo.js';
import {MODULE_ID} from "./settings.js";
import {basename} from "./scene-data.js";
import {bounded} from "./io.js";
import {isVideo} from "./matching.js";
import {registerModularCanvas, startModularCanvas, setModularCanvasBusy, refreshModularCanvas} from "./modular-canvas.js";
import {ArtworkFolderPicker} from "./artwork-folder-picker.js";
import {cellTile, createModularScene, createNamedModularScene, modularLayout, placeModularTile, requireGM} from "./modular-scenes.js";

interface Collection {id: string; name: string; path: string; source: FilePicker.SourceType; bucket?: string}
declare global {interface SettingConfig {"pneuma-scenetools.modularCollections": Collection[]}}
const collections = (): Collection[] => game.settings!.get(MODULE_ID, "modularCollections") ?? [];
const imageFile = (path: string) => /\.(?:avif|gif|apng|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(path) || isVideo(path);
const animatedFile = (path: string) => isVideo(path) || /\.(?:gif|apng)(?:[?#].*)?$/i.test(path);

const modularImageSizes = new Map<string, {width:number; height:number} | null>();

interface PickerMemory {collection: string; tab: 'static' | 'animated'; scroll: Record<string, number>}
const preferenceKey = () => `pneuma-modular-picker:${game.world?.id ?? 'world'}:${game.user?.id ?? 'user'}`;
function readMemory(): PickerMemory {
  try {const value = JSON.parse(localStorage.getItem(preferenceKey()) ?? '{}');return {collection:String(value.collection ?? ''), tab:value.tab === 'animated' ? 'animated' : 'static', scroll:value.scroll ?? {}};} catch {return {collection:'', tab:'static', scroll:{}};}
}
export class ModularSceneCreator extends Application {
  private memory = readMemory();
  private sizes = modularImageSizes;
  private scanning = false;
  private scanAbort = new AbortController();
  private showIncompatible = false;
  private scrollKey() {return this.collectionId + ':' + this.mediaTab;}
  private saveMemory() {
    this.memory.collection = this.collectionId;this.memory.tab = this.mediaTab;
    try {localStorage.setItem(preferenceKey(), JSON.stringify(this.memory));} catch { /* Session state still works when storage is unavailable. */ }
  }
  private async scanSizes() {
    if (this.scanning || this.scanAbort.signal.aborted) return;
    const signal=this.scanAbort.signal;
    const pending = this.files.filter(path => animatedFile(path) === (this.mediaTab === 'animated') && !this.sizes.has(path));
    if (!pending.length) return;
    this.scanning = true;
    const scope = this.scrollKey();
    await Promise.all(Array.from({length:Math.min(2,pending.length)}, async () => {
      while (pending.length && !signal.aborted && scope === this.scrollKey()) {
        const path = pending.shift()!;
        try {this.sizes.set(path, await loadTileThumbnail(path, signal));} catch {if (!signal.aborted) this.sizes.set(path,null);}
        if (!signal.aborted && scope === this.scrollKey()) this.updateSizeResults();
      }
    }));
    if(signal!==this.scanAbort.signal)return;
    this.scanning = false;
    if (!signal.aborted) {this.updateSizeResults();void this.scanSizes();}
  }
  private sceneId = "";
  private placementOnly = false;
  private collectionId = "";
  private files: string[] = [];
  private chosen = "";
  private preview = "";
  private search = "";
  private mediaTab: "static" | "animated" = "static";
  private column = 0;
  private row = 0;
  private busy = false;
  private closeAfter = false;
  private status = "Add a collection, then select an image to create a scene.";
  private sceneName = "Modular Scene";
  private gridSize = 100;
  private request = 0;
  private initialBrowse = true;
  private drawing = false;
  private closed = false;
  private redrawPending = false;
  private hooks: [string, number][] = [];
  static override get defaultOptions(): Application.Options {
    return {...super.defaultOptions, id: "pneuma-modular-creator", title: "Modular Scene Creator",
      template: `modules/${MODULE_ID}/templates/modular-creator.hbs`, width: 680, height: 520, resizable: true,
      classes: [...(super.defaultOptions.classes ?? []), "pneuma-modular-creator"]};
  }
  constructor() {
    super();
    this.gridSize = game.settings!.get(MODULE_ID, "defaultGrid");
    if (modularLayout(canvas.scene)) this.sceneId = canvas.scene!.id!;
    this.collectionId = collections().find(c => c.id === this.memory.collection)?.id ?? collections()[0]?.id ?? "";
    this.mediaTab = this.memory.tab;
    let refreshPending = false;
    for (const hook of ["updateScene", "deleteScene", "createTile", "updateTile", "deleteTile", "createWall", "updateWall", "deleteWall", "updateSetting", "pneumaModularChanged"]) {
      this.hooks.push([hook, Hooks.on(hook, (document: {id?: string; key?: string; parent?: {id?: string}}) => {
        if (hook === "updateSetting" ? document?.key !== MODULE_ID + ".modularCollections"
          : hook !== "pneumaModularChanged" && (hook.endsWith("Scene") ? document?.id : document?.parent?.id) !== this.sceneId) return;
        if (refreshPending || !this.rendered || this.busy) return;
        refreshPending = true;
        queueMicrotask(() => {refreshPending = false;if (this.rendered && !this.busy && !this.closed) this.render(false);});
      })]);
    }
    this.hooks.push(['pneumaModularFinished', Hooks.on('pneumaModularFinished', () => {void this.close();})]);
    this.hooks.push(['canvasReady', Hooks.on('canvasReady', () => {if (canvas.scene?.id !== this.sceneId) void this.close();})]);
    this.hooks.push(['pneumaModularTarget', Hooks.on('pneumaModularTarget', (scene: Scene, column: number, row: number) => {if (!this.busy && scene.id === this.sceneId && (column !== this.column || row !== this.row)) this.selectSpace(scene, column, row);})]);
  }
  override render(force = false, options: Application.RenderOptions = {}) {
    if (this.closed) return this;
    if (this.drawing) {this.redrawPending = true;return this;}
    return super.render(force, options);
  }
  protected override async _render(force = false, options: Application.RenderOptions = {}): Promise<void> {
    if (this.closed) return;
    if (this.drawing) {this.redrawPending = true;return;}
    this.drawing = true;this.redrawPending = false;
    try {await super._render(force, options);}
    finally {
      this.drawing = false;
      if (this.redrawPending && this.rendered) {this.redrawPending = false;this.render(false);}
    }
    if (this.closed) {await super.close();return;}
    void this.scanSizes();
    // Foundry drops render requests made while the first render is in progress.
    // Start browsing only after that render, rather than in the constructor.
    if (this.initialBrowse && this.rendered) {
      this.initialBrowse = false;
      if (this.collectionId) void this.run(() => this.browse());
    }
  }
  private get scene(): Scene | undefined {return game.scenes?.get(this.sceneId) as Scene | undefined;}
  selectSpace(scene: Scene, column: number, row: number) {if (this.busy) return;this.placementOnly = true;this.sceneId = scene.id!;this.column = column;this.row = row;this.render(true);}
  openSetup() {this.placementOnly = false;this.render(true);}
  override getData() {
    const scene = this.scene, layout = modularLayout(scene);
    if (layout) {this.column = Math.min(this.column, layout.columns - 1);this.row = Math.min(this.row, layout.rows - 1);}
    const tile = scene && cellTile(scene, this.column, this.row);
    const candidates = this.files.filter(path => animatedFile(path) === (this.mediaTab === 'animated'));
    const needsSize = !!layout && !layout.awaitingFirstTile;
    const compatible = (path: string) => !needsSize || (this.sizes.get(path)?.width === layout!.width && this.sizes.get(path)?.height === layout!.height);
    const files = candidates;
    const available = files.filter(path => compatible(path) || this.showIncompatible && this.sizes.has(path));
    const checking = needsSize && candidates.some(path => !this.sizes.has(path));
    const preview = available.includes(this.preview) ? this.preview : available.includes(this.chosen) ? this.chosen : available[0];
    return {placementOnly: this.placementOnly, busy: this.busy, status: checking ? 'Checking tile dimensions…' : this.status, showIncompatible:this.showIncompatible, needsSize, sceneName: this.sceneName, gridSize: this.gridSize,
      scenes: this.placementOnly ? [] : ((game.scenes?.contents ?? []) as Scene[]).filter(s => {
        // An unrelated malformed scene must not prevent this picker from opening.
        try {return !!modularLayout(s);} catch {return false;}
      }).map(s => ({id: s.id, name: s.name, selected: s.id === this.sceneId})),
      collections: collections().map(c => ({...c, selected: c.id === this.collectionId})), hasCollection: !!this.collectionId,
      files: files.map(path => ({path, thumbnail:tileThumbnail(path)?.src, pending:!this.sizes.has(path), incompatible:!compatible(path), video: isVideo(path), name: basename(path), selected: path === this.chosen, hidden: (!compatible(path)&&!this.showIncompatible)||!basename(path).toLocaleLowerCase().includes(this.search.toLocaleLowerCase())})),
      staticTab: this.mediaTab === 'static', animatedTab: this.mediaTab === 'animated', emptyTab: !files.length,
      search: this.search, preview, previewVideo: !!preview && isVideo(preview), canPlace: !!this.chosen,
      layout, occupied: !!tile, column: this.column + 1, row: this.row + 1,
      rectangular: !!layout && layout.width !== layout.height};
  }
  private previewTile(root:HTMLElement, path:string) {
    this.preview = path;
    const container = root.querySelector<HTMLElement>('.modular-large-preview');
    const old = container?.querySelector<HTMLImageElement | HTMLVideoElement>('img, video');
    if (old?.getAttribute('src') !== path && container) {
      if (old instanceof HTMLVideoElement) {old.pause();old.removeAttribute('src');old.load();}
      old?.remove();
      const media = document.createElement(isVideo(path) ? 'video' : 'img');
      if (media instanceof HTMLVideoElement) {media.disablePictureInPicture = true;media.muted = true;media.loop = true;media.autoplay = true;media.playsInline = true;}
      else media.alt = 'Tile preview';
      media.src = path;container.prepend(media);
      if (media instanceof HTMLVideoElement) void media.play().catch(() => {});
    }
    const hint = root.querySelector<HTMLElement>('.modular-preview-hint');
    if (hint) hint.hidden = true;
  }
  /** Update compatibility in place; keep decoded thumbnails, preview and focus intact. */
  private updateSizeResults() {
    const root=this.element[0];
    if(!root||!this.rendered||this.closed)return;
    const layout=modularLayout(this.scene),needsSize=!!layout&&!layout.awaitingFirstTile;
    const desiredScroll=this.memory.scroll[this.scrollKey()]??0;
    let first:string|undefined;
    for(const button of root.querySelectorAll<HTMLButtonElement>('.modular-image')){
      const path=button.dataset.path!,size=this.sizes.get(path),pending=needsSize&&!this.sizes.has(path);
      const compatible=!needsSize||!!size&&size.width===layout!.width&&size.height===layout!.height;
      button.hidden=(!compatible&&!this.showIncompatible)||!basename(path).toLocaleLowerCase().includes(this.search.toLocaleLowerCase());
      button.disabled=this.busy||!compatible;
      if(compatible)button.removeAttribute('title');
      else button.title=pending?'Checking tile dimensions…':'Image dimensions do not match this scene, or could not be read';
      if(!pending&&!button.hidden){
        const media=button.querySelector<HTMLImageElement|HTMLVideoElement>('img,video');
        const thumbnail=tileThumbnail(path);
        if(media&&thumbnail&&!media.getAttribute('src'))media.src=thumbnail.src;
        if(compatible)first??=path;
      }
    }
    const grid=root.querySelector<HTMLElement>('.modular-images');
    if(grid&&desiredScroll&&grid.scrollHeight-grid.clientHeight>=desiredScroll)grid.scrollTop=desiredScroll;
    if(first&&!root.querySelector('.modular-large-preview [src]'))this.previewTile(root,first);
    const status=root.querySelector<HTMLElement>('.modular-status');
    const checking=needsSize&&this.files.some(path=>animatedFile(path)===(this.mediaTab==='animated')&&!this.sizes.has(path));
    if(status)status.textContent=checking?'Checking tile dimensions…':this.status;
  }
  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    const root = html[0]!;
    const grid = root.querySelector<HTMLElement>('.modular-images');
    if (grid) {
      const key = this.scrollKey();
      grid.scrollTop = this.memory.scroll[key] ?? 0;
      grid.addEventListener('scroll', () => {if (grid.isConnected) {this.memory.scroll[key] = grid.scrollTop;this.saveMemory();}});
    }
    root.querySelector<HTMLInputElement>('[name=showIncompatible]')?.addEventListener('change', event => {this.showIncompatible = (event.target as HTMLInputElement).checked;this.render(false);});
    root.querySelectorAll<HTMLButtonElement>('.modular-image').forEach(button => {
      const preview = () => this.previewTile(root, button.dataset.path!);
      button.addEventListener('mouseenter', preview);button.addEventListener('focus', preview);
    });
    root.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach(button => button.addEventListener("click", () => {
      if (this.busy) return;
      void this.run(() => this.action(button.dataset.action!, button));
    }));
    root.querySelector<HTMLSelectElement>("[name=scene]")?.addEventListener("change", event => {
      this.sceneId = (event.target as HTMLSelectElement).value; this.column = this.row = 0; this.render(false);
    });
    root.querySelector<HTMLSelectElement>("[name=collection]")?.addEventListener("change", event => {
      this.collectionId = (event.target as HTMLSelectElement).value;this.saveMemory();
      void this.run(() => this.browse());
    });
    root.querySelector<HTMLInputElement>("[name=search]")?.addEventListener("input", event => {
      this.search = (event.target as HTMLInputElement).value;
      // Filter in place to preserve keyboard focus and caret position.
      this.updateSizeResults();
    });
    root.querySelector<HTMLInputElement>("[name=sceneName]")?.addEventListener("input", event => {this.sceneName = (event.target as HTMLInputElement).value;});
    root.querySelector<HTMLInputElement>("[name=gridSize]")?.addEventListener("input", event => {this.gridSize = Number((event.target as HTMLInputElement).value);});
  }
  private async run(action: () => Promise<unknown>) {
    if (this.busy) return;
    this.busy = true;
    setModularCanvasBusy(true);
    const fieldset = this.element[0]?.querySelector('fieldset');
    if (fieldset) fieldset.disabled = true;
    try {requireGM(); await action();}
    catch (error) {this.status = error instanceof Error ? error.message : String(error); ui.notifications?.error(this.status);}
    finally {
      this.busy = false;setModularCanvasBusy(false);refreshModularCanvas();
      // Unlock the existing DOM even if a concurrent Foundry render is skipped.
      const current = this.element[0]?.querySelector('fieldset');
      if (current) current.disabled = false;
      if (this.closeAfter) {this.closeAfter = false;await this.close();}
      else {this.redrawPending = true;this.render(false);}
    }
  }
  private async browse() {
    const request = ++this.request, collection = collections().find(c => c.id === this.collectionId);
    this.saveMemory();
    this.files = []; this.chosen = ""; this.preview = ""; this.search = "";
    if (!collection) return;
    const result = await bounded(FilePicker.browse(collection.source, collection.path, {bucket: collection.bucket}), new AbortController().signal);
    if (request !== this.request) return;
    this.files = result.files.filter(imageFile).sort((a, b) => basename(a).localeCompare(basename(b), undefined, {numeric: true}));
    this.status = this.files.length ? `${this.files.length} images. Select a tile below. Each collection uses the images directly inside its folder.` : "No supported images in this folder. Add its image subfolder as a collection.";
  }
  private async action(action: string, button: HTMLButtonElement): Promise<void> {
    if (action === 'filter-static' || action === 'filter-animated') {
      this.mediaTab = action === 'filter-static' ? 'static' : 'animated';
      this.saveMemory();this.preview = '';this.chosen = '';return;
    }
    if (action === "add") {
      const picker = new ArtworkFolderPicker({type: "folder", callback: path => {
        void this.run(async () => {
          const name = await Dialog.prompt({title: "Add Modular Collection", content: '<div class="form-group"><label>Collection name</label><input name="collectionName" type="text" maxlength="100" /></div>',
            label: "Add Collection", callback: html => String(html.find("[name=collectionName]").val() ?? "").trim(), rejectClose: false});
          if (!name) return;
          const current = collections();
          if (current.some(c => c.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("A collection already has that name.");
          const collection: Collection = {id: foundry.utils.randomID(), name, path, source: picker.activeSource,
            ...(picker.activeSource === "s3" ? {bucket: picker.sources.s3?.bucket} : {})};
          await game.settings!.set(MODULE_ID, "modularCollections", [...current, collection]);
          this.collectionId = collection.id; await this.browse();
        });
      }});
      picker.render(true); return;
    }
    if (action === "refresh") {this.scanAbort.abort();this.scanAbort=new AbortController();this.scanning=false;await clearTileThumbnails(this.files);for(const path of this.files)this.sizes.delete(path);return this.browse();}
    if (action === "forget") {
      const collection = collections().find(c => c.id === this.collectionId);
      if (!collection || !await Dialog.confirm({title: "Remove collection?", content: "<p>Remove this collection from the picker? Existing scene tiles and image files are kept.</p>"})) return;
      await game.settings!.set(MODULE_ID, "modularCollections", collections().filter(c => c.id !== collection.id));
      this.collectionId = collections()[0]?.id ?? ""; return this.browse();
    }
    if (action === "choose") {
      this.chosen = button.dataset.path!;this.preview = this.chosen;
      if (this.scene) return this.action('place', button);
      this.status = 'Reference image selected. Create a blank scene when ready.';return;
    }
    if (action === "create") {
      if (!this.chosen) throw new Error("Select an image first.");
      const scene = await createModularScene(this.sceneName, this.chosen, this.gridSize);
      this.sceneId = scene.id!; this.column = this.row = 0;
      await scene.view();startModularCanvas(scene, openCanvasPicker);this.closeAfter = true;return;
    }
    const scene = this.scene;
    if (!scene) throw new Error("Choose a modular scene.");
    if (action === "view") {await scene.view();startModularCanvas(scene, openCanvasPicker);this.closeAfter = true;return;}

    if (action === "place") {
      if (canvas.scene?.id !== scene.id) throw new Error("Return to this scene before placing a tile.");
      if (!this.chosen) throw new Error("Select an image first.");
      await recordModularEdit(scene, () => placeModularTile(scene, this.column, this.row, this.chosen));
      startModularCanvas(scene, openCanvasPicker, this.column, this.row);this.status = 'Tile placed. Select another space on the canvas, or choose a tile to replace this one.';return;
    }
  }
  override async close(options?: Application.CloseOptions) {
    if (this.busy) {ui.notifications?.warn("Wait for the current modular scene operation to finish.");return;}
    this.closed = true;this.saveMemory();this.scanAbort.abort();
    this.request++;
    for (const [name, id] of this.hooks) Hooks.off(name, id);
    this.hooks = [];
    await super.close(options);
    if (creator === this) creator = undefined;
  }
}
let creator: ModularSceneCreator | undefined;
let creating = false;
export async function promptModularScene() {
  if (creating || !game.user?.isGM) return;
  creating = true;
  try {
    requireGM();
    const name = await Dialog.prompt({title:'Modular Scene Creator', content:`
      <section class="modular-new-intro">
      <h2>Build a modular scene</h2>
      <p>This creates a map that you can expand by adding more tiles to build a custom scene.</p>
      <p>Use a set of consistently sized map images designed to fit together properly.</p>
      <section class="modular-new-pack"><h3>Recommended map pack</h3>
      <p>You can find four such sets from Solution Maps, one of the best mapmakers for Cyberpunk.</p>
        <a href="https://www.drivethrurpg.com/en/product/472222/cyberpunk-modular-tile-pack-hd-print-edition-animated-battle-map-bundle?affiliate_id=445711" target="_blank" rel="noopener noreferrer">Solution Maps Modular Pack</a>
      </section>
      <section class="modular-new-warning"><h3><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Large scene performance</h3>
        <p>If you want to build a large scene, it is highly recommended to:</p>
        <ul><li>Use lower-resolution tiles.</li><li>Include only a few animated tiles.</li></ul>
        <p>Huge maps at high resolution and multiple animated tiles may seriously impact performance on players with slower devices.</p>
      </section></section>
      <div class="form-group modular-new-name"><label for="pneuma-modular-scene-name">Scene name</label><div class="form-fields"><input id="pneuma-modular-scene-name" type="text" name="sceneName" autofocus maxlength="200"></div></div>`,
      label:'Create Scene', options:{id:"pneuma-new-modular",width:560}, callback:html => String(html.find('[name=sceneName]').val() ?? '').trim(), rejectClose:false});
    if (!name) return;
    const scene = await createNamedModularScene(name);
    await scene.view();startModularCanvas(scene, openCanvasPicker);
  } catch (error) {ui.notifications?.error(error instanceof Error ? error.message : String(error));}
  finally {creating = false;}
}
function openCanvasPicker(scene: Scene, column: number, row: number) {
  creator ??= new ModularSceneCreator();creator.selectSpace(scene, column, row);
}
export function openModularSceneCreator() {
  if (!game.user?.isGM) return;
  if (modularLayout(canvas.scene)) {startModularCanvas(canvas.scene!, openCanvasPicker);return;}
  void promptModularScene();
}
export function registerModularCreator() {
  registerModularCanvas();
  game.settings!.register(MODULE_ID, "modularCollections", {scope: "world", config: false, type: Array, default: []});
  Hooks.on("renderSceneDirectory", (_app: unknown, html: JQuery) => {
    if (!game.user?.isGM || html[0]?.querySelector(".pneuma-modular-open")) return;
    const root=html[0];const header=root&&sceneToolsRow(root);
    if (!header) return;
    const button = document.createElement("button");button.type = "button";button.className = "pneuma-modular-open";
    button.innerHTML = '<i class="fas fa-person-digging" aria-hidden="true"></i> Modular';
    button.title="Scene Tools - Modular Scene Creator";button.setAttribute("aria-label",button.title);
    button.addEventListener("click", () => void promptModularScene());header.append(button);
  });
  Hooks.on("getSceneControlButtons", (controls: SceneControl[]) => {
    if (!game.user?.isGM) return;
    controls.find(control => control.name === "tiles")?.tools.push({name: "modular-scene", title: "Modular Scene Creator", icon: "fas fa-border-all", button: true, onClick: openModularSceneCreator});
  });
  return {openModularSceneCreator};
}
import {sceneToolsRow} from "./scene-directory-tools.js";
