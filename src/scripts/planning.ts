import {basename, type ImportFile} from "./scene-data.js";
import {isMedia, isOverlay, isVideo, mapIdentity, mediaForImport, nameScore, rankImports, type ScenePlan} from "./matching.js";

export function planSelection(map: string, imports: ImportFile[], files: string[], warnings: string[], manualPath?: string) {
  const layouts = new Map([[mapIdentity(map),map]]);
  for (const path of files) {
    if (!isMedia(path) || isOverlay(path) || nameScore(map,path,true) < 50) continue;
    const key = mapIdentity(path), existing = layouts.get(key);
    if (!existing || existing !== map && isVideo(existing) && !isVideo(path)) layouts.set(key,path);
  }
  const plans = [...layouts.values()].map((anchor,index) => {
    const ranked = rankImports(imports,anchor), best = ranked[0];
    const item = anchor === map && manualPath ? imports.find(item=>item.path===manualPath)
      : best && best.score >= 70 && best.score > (ranked[1]?.score ?? 0) ? best.item : undefined;
    const staticMaps = mediaForImport(undefined, anchor, files, false), videos = mediaForImport(undefined, anchor, files, true);
    if (!(isVideo(anchor) ? videos : staticMaps).includes(anchor)) (isVideo(anchor) ? videos : staticMaps).unshift(anchor);
    const mode = (isVideo(map) && videos.length) || (!staticMaps.length && videos.length) ? "animated" : "static";
    return {index, item, label: basename(anchor), recommended: !!item, checked: index === 0,
      jsonOptions: ranked.map(({item: candidate,score})=>({path:candidate.path,label:basename(candidate.path),selected:candidate===item,recommended:score>=70})),
      staticMaps: staticMaps.map((path,i)=>({path, label: basename(path), selected: i === 0})),
      videos: videos.map((path,i)=>({path, label: basename(path), selected: i === 0})),
      staticMode: mode === "static", animatedMode: mode === "animated"};
  });
  return {plans, imports, showAllVariants: plans.length > 1, warnings};
}

export type Selection = ReturnType<typeof planSelection>;
export function setupSelection(root: HTMLElement, selection: Selection, map: string) {
  const {plans} = selection;
  const form = root instanceof HTMLFormElement ? root : root.querySelector<HTMLFormElement>("form")!;
  const validate = () => {
    const checked = plans.some(({index}) => form.querySelector<HTMLInputElement>(`[name="variant-${index}"]`)!.checked);
    form.querySelector<HTMLInputElement>('[name="variant-0"]')!.setCustomValidity(checked ? "" : "Select at least one variant.");
    plans.forEach(({index: i}) => {
      const enabled = form.querySelector<HTMLInputElement>(`[name="variant-${i}"]`)!.checked;
      const mode = form.querySelector<HTMLSelectElement>(`[name="mode-${i}"]`)!.value;
      form.querySelector<HTMLSelectElement>(`[name="static-${i}"]`)!.required = enabled && mode !== "animated";
      form.querySelector<HTMLSelectElement>(`[name="animated-${i}"]`)!.required = enabled && mode !== "static";
    });
  };
  root.querySelector<HTMLInputElement>('[name="allVariants"]')?.addEventListener("change", event => {
    const all = (event.target as HTMLInputElement).checked;
    plans.forEach(({index}) => { form.querySelector<HTMLInputElement>(`[name="variant-${index}"]`)!.checked = all; });
  });
  root.querySelector<HTMLInputElement>('[name="bothMedia"]')?.addEventListener("change", event => {
    const both = (event.target as HTMLInputElement).checked;
    plans.forEach(({index: i}) => {
      const stat = form.querySelector<HTMLSelectElement>(`[name="static-${i}"]`)!.value;
      const video = form.querySelector<HTMLSelectElement>(`[name="animated-${i}"]`)!.value;
      if (stat && video) form.querySelector<HTMLSelectElement>(`[name="mode-${i}"]`)!.value = both ? "both" : isVideo(map) ? "animated" : "static";
    });
  });
  root.addEventListener("change", validate); validate();
  root.querySelectorAll<HTMLButtonElement>("[data-map-picker]").forEach(button => button.addEventListener("click", () => {
    const select = form.querySelector<HTMLSelectElement>(`[name="${button.dataset.mapPicker}"]`)!;
    new FilePicker({type: button.dataset.mapPicker!.startsWith("animated") ? "video" : "image", current: select.value, callback: path => {
      select.add(new Option(basename(path), path, true, true)); validate();
    }}).render(true);
  }));
}

export function readSelection(form: HTMLFormElement, selection: Selection): ScenePlan[] {
  const values = new FormData(form);
  return selection.plans.flatMap(({index: i}) => {
    if (!values.has(`variant-${i}`)) return [];
    const mode = values.get(`mode-${i}`), maps: string[] = [];
    if (mode !== "animated") maps.push(String(values.get(`static-${i}`)));
    if (mode !== "static") maps.push(String(values.get(`animated-${i}`)));
    const selected = selection.imports.find(item=>item.path===values.get(`json-${i}`));
    return [{selected, maps}];
  });
}
