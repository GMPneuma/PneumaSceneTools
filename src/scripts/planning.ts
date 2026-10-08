import {basename, type ImportFile} from "./scene-data.js";
import {importScore, isVideo, mediaForImport, rankImports, uncoveredVariants, type ScenePlan} from "./matching.js";

export function planSelection(map: string, imports: ImportFile[], files: string[], warnings: string[], manualPath?: string) {
  const ranked = rankImports(imports, map).filter(entry => entry.item.path === manualPath || importScore(entry.item, map, true) >= 50), best = ranked[0];
  const recommended = ranked.find(entry => entry.item.path === manualPath)?.item ?? (best && best.score >= 70 && best.score > (ranked[1]?.score ?? 0) ? best.item : undefined);
  const importedLayout = ranked.some(entry => entry.score >= 70);
  const rows: {item?: ImportFile; anchor: string}[] = [{anchor: map}, ...ranked.map(entry => ({item: entry.item, anchor: map})), ...uncoveredVariants(map, imports, files).map(anchor => ({anchor}))];
  const plans = rows.map(({item, anchor}, index) => {
    const staticMaps = mediaForImport(item, anchor, files, false), videos = mediaForImport(item, anchor, files, true);
    if (item?.path === manualPath && !(isVideo(map) ? videos : staticMaps).includes(map)) (isVideo(map) ? videos : staticMaps).unshift(map);
    if (!item && !(isVideo(anchor) ? videos : staticMaps).includes(anchor)) (isVideo(anchor) ? videos : staticMaps).unshift(anchor);
    const mode = (isVideo(map) && videos.length) || (!staticMaps.length && videos.length) ? "animated" : "static";
    return {index, item, label: item ? basename(item.path) : `Map only - ${basename(anchor)}`,
      recommended: item === recommended && !!item, checked: item === recommended && !!item || index === 0 && !recommended,
      related: !item ? index !== 0 || !importedLayout : importScore(item, map, true) >= 50,
      staticMaps: staticMaps.map((path,i)=>({path, label: basename(path), selected: i === 0})),
      videos: videos.map((path,i)=>({path, label: basename(path), selected: i === 0})),
      staticMode: mode === "static", animatedMode: mode === "animated"};
  });
  return {plans, importedLayout, showAllVariants: rows.length > 2 || !imports.length && rows.length > 1, warnings};
}

export type Selection = ReturnType<typeof planSelection>;
export function setupSelection(root: HTMLElement, selection: Selection, map: string) {
  const {plans, importedLayout} = selection;
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
    plans.forEach(({index,related}) => { if (related) form.querySelector<HTMLInputElement>(`[name="variant-${index}"]`)!.checked = all; });
    if (all && importedLayout) form.querySelector<HTMLInputElement>('[name="variant-0"]')!.checked = false;
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
  return selection.plans.flatMap(({item: selected, index: i}) => {
    if (!values.has(`variant-${i}`)) return [];
    const mode = values.get(`mode-${i}`), maps: string[] = [];
    if (mode !== "animated") maps.push(String(values.get(`static-${i}`)));
    if (mode !== "static") maps.push(String(values.get(`animated-${i}`)));
    return [{selected, maps}];
  });
}
