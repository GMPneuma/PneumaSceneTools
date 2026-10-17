import {bounded} from "./io.js";
import {MODULE_ID} from "./settings.js";
import {basename, identifyImport, list, record, type ImportFile} from "./scene-data.js";
import {isFoundryFolder, isMedia, isOverlay, isVideo, nameScore, parentPath} from "./matching.js";
import {planSelection, readSelection, setupSelection} from "./planning.js";
import {prepareScene, buildScene, applySceneOverrides, type PreparedScene} from "./scene-import.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";
import {refreshSceneThumbnail} from "./scene-thumbnail.js";
import {SceneFolderPicker} from "./scene-folder-picker.js";

const rootElement = (html: JQuery | HTMLElement) => html instanceof HTMLElement ? html : html[0]!;
function appearance(data: Record<string, unknown>) {
  const grid = record(data.grid), style = String(grid.style ?? "solidLines");
  const styles = typeof CONFIG !== "undefined" ? CONFIG.Canvas?.gridStyles : undefined;
  const choices = Object.entries(styles ?? {solidLines:{label:"Solid Lines"}}).map(([value,entry])=>({value,label:game.i18n?.localize(entry.label) ?? entry.label,selected:value === style}));
  if (!choices.some(choice=>choice.selected)) choices.push({value:style,label:style,selected:true});
  return {padding:Number(data.padding ?? 0.25)*100,thickness:Number(grid.thickness ?? 1),color:"#000000",alpha:Number(grid.alpha ?? 0.2),styles:choices};
}
let creator: SceneCreator | undefined;

function captureFields(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name], select[name]"), field => ({
    name: field.name, value: field.value, checked: field instanceof HTMLInputElement && field.checked,
    options: field instanceof HTMLSelectElement ? Array.from(field.options, option => ({value: option.value, text: option.text})) : undefined
  }));
}
function restoreFields(root: HTMLElement, fields: ReturnType<typeof captureFields>) {
  for (const saved of fields) {
    const field = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name], select[name]")).find(field => field.name === saved.name);
    if (!field) continue;
    if (field instanceof HTMLSelectElement) for (const option of saved.options ?? []) {
      if (!Array.from(field.options).some(existing => existing.value === option.value)) field.add(new Option(option.text, option.value));
    }
    field.value = saved.value;
    if (field instanceof HTMLInputElement) field.checked = saved.checked;
  }
}

