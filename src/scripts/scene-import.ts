import {MODULE_ID} from "./settings.js";
import {basename, gridSuggestions, list, positive, record, resolveAsset, universalScene, type Data, type ImportFile} from "./scene-data.js";
import {isVideo, matchingOverlays} from "./matching.js";

export interface PreparedScene {
  map: string;
  data: Data;
  source?: Data;
  created?: string;
  pending?: string;
  imported: boolean;
  sourcePath?: string;
  useJson: boolean;
  defaults: {
    name: string; width: number; height: number; gridSize: number; distance: number; units: string;
    darkness: number; globalLight: boolean; tokenVision: boolean; fogExploration: boolean;
  };
  gridless: boolean;
  gridOptions: {size: number; label: string; selected: boolean}[];
  gridTypes: {value: number; label: string; selected: boolean}[];
  overlays: {index: number; path: string; label: string; animated: boolean}[];
  unresolved: string[];
}

/** Resolve exported asset paths when editing; leave native JSON imports intact. */
function rematchAssets(data: Data, files: string[], edit: boolean): string[] {
  const unresolved: string[] = [];
  const fix = (path: unknown): unknown => {
    if (typeof path !== "string" || !path) return path;
    const nearby = resolveAsset(path, files);
    if (nearby) return edit ? nearby : path;
    unresolved.push(path); return path;
  };
  if (data.foreground) data.foreground = fix(data.foreground);
  for (const collection of ["tiles", "tokens"]) for (const item of list(data[collection])) {
    const texture = record(record(item).texture);
    if (texture.src) texture.src = fix(texture.src);
  }
  for (const item of list(data.sounds)) { const sound = record(item); sound.path = fix(sound.path); }
  return [...new Set(unresolved)];
}

export function enableSceneOverrides(scene: PreparedScene, files: string[]): void {
  if (scene.created) return;
  scene.useJson = false;
  scene.unresolved = rematchAssets(scene.data, files, true);
}

export async function prepareScene(map: string, selected: ImportFile | undefined, files: string[], paired: boolean, mode: "json" | "edit", signal = new AbortController().signal): Promise<PreparedScene> {
  const dimensions = await imageDimensions(map,signal);
  if (selected?.kind === "Foundry Scene" && Number(String(record(selected.data._stats).coreVersion ?? "12").split(".")[0]) > 12) {
    throw new Error("This Scene export targets a newer Foundry version. Choose a Foundry v12 export or image-only creation.");
  }
  const systemGrid = record(game.system?.grid);
  let data: Data = {};
  if (selected?.kind === "Foundry Scene") data = (await Scene.fromImport(structuredClone(selected.data) as Scene.Source)).toObject() as unknown as Data;
  if (selected?.kind === "Universal VTT") data = universalScene(selected.data, dimensions.width, dimensions.height, positive(systemGrid.distance, 2));
  const width = positive(data.width, dimensions.width), height = positive(data.height, dimensions.height);
  data = {...data, width, height};
  const grid = record(data.grid), environment = record(data.environment);
  const suggestions = gridSuggestions(width, height, map, game.settings!.get(MODULE_ID, "defaultGrid"));
  const size = positive(grid.size, suggestions[0]?.size ?? 100), type = typeof grid.type === "number" ? grid.type : 1;
  const unresolved = rematchAssets(data, files, mode === "edit");
  const types: [number,string][] = [[1,"Square"],[2,"Hex odd rows"],[3,"Hex even rows"],[4,"Hex odd columns"],[5,"Hex even columns"]];
  return {map, data, source: selected?.kind === "Foundry Scene" ? structuredClone(selected.data) : undefined,
    imported: selected?.kind === "Foundry Scene", sourcePath: selected?.path, useJson: mode === "json" && selected?.kind === "Foundry Scene", gridless: type === 0,
    defaults: {
      name: `${data.name ?? basename(map).replace(/\.[^.]+$/, "")}${paired && mode === "edit" ? isVideo(map) ? " (Animated)" : " (Static)" : ""}`,
      width, height, gridSize: size, distance: positive(grid.distance, positive(systemGrid.distance, 2)), units: String(grid.units ?? systemGrid.units ?? "m"),
      darkness: Number(environment.darknessLevel ?? game.settings!.get(MODULE_ID, "defaultDarkness")),
      globalLight: Boolean(record(environment.globalLight).enabled ?? game.settings!.get(MODULE_ID, "defaultGlobalLight")),
      tokenVision: Boolean(data.tokenVision ?? true), fogExploration: Boolean(record(data.fog).exploration ?? data.fogExploration ?? true)
    },
    gridOptions: [...new Set([size, ...suggestions.map(s=>s.size)])].map(value=>({size: value, selected: value === size && type !== 0,
      label: `${value} px - ${(width/value).toFixed(2)} x ${(height/value).toFixed(2)} squares${value === size ? selected ? " (imported)" : " (suggested)" : ""}`})),
    gridTypes: types.map(([value,label])=>({value,label,selected: value === type})),
    overlays: matchingOverlays(map, files).map((path,index)=>({index,path,label:basename(path),animated:isVideo(path)})),
    unresolved: [...new Set(unresolved)]
  };
}

