import {MODULE_ID} from "./settings.js";
import {basename, identifyImport, list, record, type ImportFile} from "./scene-data.js";
import {isFoundryFolder, isVideo, scanRoot, nameScore, parentPath} from "./matching.js";
import {planSelection, readSelection, setupSelection} from "./planning.js";
import {prepareScene, buildScene, applySceneOverrides, type PreparedScene} from "./scene-import.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";

const rootElement = (html: JQuery | HTMLElement) => html instanceof HTMLElement ? html : html[0]!;
let creator: SceneCreator | undefined;
let scanning = false;

export class SceneCreator extends FormApplication {
  private selection: ReturnType<typeof planSelection>;
  private scenes: PreparedScene[] = [];
  private busy = false;
  private failure = "";
  private importMode: "json" | "edit" | undefined;
  constructor(private map: string, private imports: ImportFile[], private files: string[], private warnings: string[]) {
    super({}); this.selection = planSelection(map, imports, files, warnings);
    this.importMode = imports.some(item=>item.kind === "Foundry Scene") ? undefined : "edit";
  }
  static override get defaultOptions(): FormApplicationOptions {
    return {...super.defaultOptions, title: "Quick Scene Creator", template: `modules/${MODULE_ID}/templates/scene-creator.hbs`, width: 720, height: "auto", resizable: true, closeOnSubmit: false, submitOnClose: false, submitOnChange: false};
  }
  override getData() {
    return {failure: this.failure, chooseImportMode: !this.importMode, edit: this.importMode === "edit", review: this.scenes.length > 0, mapName: basename(this.map), selection: this.selection,
      defaults: {darkness: game.settings!.get(MODULE_ID,"defaultDarkness"), globalLight: game.settings!.get(MODULE_ID,"defaultGlobalLight")},
      scenes: this.scenes.map((scene,index)=>({...scene,index,prefix:`scene${index}-`,title:basename(scene.map),open:this.scenes.length === 1,locked:scene.useJson || !!scene.created,
        hasAssets: scene.overlays.length > 0 || scene.unresolved.length > 0,
        wallCount:list(scene.data.walls).length,lightCount:list(scene.data.lights).length,tileCount:list(scene.data.tiles).length,
        tokenCount:list(scene.data.tokens).length,soundCount:list(scene.data.sounds).length,noteCount:list(scene.data.notes).length,drawingCount:list(scene.data.drawings).length}))};
  }
  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    const root = html[0]!;
    if (!this.importMode) return;
    root.querySelector("[data-make-changes]")?.addEventListener("click",()=>{
      this.importMode = "edit"; this.scenes.forEach(scene=>{scene.useJson=false;}); this.render(false);
    });
    if (!this.scenes.length) {
      setupSelection(root,this.selection,this.map);
      root.querySelector("[data-browse-json]")!.addEventListener("click",()=>new FilePicker({type:"any",callback:path=>{
        void (async()=>{
          const response=await fetch(path,{signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw new Error(`Could not read Scene file: HTTP ${response.status}`);
          const imported=identifyImport(await response.json(),path);
          if (!imported) throw new Error("Choose a Foundry Scene JSON or Universal VTT file.");
          this.imports=this.imports.filter(item=>item.path!==path);this.imports.push(imported);
          this.importMode=imported.kind === "Foundry Scene" ? undefined : "edit";
          this.selection=planSelection(this.map,this.imports,this.files,this.warnings,path);this.render(false);
        })().catch(error=>ui.notifications?.error(error instanceof Error?error.message:String(error)));
      }}).render(true));
      return;
    }
    for (const section of root.querySelectorAll<HTMLElement>("[data-scene]")) {
      const index = Number(section.dataset.scene), scene = this.scenes[index]!;
      if (!scene.created) setupPreview(section, scene);
    }
  }
  protected override async _updateObject(_event: Event, _submitted: Record<string, unknown>) {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!game.user?.isGM) throw new Error("Only the GM can create scenes.");
      if (!this.form) throw new Error("The Scene Creator form is unavailable.");
      if (!this.importMode) {
        this.importMode = new FormData(this.form as HTMLFormElement).get("importMode") === "edit" ? "edit" : "json";
        this.render(false); return;
      }
      if (!this.scenes.length) {
        const plans = readSelection(this.form as HTMLFormElement,this.selection);
        if (!plans.length) throw new Error("Select at least one scene.");
        const prepared: PreparedScene[] = [];
        for (const plan of plans) for (const map of plan.maps) prepared.push(await prepareScene(map, plan.selected, this.files, plan.maps.length > 1, this.importMode));
        this.scenes = prepared; this.failure = ""; this.render(false); return;
      }
      if (!this.form) throw new Error("The Scene Creator form is unavailable.");
      const values = new FormData(this.form as HTMLFormElement);
      const data = this.scenes.map((scene,i) => {
        if (scene.created) return undefined;
        return buildScene(scene,values,i);
      });
      const folder = await ensureSceneToolsFolder("Scene", WORLD_FOLDERS.scenes);
      for (let i = 0; i < data.length; i++) {
        if (!data[i]) continue;
        const draft = this.scenes[i]!, payload = data[i]!;
        let scene = draft.pending ? game.scenes?.get(draft.pending) : undefined;
        if (!scene) {
          const initial = draft.imported ? {name:draft.defaults.name,width:draft.defaults.width,height:draft.defaults.height,grid:draft.data.grid,active:false,folder:folder.id} : {...payload,folder:folder.id};
          scene = await Scene.create(initial as Scene.CreateData);
          if (scene?.id) draft.pending = scene.id;
        }
        if (!(scene instanceof Scene) || !scene.id || !game.scenes?.has(scene.id)) throw new Error("Foundry did not confirm the Scene was saved.");
        if (draft.imported) {
          await scene.importFromJSON(JSON.stringify(draft.source));
          await applySceneOverrides(scene,draft,payload);
        }
        this.scenes[i]!.created = scene.id;
        const section = this.form!.querySelector<HTMLElement>(`[data-scene="${i}"]`)!;
        section.querySelector<HTMLFieldSetElement>("fieldset")!.disabled = true;
        section.querySelector("summary")!.textContent = `${basename(this.scenes[i]!.map)} - saved`;
        try { if (!scene.thumb) { const thumb = await scene.createThumbnail(); await scene.update({thumb: thumb.thumb}); } }
        catch (error) { console.warn(`${MODULE_ID} | Thumbnail generation`,error); }
      }
      ui.notifications?.info(`Created ${this.scenes.length} scenes in SceneTools/Imported Scenes.`);
      this.busy = false; await this.close();
    } catch (error) {
      this.failure = `${error instanceof Error ? error.message : String(error)} (${this.scenes.filter(scene=>scene.created).length} scenes saved.)`;
      console.error(`${MODULE_ID} | Import`,error); ui.notifications?.error(this.failure);
      const message = this.form?.querySelector<HTMLElement>("[data-error]"); if (message) message.textContent = this.failure;
    } finally { this.busy = false; }
  }
  override async close(options?: Application.CloseOptions) {
    if (this.busy) return;
    creator = undefined; return super.close(options);
  }
}

