import {MODULE_ID} from "./settings.js";
import {basename, gridSuggestions, identifyImport, list, nativeScene, positive, record, resolveAsset, universalScene, type Data, type ImportFile} from "./scene-data.js";
import {isFoundryFolder, isVideo, matchingOverlays, scanRoot, nameScore, parentPath} from "./matching.js";
import {planSelection} from "./planning.js";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "./world-folders.js";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]!));
const rootElement = (html: JQuery | HTMLElement) => html instanceof HTMLElement ? html : html[0]!;
let creator: SceneCreator | undefined;
let scanning = false;

export class SceneCreator extends FormApplication {
  private selection: ReturnType<typeof planSelection>;
  private scenes: PreparedScene[] = [];
  private busy = false;
  private failure = "";
  constructor(private map: string, private imports: ImportFile[], private files: string[], private warnings: string[]) {
    super({}); this.selection = planSelection(map, imports, files, warnings);
  }
  static override get defaultOptions(): FormApplicationOptions {
    return {...super.defaultOptions, title: "Quick Scene Creator", template: `modules/${MODULE_ID}/templates/scene-creator.hbs`, width: 720, height: "auto", resizable: true, closeOnSubmit: false, submitOnClose: false, submitOnChange: false};
  }
  override getData() {
    const shared = `<fieldset><legend>Shared lighting and vision</legend><label><input name="applyShared" type="checkbox"> Apply these settings to all scenes</label>
      ${field("Darkness", "sharedDarkness", game.settings!.get(MODULE_ID,"defaultDarkness"),"number",'min="0" max="1" step="any" required')}
      <label><input name="sharedGlobal" type="checkbox" ${game.settings!.get(MODULE_ID,"defaultGlobalLight") ? "checked" : ""}> Global illumination</label>
      <label><input name="sharedVision" type="checkbox" checked> Token vision</label><label><input name="sharedFog" type="checkbox" checked> Fog exploration</label></fieldset>`;
    return {failure: this.failure, content: this.scenes.length ? shared + this.scenes.map((scene,i)=>`<details data-scene="${i}" ${this.scenes.length === 1 ? "open" : ""}><summary>${escape(basename(scene.map))}${scene.created ? " - saved" : ""}</summary><label><input type="checkbox" name="scene${i}-override">Use this scene's lighting and vision</label>${scene.content.replace(/name="([^"]+)"/g, (_match, name: string) => `name="scene${i}-${name}" data-field="${name}"`)}</details>`).join("") : this.selection.content,
      label: this.scenes.length ? "Create selected scenes" : "Review selected scenes"};
  }
  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    const root = html[0]!;
    if (!this.scenes.length) {
      this.selection.setup(root);
      root.querySelector("[data-browse-json]")!.addEventListener("click",()=>new FilePicker({type:"any",callback:path=>{
        void (async()=>{
          const response=await fetch(path,{signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw new Error(`Could not read Scene file: HTTP ${response.status}`);
          const imported=identifyImport(await response.json(),path);
          if (!imported) throw new Error("Choose a Foundry Scene JSON or Universal VTT file.");
          this.imports=this.imports.filter(item=>item.path!==path);this.imports.push(imported);
          this.selection=planSelection(this.map,this.imports,this.files,this.warnings,path);this.render(false);
        })().catch(error=>ui.notifications?.error(error instanceof Error?error.message:String(error)));
      }}).render(true));
      return;
    }
    for (const section of root.querySelectorAll<HTMLElement>("[data-scene]")) {
      const index = Number(section.dataset.scene), scene = this.scenes[index]!;
      for (const input of section.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[name]")) {
        if (scene.created) input.disabled = true;
      }
      if (!scene.created) setupPreview(section, scene.map);
    }
  }
  protected override async _updateObject(_event: Event, _submitted: Record<string, unknown>) {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!game.user?.isGM) throw new Error("Only the GM can create scenes.");
      if (!this.scenes.length) {
        const plans = this.selection.read(this.form as HTMLFormElement);
        if (!plans.length) throw new Error("Select at least one scene.");
        const prepared: PreparedScene[] = [];
        for (const plan of plans) for (const map of plan.maps) prepared.push(await prepareVariant(map, plan.selected, this.files, plan.maps.length > 1));
        this.scenes = prepared; this.failure = ""; this.render(false); return;
      }
      if (!this.form) throw new Error("The Scene Creator form is unavailable.");
      const values = new FormData(this.form as HTMLFormElement);
      const data = this.scenes.map((scene,i) => {
        if (scene.created) return undefined;
        const result = scene.build(values, `scene${i}-`);
        if (!String(result.name).trim()) throw new Error("Enter a Scene name.");
        if (values.has("applyShared") && !values.has(`scene${i}-override`)) {
          result.environment = {...record(result.environment), darknessLevel: Number(values.get("sharedDarkness")), globalLight: {...record(record(result.environment).globalLight), enabled: values.has("sharedGlobal")}};
          result.tokenVision = values.has("sharedVision"); result.fogExploration = values.has("sharedFog");
        }
        return result;
      });
      const folder = await ensureSceneToolsFolder("Scene", WORLD_FOLDERS.scenes);
      for (let i = 0; i < data.length; i++) {
        if (!data[i]) continue;
        const scene = await Scene.create({...data[i],folder: folder.id} as Scene.CreateData);
        if (!scene?.id || !game.scenes?.has(scene.id)) throw new Error("Foundry did not confirm the Scene was saved.");
        this.scenes[i]!.created = scene.id;
        try { const thumb = await scene.createThumbnail(); await scene.update({thumb: thumb.thumb}); }
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
function imageDimensions(path: string): Promise<{width: number; height: number}> {
  return new Promise((resolve, reject) => {
    if (isVideo(path)) {
      const video = document.createElement("video");
      video.preload = "metadata"; video.muted = true;
      const cleanup = () => { video.onloadedmetadata = null; video.onerror = null; video.removeAttribute("src"); video.load(); };
      video.onloadedmetadata = () => { const dimensions = {width: video.videoWidth, height: video.videoHeight}; cleanup(); resolve(dimensions); };
      video.onerror = () => { cleanup(); reject(new Error(`Cannot load video: ${basename(path)}`)); };
      video.src = path; return;
    }
    const image = new Image();
    image.onload = () => resolve({width: image.naturalWidth, height: image.naturalHeight});
    image.onerror = () => reject(new Error(`Cannot load image: ${basename(path)}`));
    image.src = path;
  });
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
  const candidates = named.length ? named : conventional.length === 1 ? conventional : [];
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

function field(label: string, name: string, value: unknown, type = "number", attributes = "") {
  return `<div class="form-group"><label>${label}</label><input type="${type}" name="${name}" value="${escape(value)}" ${attributes}></div>`;
}

interface PreparedScene {map: string; content: string; created?: string; build(values: FormData, prefix: string): Data;}
async function prepareVariant(map: string, selected: ImportFile | undefined, files: string[], paired: boolean): Promise<PreparedScene> {
  const dimensions = await imageDimensions(map);
  if (selected?.kind === "Foundry Scene" && Number(String(record(selected.data._stats).coreVersion ?? "12").split(".")[0]) > 12) {
    throw new Error("This Scene export targets a newer Foundry version. Choose a Foundry v12 export or image-only creation.");
  }
  let data: Data = selected?.kind === "Foundry Scene" ? nativeScene(selected.data) : {};
  const systemGrid = record(game.system?.grid);
  const distance = positive(record(data.grid).distance, positive(systemGrid.distance, 2));
  if (selected?.kind === "Universal VTT") data = universalScene(selected.data, dimensions.width, dimensions.height, distance);
  if (selected?.kind === "Foundry Scene") {
    // Migrate legacy exports through Foundry itself before presenting their settings.
    data = nativeScene(Scene.fromJSON(JSON.stringify(data)).toObject() as unknown as Data);
  }
  const width = positive(data.width, dimensions.width), height = positive(data.height, dimensions.height);
  const grid = record(data.grid), environment = record(data.environment);
  const suggestions = gridSuggestions(width, height, map, game.settings!.get(MODULE_ID, "defaultGrid"));
  const initial = positive(grid.size, suggestions[0]?.size ?? 100);
  const initialType = typeof grid.type === "number" ? grid.type : 1;
  const units = String(grid.units ?? systemGrid.units ?? "m");
  data = {...data, width, height};
  const content = `
    ${field("Scene name", "name", `${data.name ?? basename(map).replace(/\.[^.]+$/, "")}${paired ? isVideo(map) ? " (Animated)" : " (Static)" : ""}`, "text", "required")}
    ${field("Scene width (px)", "width", width, "number", 'min="1" step="1" required')}
    ${field("Scene height (px)", "height", height, "number", 'min="1" step="1" required')}
    <div class="form-group"><label>Grid</label><select name="gridChoice">${[...new Set([initial, ...suggestions.map(s => s.size)])].map(size => `<option value="${size}" ${size === initial && initialType !== 0 ? "selected" : ""}>${size} px — ${(width / size).toFixed(2)} × ${(height / size).toFixed(2)} squares${size === initial ? selected ? " (imported)" : " (suggested)" : ""}</option>`).join("")}<option value="custom">Custom</option><option value="gridless" ${initialType === 0 ? "selected" : ""}>Gridless</option></select></div>
    ${field("Custom grid size (px)", "customGrid", initial, "number", 'min="50" step="1" required')}
    <div class="form-group"><label>Grid type</label><select name="gridType">${[[1, "Square"], [2, "Hex odd rows"], [3, "Hex even rows"], [4, "Hex odd columns"], [5, "Hex even columns"]].map(([n, label]) => `<option value="${n}" ${n === initialType ? "selected" : ""}>${label}</option>`).join("")}</select></div>
    <p>Suggestions use filename hints and whole-square fit. Check alignment in the preview. Hex grids require Foundry's native grid configuration.</p>
    <canvas class="pneuma-grid-preview" width="540" height="300"></canvas><p class="pneuma-grid-count"></p>
    ${field("Distance per square", "distance", distance, "number", 'min="0.01" step="any" required')}
    ${field("Distance units", "units", units, "text", "required")}
    ${field("Darkness (0-1)", "darkness", environment.darknessLevel ?? game.settings!.get(MODULE_ID, "defaultDarkness"), "number", 'min="0" max="1" step="any" required')}
    <div class="form-group"><label>Global illumination</label><input type="checkbox" name="globalLight" ${record(environment.globalLight).enabled ?? game.settings!.get(MODULE_ID, "defaultGlobalLight") ? "checked" : ""}></div>
    <div class="form-group"><label>Token vision</label><input type="checkbox" name="tokenVision" ${data.tokenVision ?? true ? "checked" : ""}></div>
    <div class="form-group"><label>Fog exploration</label><input type="checkbox" name="fogExploration" ${data.fogExploration ?? true ? "checked" : ""}></div>
    <p>${list(data.walls).length} walls · ${list(data.lights).length} lights · ${list(data.tiles).length} imported tiles. Scene dimensions resize the background; imported coordinates stay fixed.</p>`;

  const unresolved: string[] = [];
  const fix = (path: unknown): unknown => {
    if (typeof path !== "string" || !path) return path;
    const nearby = resolveAsset(path, files);
    if (nearby) return nearby;
    unresolved.push(path); return path;
  };
  data.foreground = fix(data.foreground);
  for (const collection of ["tiles", "tokens"]) for (const item of list(data[collection])) {
    const texture = record(record(item).texture);
    if (texture.src) texture.src = fix(texture.src);
  }
  for (const item of list(data.sounds)) {
    const sound = record(item); sound.path = fix(sound.path);
  }
  const overlayFiles = matchingOverlays(map, files);

  const overlayContent = `<p>Matching OVERLAY/Foreground files for <strong>${escape(basename(map))}</strong>. Placement is relative to the top-left of the map. Select the static or animated overlay you want; nothing is added automatically.</p>
    ${overlayFiles.map((path, i) => `<fieldset data-overlay="${i}"><legend><label><input type="checkbox" name="overlay-${i}"> ${escape(basename(path))}</label></legend>${isVideo(path) ? `<video class="pneuma-overlay-preview" src="${escape(path)}" preload="metadata" muted controls></video>` : `<img class="pneuma-overlay-preview" src="${escape(path)}" loading="lazy">`}<div class="form-group"><label>Layer</label><select name="layer-${i}"><option value="tile">Tile</option><option value="foreground">Scene foreground (one image)</option></select></div>${field("X", `x-${i}`, 0)}${field("Y", `y-${i}`, 0)}${field("Width", `width-${i}`, data.width, "number", 'min="1" required')}${field("Height", `height-${i}`, data.height, "number", 'min="1" required')}</fieldset>`).join("") || "<p>No matching overlay or foreground files found.</p>"}
    ${unresolved.length ? `<p>These imported asset paths could not be matched nearby. They will be retained; confirm they exist on your server:</p><ul>${[...new Set(unresolved)].map(p => `<li>${escape(p)}</li>`).join("")}</ul>` : ""}
    ${selected?.kind === "Foundry Scene" ? "<p>Imported tokens and notes may refer to actors or journals from another world. Review them in the new Scene. Scene-level journal and playlist links are cleared.</p>" : ""}`;
  const original = structuredClone(data);
  return {map, content: content + (overlayFiles.length || unresolved.length ? '<details><summary>Optional overlays and asset paths</summary>' + overlayContent + '</details>' : ''), build(valuesAll, prefix) {
    data = structuredClone(original);
  const values = {get: (name: string) => valuesAll.get(prefix + name), has: (name: string) => valuesAll.has(prefix + name)};
  const getNumber = (name: string) => {
    const raw = values.get(name);
    if (raw === null || String(raw).trim() === "" || !Number.isFinite(Number(raw))) throw new Error(`Enter a valid number for ${name}.`);
    return Number(raw);
  };
  const choice = String(values.get("gridChoice"));
  data = {...data, name: String(values.get("name")).trim(), width: getNumber("width"), height: getNumber("height"), active: false, navigation: false,
    background: {...record(data.background), src: map}, grid: {...grid, type: choice === "gridless" ? 0 : getNumber("gridType"), size: choice === "custom" ? getNumber("customGrid") : choice === "gridless" ? initial : Number(choice), distance: getNumber("distance"), units: String(values.get("units"))},
    environment: {...environment, darknessLevel: getNumber("darkness"), globalLight: {...record(environment.globalLight), enabled: values.has("globalLight")}},
    tokenVision: values.has("tokenVision"), fogExploration: values.has("fogExploration")};
  delete data.img;
  if (!(Number(data.width) > 0) || !(Number(data.height) > 0)) throw new Error("Scene width and height must be positive.");
  if (!Number.isInteger(record(data.grid).size) || Number(record(data.grid).size) < 50) throw new Error("Grid size must be a whole number of at least 50 pixels.");
  if (!(Number(record(data.grid).distance) > 0)) throw new Error("Grid distance must be positive.");
  const overlayValues = values, tiles = list(data.tiles);

  let foregroundCount = 0;
  for (let i = 0; i < overlayFiles.length; i++) {
    if (!overlayValues.has(`overlay-${i}`)) continue;
    const x = Number(overlayValues.get(`x-${i}`)), y = Number(overlayValues.get(`y-${i}`));
    const w = Number(overlayValues.get(`width-${i}`)), h = Number(overlayValues.get(`height-${i}`));
    if (overlayValues.get(`layer-${i}`) === "foreground") {
      if (++foregroundCount > 1) throw new Error("Select only one Scene foreground image.");
      if (x !== 0 || y !== 0 || w !== data.width || h !== data.height) throw new Error("Scene foreground covers the whole map. Use a tile for custom placement.");
      data.foreground = overlayFiles[i];
    } else {
      const geometry = new Scene(data as Scene.CreateData).getDimensions();
      tiles.push({texture: {src: overlayFiles[i]}, x: geometry.sceneX + x, y: geometry.sceneY + y, width: w, height: h});
    }
  }
  data.tiles = tiles;

    return data;
  }};
}
function setupPreview(root: HTMLElement, map: string) {
  const form = root, canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const image = isVideo(map) ? document.createElement("video") : new Image();
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
    root.querySelector(".pneuma-grid-count")!.textContent = choice === "gridless" ? "Gridless" : `${(width / size).toFixed(2)} × ${(height / size).toFixed(2)} grid units${square ? "" : " — hex preview available in Scene configuration"}`;
  };
  if (image instanceof HTMLVideoElement) image.onloadeddata = update; else image.onload = update;
  image.src = map;
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