/** Read one Scene's controls and validate before any documents are saved. */
export function buildScene(scene: PreparedScene, form: FormData, index: number): Data {
  const prefix = `scene${index}-`, data = structuredClone(scene.data);
  if (scene.useJson && scene.source) {
    data.background = {...record(data.background),src:scene.map};
    return data;
  }
  const number = (field: string, shared = false) => {
    const raw = form.get(shared ? field : prefix + field);
    if (raw === null || String(raw).trim() === "" || !Number.isFinite(Number(raw))) throw new Error(`Enter a valid number for ${field}.`);
    return Number(raw);
  };
  const text = (field: string) => String(form.get(prefix + field) ?? "").trim();
  const checked = (field: string) => form.has(prefix + field);
  const grid = record(data.grid), environment = record(data.environment), choice = text("gridChoice");
  data.name = text("name"); data.width = number("width"); data.height = number("height");
  if (!data.name) throw new Error("Enter a Scene name.");
  if (!(Number(data.width) > 0) || !(Number(data.height) > 0)) throw new Error("Scene width and height must be positive.");
  const size = choice === "custom" ? number("customGrid") : choice === "gridless" ? scene.defaults.gridSize : Number(choice);
  if (!Number.isInteger(size) || size < 50) throw new Error("Grid size must be a whole number of at least 50 pixels.");
  const distance = number("distance"), units = text("units");
  if (distance <= 0 || !units) throw new Error("Enter a positive grid distance and distance units.");
  data.grid = {...grid, type: choice === "gridless" ? 0 : number("gridType"), size, distance, units};
  const shared = form.has("applyShared") && !checked("override");
  const darkness = shared ? number("sharedDarkness", true) : number("darkness");
  if (!Number.isFinite(darkness) || darkness < 0 || darkness > 1) throw new Error("Darkness must be between 0 and 1.");
  data.environment = {...environment, darknessLevel: darkness, globalLight: {...record(environment.globalLight), enabled: shared ? form.has("sharedGlobal") : checked("globalLight")}};
  data.tokenVision = shared ? form.has("sharedVision") : checked("tokenVision");
  data.fog = {...record(data.fog), exploration: shared ? form.has("sharedFog") : checked("fogExploration")};
  delete data.fogExploration;
  data.active = false; data.navigation = false;
  data.background = {...record(data.background), src: scene.map}; delete data.img;
  const tiles = list(data.tiles);
  let foregroundCount = 0;
  for (const overlay of scene.overlays) {
    const i = overlay.index;
    if (!checked(`overlay-${i}`)) continue;
    const x = number(`x-${i}`), y = number(`y-${i}`), width = number(`width-${i}`), height = number(`height-${i}`);
    if (width <= 0 || height <= 0) throw new Error("Overlay dimensions must be positive.");
    if (text(`layer-${i}`) === "foreground") {
      if (++foregroundCount > 1) throw new Error("Select only one Scene foreground image.");
      if (x !== 0 || y !== 0 || width !== data.width || height !== data.height) throw new Error("Scene foreground covers the whole map. Use a tile for custom placement.");
      data.foreground = overlay.path;
    } else {
      const geometry = new Scene(data as Scene.CreateData).getDimensions();
      tiles.push({texture: {src: overlay.path}, x: geometry.sceneX + x, y: geometry.sceneY + y, width, height});
    }
  }
  data.tiles = tiles;
  return data;
}