export function openSceneCreator() {
  if (!game.user?.isGM || scanning) return;
  if (creator) { creator.render(true); return; }
  const picker = new FilePicker({type: "imagevideo", callback: path => {
    if (scanning) return; scanning = true;
    const source = picker.activeSource, folder = picker.sources[source]?.target ?? parentPath(path);
    const bucket = source === "s3" ? picker.sources.s3?.bucket : undefined;
    void (async()=>{
      ui.notifications?.info("Finding nearby Scene files…");
      const scan = await scanFolders(scanRoot(folder), target=>FilePicker.browse(source,target,{bucket}));
      if (!scan.files.includes(path)) scan.files.push(path);
      const found = await readImports(scan.files,path);
      creator = new SceneCreator(path,found.imports,scan.files,[...scan.warnings,...found.warnings]);
      creator.render(true);
    })().catch(error=>{console.error(`${MODULE_ID} | Scan`,error);ui.notifications?.error(error instanceof Error ? error.message : String(error));}).finally(()=>{scanning=false;});
  }});
  picker.render(true);
}
export async function scanFolders(start: string, browse: (path: string) => Promise<{files: string[]; dirs: string[]}>, progress?: (count: number) => void) {
  const queue = [start], visited = new Set<string>(), files = new Set<string>(), warnings: string[] = [];
  while (queue.length) {
    const folder = queue.shift()!;
    if (visited.has(folder)) continue;
    if (visited.size >= 500) { warnings.push("Folder scan stopped at 500 folders. Narrow the selected folder to scan remaining files."); break; }
    visited.add(folder); progress?.(visited.size);
    try {
      const result = await browse(folder);
      for (const file of result.files) files.add(file);
      queue.push(...result.dirs.sort((a, b) => Number(isFoundryFolder(b)) - Number(isFoundryFolder(a)) || a.localeCompare(b)));
    } catch { warnings.push(`Could not browse ${folder}`); }
  }
  return {files: [...files], warnings};
}