export class SceneCreator extends FormApplication {
  private selection: ReturnType<typeof planSelection>;
  private scenes: PreparedScene[] = [];
  private busy = false;
  private preparation?: AbortController;
  private failure = "";
  private reviewing = false;
  private selectedScene = 0;
  private selectionFields: ReturnType<typeof captureFields> = [];
  private reviewFields: ReturnType<typeof captureFields> = [];
  private preparedSelection = "";
  private folderStep = true;
  private folderPath = "";
  private folderLoading = false;
  private folderPicker = new SceneFolderPicker((loading,error)=>{
    this.folderLoading = loading;
    const root = this.element?.[0];
    if (!this.folderStep || !root) return;
    const next = root.querySelector<HTMLButtonElement>('[data-folder-next]');
    if (next) next.disabled = loading || !!error;
    const status = root.querySelector<HTMLElement>('[data-folder-status]');
    if (status) status.textContent = error ? `Could not browse folder: ${String(error)}` : loading ? "Loading folder…" : "";
  },()=>{if (!this.busy && !this.folderLoading) (this.form as HTMLFormElement | null)?.requestSubmit();});
  private scannedFolder = "";
  private get canGoBack() { return !this.scenes.some(scene => scene.created || scene.pending); }
  constructor(private map = "", private imports: ImportFile[] = [], private files: string[] = [], private warnings: string[] = []) {
    super({}); this.selection = planSelection(map, imports, files, warnings);
  }
  static override get defaultOptions(): FormApplicationOptions {
    return {...super.defaultOptions, classes:[...(super.defaultOptions.classes ?? []),"pneuma-scene-creator-window"], title: "Quick Scene Importer", template: `modules/${MODULE_ID}/templates/scene-creator.hbs`,
      width: Math.min(1400,(globalThis.innerWidth || 1440)-40), height: Math.min(850,(globalThis.innerHeight || 890)-40),
      resizable: true, closeOnSubmit: false, submitOnClose: false, submitOnChange: false};
  }
  override getData() {
    return {failure: this.failure, review: this.reviewing, folderStep:this.folderStep, selecting:!this.folderStep && !this.reviewing,
      folderPath:this.folderPath,
      canGoBack: this.canGoBack, mapName: basename(this.map), selection: this.selection,
      defaults: {darkness: game.settings!.get(MODULE_ID,"defaultDarkness"), globalLight: game.settings!.get(MODULE_ID,"defaultGlobalLight")},
      sharedAppearance: appearance(this.scenes[0]?.data ?? {}),
      scenes: this.scenes.map((scene,index)=>({...scene,index,prefix:`scene${index}-`,title:basename(scene.map),selected:index === this.selectedScene,locked:!!scene.created,
        appearance:appearance(scene.data),
        missingForeground: typeof scene.data.foreground === "string" && !!scene.data.foreground && !this.files.includes(scene.data.foreground),
        foregroundOptions: [...new Set([
          ...(typeof scene.data.foreground === "string" && this.files.includes(scene.data.foreground) ? [scene.data.foreground] : []),
          ...this.files.filter(file=>isMedia(file) && parentPath(file) === parentPath(scene.map))
        ])].map(path=>({path,label:basename(path),selected:path === scene.data.foreground})),
        distanceOptions: [
          ...[1,2,4].map(distance => ({value:String(distance),label:`${distance} m${scene.imported && record(scene.source?.grid).distance === distance ? " (Imported)" : ""}`,selected:scene.defaults.units === "m" && scene.defaults.distance === distance})),
          ...([1,2,4].includes(scene.defaults.distance) && scene.defaults.units === "m" ? [] : [{value:"imported",label:`${scene.defaults.distance} ${scene.defaults.units} (Imported)`,selected:true}])
        ],
        imageAssets: ["tiles", "tokens"].flatMap(collection => list(scene.data[collection]).flatMap((item,index) => {
          const path = record(record(item).texture).src;
          return typeof path === "string" && path ? [{collection,index,path,label:`${collection === "tiles" ? "Tile" : "Token"} ${index + 1}`,
            options:this.files.filter(file=>isMedia(file) && file !== path && parentPath(file) === parentPath(scene.map))}] : [];
        })),
        wallCount:list(scene.data.walls).length,lightCount:list(scene.data.lights).length,tileCount:list(scene.data.tiles).length,
        tokenCount:list(scene.data.tokens).length,soundCount:list(scene.data.sounds).length,noteCount:list(scene.data.notes).length,drawingCount:list(scene.data.drawings).length}))};
  }
  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    const root = html[0]!;
    if (this.folderStep) {
      root.querySelector('[data-cancel-scan]')?.addEventListener('click',()=>this.preparation?.abort());
      this.folderPicker.mount(root.querySelector<HTMLElement>('[data-native-folder]')!);
      return;
    }
    this.folderPicker.detach();
    restoreFields(root, this.reviewing ? this.reviewFields : this.selectionFields);
    root.querySelector("[data-back]")?.addEventListener("click",()=>{
      if (this.busy || !this.canGoBack) return;
      if (this.reviewing) { this.reviewFields = captureFields(root); this.reviewing = false; }
      else { this.selectionFields = captureFields(root); this.folderStep = true; }
      this.failure = ""; this.render(false);
    });
    if (!this.reviewing) {
      setupSelection(root,this.selection,this.map);
      root.querySelector("[data-browse-json]")!.addEventListener("click",()=>new FilePicker({type:"any",callback:path=>{
        void (async()=>{
          const response=await fetch(path,{signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw new Error(`Could not read Scene file: HTTP ${response.status}`);
          const imported=identifyImport(await response.json(),path);
          if (!imported) throw new Error("Choose a Foundry Scene JSON or Universal VTT file.");
          this.imports=this.imports.filter(item=>item.path!==path);this.imports.push(imported);
          this.selectionFields = []; this.reviewFields = []; this.preparedSelection = ""; this.scenes = [];
          this.selection=planSelection(this.map,this.imports,this.files,this.warnings,path);this.render(false);
        })().catch(error=>ui.notifications?.error(error instanceof Error?error.message:String(error)));
      }}).render(true));
      return;
    }
    const selectScene = (index: number) => {
      this.selectedScene = index;
      for (const panel of root.querySelectorAll<HTMLElement>("[data-scene]")) panel.hidden = Number(panel.dataset.scene) !== index;
      for (const button of root.querySelectorAll<HTMLElement>("[data-select-scene]")) button.setAttribute("aria-pressed", String(Number(button.dataset.selectScene) === index));
    };
    for (const button of root.querySelectorAll<HTMLElement>("[data-select-scene]")) button.addEventListener("click", () => selectScene(Number(button.dataset.selectScene)));
    root.addEventListener("invalid", event => {
      const panel = (event.target as HTMLElement).closest<HTMLElement>("[data-scene]");
      if (panel) selectScene(Number(panel.dataset.scene));
    }, true);
    const shared = root.querySelector<HTMLInputElement>('[name="applyShared"]')!;
    const updateSharedFields = () => {
      for (const fields of root.querySelectorAll<HTMLFieldSetElement>("[data-scene-lighting], [data-scene-appearance]")) fields.disabled = shared.checked;
    };
    shared.addEventListener("change", updateSharedFields);
    updateSharedFields();
    for (const section of root.querySelectorAll<HTMLElement>("[data-scene]")) {
      const index = Number(section.dataset.scene), scene = this.scenes[index]!;
      if (!scene.created) setupPreview(section, scene);
    }
  }
  protected override async _updateObject(_event: Event, _submitted: Record<string, unknown>) {
    if (this.busy || this.folderLoading) return;
    this.busy = true;
    try {
      if (!game.user?.isGM) throw new Error("Only the GM can create scenes.");
      if (!this.form) throw new Error("The Quick Scene Importer form is unavailable.");
      if (this.folderStep) {
        const selectedMap = this.folderPicker.selectedFile;
        if (!isMedia(selectedMap) || isOverlay(selectedMap)) throw new Error("Select a map image or video before continuing.");
        const path = this.folderPicker.target;
        const source = this.folderPicker.activeSource;
        const bucket = this.folderPicker.sources.s3?.bucket;
        const key = JSON.stringify([source,bucket,path,selectedMap]);
        if (key === this.scannedFolder) {this.folderStep = false; this.failure = ""; this.render(false); return;}
        const cancellation = this.preparation = new AbortController();
        const root = this.element[0]!;
        const controls = root.querySelector<HTMLElement>('[data-native-folder]')!;
        controls.inert = true;
        const cancel = root.querySelector<HTMLButtonElement>('[data-cancel-scan]')!; cancel.hidden = false;
        const status = root.querySelector<HTMLElement>('[data-folder-status]')!;
        try {
          const scan = await scanFolders(path,target=>FilePicker.browse(source,target,{bucket:source === "s3" ? bucket : undefined}),count=>{status.textContent = `Searching folders: ${count}`;},cancellation.signal);
          if (!scan.files.includes(selectedMap)) throw new Error("The selected map was not found in this folder. Select an available map file.");
          status.textContent = "Reading Scene files…";
          const found = await readImports(scan.files,undefined,cancellation.signal);
          cancellation.signal.throwIfAborted();
          this.map = selectedMap; this.files = scan.files; this.imports = found.imports; this.warnings = [...scan.warnings,...found.warnings];
          this.selection = planSelection(this.map,this.imports,this.files,this.warnings);
          this.scenes = []; this.selectionFields = []; this.reviewFields = []; this.preparedSelection = "";
          this.folderPath = path; this.scannedFolder = key;
          this.folderStep = false; this.failure = ""; this.render(false);
        } finally {controls.inert = false; cancel.hidden = true; status.textContent = cancellation.signal.aborted ? "Search cancelled. Choose a folder or retry." : "";}
        return;
      }
      if (!this.reviewing) {
        this.selectionFields = captureFields(this.form as HTMLFormElement);
        const signature = JSON.stringify(this.selectionFields);
        if (signature === this.preparedSelection && this.scenes.length) {
          this.reviewing = true; this.failure = ""; this.render(false); return;
        }
        const plans = readSelection(this.form as HTMLFormElement,this.selection);
        if (!plans.length) throw new Error("Select at least one scene.");
        const prepared: PreparedScene[] = [];
        const preparation = this.preparation = new AbortController();
        for (const plan of plans) for (const map of plan.maps) prepared.push(await prepareScene(map, plan.selected, this.files, plan.maps.length > 1, "edit", preparation.signal));
        preparation.signal.throwIfAborted();
        this.scenes = prepared; this.reviewFields = []; this.selectedScene = 0; this.preparedSelection = signature;
        this.reviewing = true; this.failure = ""; this.render(false); return;
      }
      if (!this.form) throw new Error("The Quick Scene Importer form is unavailable.");
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
        section.querySelector("[data-scene-title]")!.textContent = `${basename(this.scenes[i]!.map)} - saved`;
        const choice = this.form!.querySelector(`[data-select-scene="${i}"]`);
        if (choice) choice.textContent = `${basename(draft.map)} - saved`;
        try { await refreshSceneThumbnail(scene); }
        catch (error) {
          console.warn(`${MODULE_ID} | Thumbnail generation for ${scene.name}`,error);
          ui.notifications?.warn(`Scene "${scene.name}" was saved, but its thumbnail could not be generated. Use Generate Thumbnail in the Scenes sidebar to retry.`);
        }
      }
      ui.notifications?.info(`Created ${this.scenes.length} scenes in SceneTools/Imported Scenes.`);
      this.busy = false; await this.close();
    } catch (error) {
      if (this.preparation?.signal.aborted) return;
      try { await this.cleanupIncomplete(); }
      catch (cleanupError) { error = new Error(`${error instanceof Error ? error.message : error} Cleanup failed: ${String(cleanupError)}. Keep this window open and retry.`); }
      this.failure = `${error instanceof Error ? error.message : String(error)} (${this.scenes.filter(scene=>scene.created).length} scenes saved.)`;
      console.error(`${MODULE_ID} | Import`,error); ui.notifications?.error(this.failure);
      const message = this.form?.querySelector<HTMLElement>("[data-error]"); if (message) message.textContent = this.failure;
    } finally {
      this.busy = false; this.preparation = undefined;
      const back = this.form?.querySelector<HTMLButtonElement>("[data-back]");
      if (back) back.disabled = !this.canGoBack;
    }
  }
  private async cleanupIncomplete() {
    for (const draft of this.scenes) {
      if (!draft.pending || draft.created) continue;
      const scene = game.scenes?.get(draft.pending);
      if (scene) { await scene.delete(); if (game.scenes?.has(draft.pending)) throw new Error("Incomplete Scene could not be deleted"); }
      draft.pending = undefined;
    }
  }
  override async close(options?: Application.CloseOptions) {
    if (this.busy) {
      if (!this.preparation) return;
      this.preparation.abort();
    }
    this.folderPicker.detach();
    await this.folderPicker.close();
    try { await this.cleanupIncomplete(); } catch (error) { ui.notifications?.error(String(error)); return; }
    creator = undefined; return super.close(options);
  }
}