/** Apply only supported overrides after the complete native JSON import has finished. */
export async function applySceneOverrides(scene: Scene, draft: PreparedScene, desired: Data) {
  const imported = scene.toObject() as unknown as Data, changes: Data = {};
  const fields = draft.useJson ? ["background.src"] : ["name","width","height","background.src","grid.type","grid.size","grid.distance","grid.units",
    "environment.darknessLevel","environment.globalLight.enabled","tokenVision","fog.exploration","foreground"];
  for (const path of fields) {
    const value = foundry.utils.getProperty(desired,path);
    if (value !== undefined && value !== foundry.utils.getProperty(imported,path)) changes[path] = value;
  }
  if (Object.keys(changes).length) await scene.update(changes);
  if (draft.useJson) return;
  // Asset rematches update their own embedded documents; imported geometry stays intact.
  for (const [collection, type, path] of [["tiles","Tile","texture.src"],["tokens","Token","texture.src"],["sounds","AmbientSound","path"]] as const) {
    const updates: Data[] = [];
    for (const item of list(desired[collection])) {
      const data = record(item);
      if (!data._id) continue;
      const current = list(imported[collection]).find(item=>record(item)._id === data._id);
      const value = foundry.utils.getProperty(data,path);
      if (current && value !== undefined && value !== foundry.utils.getProperty(current,path)) updates.push({_id:data._id,[path]:value});
    }
    if (updates.length) await scene.updateEmbeddedDocuments(type,updates);
  }
  const addedTiles = list(desired.tiles).slice(list(draft.data.tiles).length);
  if (addedTiles.length) await scene.createEmbeddedDocuments("Tile",addedTiles as TileDocument.CreateData[]);
}

export function imageDimensions(path: string, signal = new AbortController().signal): Promise<{width: number; height: number}> {
  return new Promise((resolve,reject)=>{
    const media = isVideo(path) ? document.createElement("video") : new Image();
    const cleanup = () => {
      clearTimeout(timer); signal.removeEventListener("abort",abort); media.onload=null; media.onerror=null;
      if (media instanceof HTMLVideoElement) { media.onloadedmetadata=null; media.removeAttribute("src"); media.load(); }
      else media.removeAttribute("src");
    };
    const abort = () => { cleanup(); reject(signal.reason ?? new Error("Cancelled")); };
    const fail = () => { cleanup(); reject(new Error(`Cannot load media: ${basename(path)}. Retry or choose another file.`)); };
    const timer = setTimeout(fail,15000);
    const done = () => {
      const dimensions = media instanceof HTMLVideoElement ? {width:media.videoWidth,height:media.videoHeight} : {width:media.naturalWidth,height:media.naturalHeight};
      if (!dimensions.width || !dimensions.height) return fail();
      cleanup(); resolve(dimensions);
    };
    media.onerror=fail;
    if (media instanceof HTMLVideoElement) { media.preload="metadata";media.muted=true;media.onloadedmetadata=done; }
    else media.onload=done;
    signal.addEventListener("abort",abort,{once:true});
    if (signal.aborted) { abort(); return; }
    media.src=path;
  });
}
