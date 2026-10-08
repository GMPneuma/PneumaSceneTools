import {basename, type ImportFile} from "./scene-data.js";
import {importScore, isVideo, mediaForImport, rankImports, uncoveredVariants, type ScenePlan} from "./matching.js";

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]!));

export function planSelection(map: string, imports: ImportFile[], files: string[], warnings: string[], manualPath?: string) {
  const ranked = rankImports(imports, map).filter(entry => entry.item.path === manualPath || importScore(entry.item, map, true) >= 50), best = ranked[0];
  const recommended = ranked.find(entry => entry.item.path === manualPath)?.item ?? (best && best.score >= 70 && best.score > (ranked[1]?.score ?? 0) ? best.item : undefined);
  const importedLayout = ranked.some(entry => entry.score >= 70);
  const rows: {item?: ImportFile; anchor: string}[] = [{anchor: map}, ...ranked.map(entry => ({item: entry.item, anchor: map})), ...uncoveredVariants(map, imports, files).map(anchor => ({anchor}))];
  const options = (matches: string[], animated: boolean) => {
    return `<option value="">Choose ${animated ? "animated" : "static"} map</option>${matches.map((path, i) => `<option value="${escape(path)}" ${i === 0 && matches.length ? "selected" : ""}>${escape(basename(path))}${matches.includes(path) ? " (match)" : ""}</option>`).join("")}`;
  };
  const content = `<p>Selected map: <strong>${escape(basename(map))}</strong></p>
    <p>Select the layouts and map formats to create.</p><button type="button" data-browse-json>Choose another Scene JSON or UVTT file</button>
    ${rows.length > 2 || !imports.length && rows.length > 1 ? '<label><input type="checkbox" name="allVariants"> Import all matching variants</label>' : ""}
    <label><input type="checkbox" name="bothMedia"> Use static and animated where both are available</label>
    ${rows.map(({item, anchor}, i) => {
      const staticMaps = mediaForImport(item, anchor, files, false), videos = mediaForImport(item, anchor, files, true);
      if (item?.path === manualPath && !(isVideo(map) ? videos : staticMaps).includes(map)) (isVideo(map) ? videos : staticMaps).unshift(map);
      if (!item && !(isVideo(anchor) ? videos : staticMaps).includes(anchor)) (isVideo(anchor) ? videos : staticMaps).unshift(anchor);
      const mode = (isVideo(map) && videos.length) || (!staticMaps.length && videos.length) ? "animated" : "static";
      const related = !item ? i !== 0 || !importedLayout : importScore(item, map, true) >= 50;
      return `<fieldset data-plan="${i}" data-related="${related ? "true" : "false"}"><legend><label><input type="checkbox" name="variant-${i}" ${item && item === recommended || i === 0 && !recommended ? "checked" : ""}> ${escape(item ? basename(item.path) : `Map only - ${basename(anchor)}`)}${item && item === recommended ? " (best match)" : ""}</label></legend>
        ${item ? `<p>${escape(item.path)} - ${item.kind}</p>` : ""}
        <div class="form-group"><label>Static image</label><select name="static-${i}">${options(staticMaps, false)}</select><button type="button" data-map-picker="static-${i}">Browse</button></div>
        <div class="form-group"><label>Animated video</label><select name="animated-${i}">${options(videos, true)}</select><button type="button" data-map-picker="animated-${i}">Browse</button></div>
        <div class="form-group"><label>Create</label><select name="mode-${i}"><option value="static" ${mode === "static" ? "selected" : ""}>Static</option><option value="animated" ${mode === "animated" ? "selected" : ""}>Animated</option><option value="both">Both (two scenes)</option></select></div></fieldset>`;
    }).join("")}
    ${warnings.length ? `<details><summary>Scan warnings (${warnings.length})</summary>${warnings.map(w => `<p>${escape(w)}</p>`).join("")}</details>` : ""}`;
  const setup = (root: HTMLElement) => {
      const form = root instanceof HTMLFormElement ? root : root.querySelector<HTMLFormElement>("form")!;
      const validate = () => {
        const checked = rows.some((_item, i) => form.querySelector<HTMLInputElement>(`[name="variant-${i}"]`)!.checked);
        form.querySelector<HTMLInputElement>('[name="variant-0"]')!.setCustomValidity(checked ? "" : "Select at least one variant.");
        rows.forEach((_item, i) => {
          const enabled = form.querySelector<HTMLInputElement>(`[name="variant-${i}"]`)!.checked;
          const mode = form.querySelector<HTMLSelectElement>(`[name="mode-${i}"]`)!.value;
          form.querySelector<HTMLSelectElement>(`[name="static-${i}"]`)!.required = enabled && mode !== "animated";
          form.querySelector<HTMLSelectElement>(`[name="animated-${i}"]`)!.required = enabled && mode !== "static";
        });
      };
      root.querySelector<HTMLInputElement>('[name="allVariants"]')?.addEventListener("change", event => {
        const all = (event.target as HTMLInputElement).checked;
        rows.forEach((_item, i) => { if (root.querySelector(`[data-plan="${i}"]`)?.getAttribute("data-related") === "true") form.querySelector<HTMLInputElement>(`[name="variant-${i}"]`)!.checked = all; });
        if (all && importedLayout) form.querySelector<HTMLInputElement>('[name="variant-0"]')!.checked = false;
      });
      root.querySelector<HTMLInputElement>('[name="bothMedia"]')?.addEventListener("change", event => {
        const both = (event.target as HTMLInputElement).checked;
        rows.forEach((_item, i) => {
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
    };
  const read = (form: HTMLFormElement): ScenePlan[] => {
  const values = new FormData(form);
  return rows.flatMap(({item: selected}, i) => {
    if (!values.has(`variant-${i}`)) return [];
    const mode = values.get(`mode-${i}`), maps: string[] = [];
    if (mode !== "animated") maps.push(String(values.get(`static-${i}`)));
    if (mode !== "static") maps.push(String(values.get(`animated-${i}`)));
    return [{selected, maps}];
  });
  };
  return {content, setup, read};
}