export function openSceneCreator() {
  if (!game.user?.isGM) return;
  if (creator) { creator.render(true); return; }
  creator = new SceneCreator();
  creator.render(true);
}
export async function scanFolders(start: string, browse: (path: string) => Promise<{files: string[]; dirs: string[]}>, progress?: (count: number) => void, signal = new AbortController().signal) {
  const queue = [start], visited = new Set<string>(), files = new Set<string>(), warnings: string[] = [];
  while (queue.length) {
    signal.throwIfAborted();
    const folder = queue.shift()!;
    if (visited.has(folder)) continue;
    if (visited.size >= 500) { warnings.push("Folder scan stopped at 500 folders. Narrow the selected folder to scan remaining files."); break; }
    visited.add(folder); progress?.(visited.size);
    try {
      const result = await bounded(browse(folder),signal);
      for (const file of result.files) files.add(file);
      queue.push(...result.dirs.sort((a, b) => Number(isFoundryFolder(b)) - Number(isFoundryFolder(a)) || a.localeCompare(b)));
    } catch { signal.throwIfAborted(); warnings.push(`Could not browse ${folder}`); }
  }
  return {files: [...files], warnings};
}

async function readImports(files: string[], map: string | undefined, signal: AbortSignal) {
  const imports: ImportFile[] = [], warnings: string[] = [];
  const jsonFiles = files.filter(path => /\.(json|dd2vtt|uvtt|df2vtt)(?:[?#].*)?$/i.test(path));
  const named = map ? jsonFiles.filter(path => nameScore(path, map, true) >= 50) : jsonFiles;
  const conventional = jsonFiles.filter(path => isFoundryFolder(parentPath(path)));
  const candidates = [...new Set([...named,...conventional])];
  let next = 0;
  await Promise.all(Array.from({length:Math.min(4,candidates.length)},async()=>{
  while (next < candidates.length) {
    signal.throwIfAborted();
    const path = candidates[next++]!;
    try {
      const response = await fetch(path, {signal: AbortSignal.any([signal,AbortSignal.timeout(15000)])});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const item = identifyImport(await response.json(), path);
      if (item) imports.push(item);
    } catch { signal.throwIfAborted(); warnings.push(`Could not read ${basename(path)}`); }
  }
  }));
  imports.sort((a,b)=>a.path.localeCompare(b.path));
  return {imports, warnings};
}

function setupPreview(root: HTMLElement, scene: PreparedScene) {
  const form = root, canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const walls = list(scene.data.walls), lights = list(scene.data.lights);
  const geometry = walls.length || lights.length ? new Scene(scene.data as Scene.CreateData).getDimensions() : {sceneX:0,sceneY:0};
  const image = isVideo(scene.map) ? document.createElement("video") : new Image();
  if (image instanceof HTMLVideoElement) { image.preload = "auto"; image.muted = true; }
  let foreground: HTMLImageElement | HTMLVideoElement | undefined;
  let foregroundPath = "", foregroundFailed = false;
  const update = () => {
    const originalForeground = typeof scene.data.foreground === "string" ? scene.data.foreground : "";
    let path = form.querySelector<HTMLSelectElement>('[data-foreground-choice]')?.value ?? originalForeground;
    for (const overlay of scene.overlays) {
      if (form.querySelector<HTMLInputElement>(`[name$="-overlay-${overlay.index}"]`)?.checked
        && form.querySelector<HTMLSelectElement>(`[name$="-layer-${overlay.index}"]`)?.value === "foreground") path = overlay.path;
    }
    for (const warning of root.querySelectorAll<HTMLElement>('[data-unresolved-path]')) {
      const original = warning.dataset.unresolvedPath;
      const fields = Array.from(form.querySelectorAll<HTMLSelectElement>('[data-image-asset]')).filter(field=>field.dataset.originalPath === original);
      const usedBySound = list(scene.data.sounds).some(item=>record(item).path === original);
      warning.hidden = !usedBySound && !(original === originalForeground && path === originalForeground)
        && fields.every(field=>field.value !== original) && (fields.length > 0 || original === originalForeground);
    }
    const warnings = root.querySelector<HTMLElement>('[data-unresolved-assets]');
    if (warnings) warnings.hidden = !Array.from(warnings.querySelectorAll<HTMLElement>('li')).some(item=>!item.hidden);
    if (path !== foregroundPath) {
      if (foreground) {foreground.onload = null; foreground.onloadeddata = null; foreground.onerror = null; foreground.removeAttribute("src");}
      foregroundPath = path; foregroundFailed = false;
      foreground = path ? isVideo(path) ? document.createElement("video") : new Image() : undefined;
      if (foreground) {
        if (foreground instanceof HTMLVideoElement) {foreground.preload = "auto"; foreground.muted = true; foreground.onloadeddata = update;}
        else foreground.onload = update;
        foreground.onerror = () => {foregroundFailed = true; update();};
        foreground.src = path;
      }
    }
    const foregroundStatus = root.querySelector<HTMLElement>("[data-foreground-status]")!;
    foregroundStatus.hidden = !path;
    foregroundStatus.textContent = path ? `${foregroundFailed ? "Could not preview foreground" : "Foreground"}: ${path}` : "";
    const values = {get: (name: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`)!.value}, choice = String(values.get("gridChoice"));
    const custom = form.querySelector<HTMLInputElement>('[data-field="customGrid"]')!;
    custom.disabled = choice !== "custom";
    custom.closest<HTMLElement>(".form-group")!.hidden = choice !== "custom";
    const width = Number(values.get("width")), height = Number(values.get("height"));
    const size = choice === "custom" ? Number(custom.value) : Number(choice);
    const ctx = canvas.getContext("2d"); if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / width, canvas.height / height), w = width * scale, h = height * scale;
    if (image instanceof HTMLVideoElement ? image.readyState >= 2 : image.complete && image.naturalWidth) ctx.drawImage(image, 0, 0, w, h);
    if (foreground && (foreground instanceof HTMLVideoElement ? foreground.readyState >= 2 : foreground.complete && foreground.naturalWidth)) ctx.drawImage(foreground, 0, 0, w, h);
    const square = values.get("gridType") === "1";
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
    root.querySelector(".pneuma-grid-count")!.textContent = values.get("gridType") === "0" ? "Gridless" : `${(width / size).toFixed(2)} × ${(height / size).toFixed(2)} grid units`;
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
    const container=sceneToolsRow(root);if(!container)return;
    const button = document.createElement("button");
    button.type = "button"; button.className = "pneuma-scene-create";
    button.innerHTML = '<i class="fas fa-file-import" aria-hidden="true"></i> Import';
    button.title="Scene Tools - Quick Scene Importer";button.setAttribute("aria-label",button.title);
    button.addEventListener("click", openSceneCreator); container.prepend(button);
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



import {sceneToolsRow} from "./scene-directory-tools.js";