async function readImports(files: string[], map: string) {
  const imports: ImportFile[] = [], warnings: string[] = [];
  const jsonFiles = files.filter(path => /\.(json|dd2vtt|uvtt|df2vtt)(?:[?#].*)?$/i.test(path));
  const named = jsonFiles.filter(path => nameScore(path, map, true) >= 50);
  const conventional = jsonFiles.filter(path => isFoundryFolder(parentPath(path)));
  const candidates = [...new Set([...named,...conventional])];
  for (const path of candidates) {
    try {
      const response = await fetch(path, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const item = identifyImport(await response.json(), path);
      if (item) imports.push(item);
    } catch { warnings.push(`Could not read ${basename(path)}`); }
  }
  return {imports, warnings};
}

function setupPreview(root: HTMLElement, scene: PreparedScene) {
  const form = root, canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const walls = list(scene.data.walls), lights = list(scene.data.lights);
  const geometry = walls.length || lights.length ? new Scene(scene.data as Scene.CreateData).getDimensions() : {sceneX:0,sceneY:0};
  const image = isVideo(scene.map) ? document.createElement("video") : new Image();
  if (image instanceof HTMLVideoElement) { image.preload = "auto"; image.muted = true; }
  const update = () => {
    const values = {get: (name: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`)!.value}, choice = String(values.get("gridChoice"));
    const custom = form.querySelector<HTMLInputElement>('[data-field="customGrid"]')!;
    custom.disabled = choice !== "custom";
    const width = Number(values.get("width")), height = Number(values.get("height"));
    const size = choice === "custom" ? Number(custom.value) : Number(choice);
    const ctx = canvas.getContext("2d"); if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / width, canvas.height / height), w = width * scale, h = height * scale;
    if (image instanceof HTMLVideoElement ? image.readyState >= 2 : image.complete && image.naturalWidth) ctx.drawImage(image, 0, 0, w, h);
    const square = values.get("gridType") === "1" && choice !== "gridless";
    if (square && size >= 50 && size * scale >= 2) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += size * scale) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0; y <= h; y += size * scale) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath();
    for (const wall of walls) {
      const coordinates = list(record(wall).c).map(Number);
      if (coordinates.length !== 4 || !coordinates.every(Number.isFinite)) continue;
      ctx.moveTo((coordinates[0]! - geometry.sceneX)*scale,(coordinates[1]! - geometry.sceneY)*scale);
      ctx.lineTo((coordinates[2]! - geometry.sceneX)*scale,(coordinates[3]! - geometry.sceneY)*scale);
    }
    ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#ffbb44";
    for (const light of lights) {
      const data = record(light), x = Number(data.x), y = Number(data.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      ctx.beginPath();ctx.arc((x-geometry.sceneX)*scale,(y-geometry.sceneY)*scale,4,0,Math.PI*2);ctx.fill();
    }
    root.querySelector(".pneuma-grid-count")!.textContent = choice === "gridless" ? "Gridless" : `${(width / size).toFixed(2)} × ${(height / size).toFixed(2)} grid units${square ? "" : " — hex preview available in Scene configuration"}`;
  };
  if (image instanceof HTMLVideoElement) image.onloadeddata = update; else image.onload = update;
  image.src = scene.map;
  form.addEventListener("input", update); form.addEventListener("change", update); update();
}

export function registerSceneCreator() {
  const addButton = (html: JQuery | HTMLElement) => {
    if (!game.user?.isGM) return;
    const root = rootElement(html);
    if (!root || root.querySelector(".pneuma-scene-create")) return;
    const container = root.querySelector(".directory-header .header-actions, .directory-header .action-buttons")
      ?? root.querySelector(".directory-header") ?? root.querySelector(".directory-footer") ?? root;
    const button = document.createElement("button");
    button.type = "button"; button.className = "pneuma-scene-create";
    button.innerHTML = '<i class="fas fa-map"></i> Quick Scene Creator';
    button.addEventListener("click", openSceneCreator); container.append(button);
  };
  Hooks.on("renderSceneDirectory", (_app: unknown, html: JQuery | HTMLElement) => addButton(html));
  Hooks.on("renderSidebarTab", (app: SidebarTab, html: JQuery | HTMLElement) => {
    if (app.tabName === "scenes") addButton(html);
  });
  Hooks.on("ready", () => {
    const existing = ui.scenes?.element;
    if (existing?.length) addButton(existing);
  });
}



