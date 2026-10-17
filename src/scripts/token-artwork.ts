import {MODULE_ID} from "./settings.js";
import {snapSeatPosition, validateSeatLayout, type SeatLayout} from "./vehicle-seats-model.js";
import {listCategoryArtwork, artworkPreview} from "./artwork-media.js";

export type SpawnKind = "mook" | "vehicle";
export interface ArtworkCategory {name: string; folder: string; kind: SpawnKind; width?: number; height?: number; scale?: number; seatLayout?: SeatLayout}

export function normalizeCategories(rows: ArtworkCategory[]): ArtworkCategory[] {
  const names = new Set<string>();
  return rows.map(row => {
    const name = row.name.trim();
    const folder = row.folder.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").replace(/\/\*$/, "");
    if (!name || !folder || folder.includes("*") || !["mook", "vehicle"].includes(row.kind)) throw new Error("Each category needs a name, kind, and artwork folder (no wildcard needed).");
    const key = `${row.kind}:${name.toLocaleLowerCase()}`;
    if (names.has(key)) throw new Error(`Duplicate category: ${name}`);
    names.add(key);
    const result: ArtworkCategory = {name, folder, kind: row.kind};
    if (row.kind === "vehicle") {
      for (const key of ["width", "height", "scale"] as const) {
        if (row[key] === undefined) continue;
        if (!Number.isFinite(row[key]) || row[key]! <= 0 || row[key]! > 100) throw new Error(`${name}: footprint and scale must be greater than zero and at most 100.`);
        result[key] = row[key];
      }
      if (row.seatLayout) result.seatLayout = validateSeatLayout(row.seatLayout);
    }
    return result;
  });
}

export function artworkCategories(kind?: SpawnKind): ArtworkCategory[] {
  const rows = game.settings!.get(MODULE_ID, "tokenArtworkCategories") as ArtworkCategory[];
  return rows.filter(row => !kind || row.kind === kind);
}

declare global {
  interface SettingConfig { "pneuma-scenetools.tokenArtworkCategories": ArtworkCategory[] }
}

class ArtworkCategoriesForm extends FormApplication {
  private rows: ArtworkCategory[];
  private selected = 0;
  private previewObserver?: ResizeObserver;
  override async close(options?: Application.CloseOptions): Promise<void> {this.previewObserver?.disconnect();await super.close(options);}
  constructor(private readonly kind: SpawnKind) {super({});this.rows = structuredClone(artworkCategories(kind));}
  static override get defaultOptions(): FormApplication.Options {
    return {...super.defaultOptions, title: "Token Artwork Categories", template: `modules/${MODULE_ID}/templates/token-artwork.hbs`, width: 1000, height: 620, resizable: true, closeOnSubmit: false};
  }
  override getData() {return {};}
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const root = html[0]!, list = root.querySelector<HTMLElement>(".artwork-list")!;
    const editor = root.querySelector<HTMLFieldSetElement>(".artwork-editor")!;
    const search = root.querySelector<HTMLInputElement>('[data-search]')!;
    const field = (key: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${key}"]`)!;
    const picture = root.querySelector<HTMLElement>(".vehicle-seat-image")!;
    const seatRows = root.querySelector<HTMLElement>(".vehicle-seat-rows")!;
    const previewMessage = root.querySelector<HTMLElement>('[data-preview-message]')!;
    const controls = root.querySelector<HTMLElement>('[data-seat-controls]')!;
    const slider = root.querySelector<HTMLInputElement>('[data-scale-slider]')!;
    let selectedSeat: string | undefined, previewRow: ArtworkCategory | undefined, previewLayout: SeatLayout | undefined;
    let request = 0;
    const drawSeats = () => {
      picture.querySelectorAll('.vehicle-seat-marker').forEach(node => node.remove());seatRows.replaceChildren();
      const row = previewRow, layout = previewLayout;
      if (!row || row.kind !== 'vehicle' || !layout) return;
      layout.seats.forEach((seat, index) => {
        const marker = document.createElement('button');marker.type = 'button';marker.className = 'vehicle-seat-marker';
        marker.style.left = String(seat.x * 100) + '%';marker.style.top = String(seat.y * 100) + '%';marker.textContent = String(index + 1);marker.title = seat.name;
        marker.classList.toggle('selected', selectedSeat === seat.id);
        marker.addEventListener('click', event => {event.stopPropagation();selectedSeat = seat.id;drawSeats();});picture.append(marker);
        const line = document.createElement('div');line.className = 'form-group';
        const label = document.createElement('label');label.textContent = String(index + 1);
        const input = document.createElement('input');input.value = seat.name;input.setAttribute('aria-label', 'Seat ' + (index + 1) + ' name');
        input.addEventListener('input', () => {seat.name = input.value;marker.title = input.value;row.seatLayout = layout;});
        const remove = document.createElement('button');remove.type = 'button';remove.textContent = 'Remove';
        remove.addEventListener('click', () => {layout.seats = layout.seats.filter(value => value.id !== seat.id);row.seatLayout = layout;if (selectedSeat === seat.id) selectedSeat = undefined;drawSeats();drawList();});
        line.append(label, input, remove);seatRows.append(line);
      });
    };
    const resizePreview = () => {
      if (!previewLayout) return;
      const stage = picture.parentElement!;
      const width = Math.min(stage.clientWidth, Math.max(180, stage.clientHeight) * previewLayout.imageWidth / previewLayout.imageHeight);
      picture.style.width = String(width) + 'px';picture.style.aspectRatio = String(previewLayout.imageWidth) + ' / ' + previewLayout.imageHeight;
    };
    const observer = new ResizeObserver(resizePreview);observer.observe(picture.parentElement!);
    this.previewObserver?.disconnect();this.previewObserver = observer;
    const loadPreview = async () => {
      const ticket = ++request, row = this.rows[this.selected];
      previewRow = undefined;previewLayout = undefined;selectedSeat = undefined;picture.hidden = true;picture.replaceChildren();seatRows.replaceChildren();controls.hidden = true;
      const folder = row?.folder.trim().replaceAll('\\', '/').replace(/\/+$/g, '');
      if (!row || !folder) {previewMessage.textContent = 'Choose an artwork folder to preview.';return;}
      previewMessage.textContent = 'Loading sample artwork…';
      try {
        const files = await listCategoryArtwork(folder);
        if (ticket !== request) return;
        if (!files.length) throw new Error('No artwork found in this folder.');
        const image = files.includes(row.seatLayout?.image ?? '') ? row.seatLayout!.image : files[0]!;
        const texture = await loadTexture(image);
        if (ticket !== request) return;
        if (!texture || !('width' in texture) || texture.width <= 0 || texture.height <= 0) throw new Error('Cannot load the artwork preview.');
        previewRow = row;previewLayout = {image, imageWidth: texture.width, imageHeight: texture.height, seats: structuredClone(row.seatLayout?.seats ?? [])};
        const media = artworkPreview(image, 'Sample category artwork');
        picture.append(media);picture.hidden = false;controls.hidden = row.kind !== 'vehicle';previewMessage.textContent = 'Sample artwork';drawSeats();resizePreview();
      } catch (error) {if (ticket === request) previewMessage.textContent = String(error);}
    };
    picture.addEventListener('click', event => {
      if (!previewRow || previewRow.kind !== 'vehicle' || !previewLayout) return;
      const bounds = picture.getBoundingClientRect();
      const point = {x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))};
      if (!event.shiftKey && root.querySelector<HTMLInputElement>('[name="snapSeats"]')!.checked) Object.assign(point, snapSeatPosition(point, previewLayout.seats, selectedSeat));
      const seat = previewLayout.seats.find(value => value.id === selectedSeat);
      if (seat) Object.assign(seat, point);
      else {
        if (previewLayout.seats.length >= 100) {previewMessage.textContent = 'Seat capacity reached.';return;}
        previewLayout.seats.push({id: foundry.utils.randomID(), name: previewLayout.seats.length ? 'Seat ' + (previewLayout.seats.length + 1) : 'Driver', ...point});
      }
      previewRow.seatLayout = previewLayout;drawSeats();drawList();
    });
    root.querySelector('[data-action="add-seat"]')!.addEventListener('click', () => {selectedSeat = undefined;drawSeats();previewMessage.textContent = 'Click artwork to place a new seat.';});
    const syncSlider = () => {slider.max = String(Math.max(5, Number(field('scale').value) || 1));slider.value = field('scale').value;};
    slider.addEventListener('input', () => {field('scale').value = slider.value;field('scale').dispatchEvent(new Event('input'));});
    const drawList = () => {
      list.replaceChildren();let count = 0;
      this.rows.forEach((row, index) => {
        if (![row.name,row.folder].join(" ").toLowerCase().includes(search.value.toLowerCase())) return;
        count++;
        const button = document.createElement("button");button.type = "button";button.className = "artwork-entry";button.dataset.index = String(index);
        button.classList.toggle("selected", index === this.selected);button.setAttribute("aria-pressed", String(index === this.selected));
        const title = document.createElement("strong");title.textContent = row.name || "New category";
        const summary = document.createElement("small");summary.textContent = row.kind === "vehicle" ? `Vehicle · ${row.width ?? 2} × ${row.height ?? 3} · ${row.seatLayout?.seats.length ?? 0} seats` : "Mook";
        button.append(title, summary);button.title = row.folder;button.addEventListener("click", () => {this.selected = index;refresh();});list.append(button);
      });
      root.querySelector('[data-count]')!.textContent = `${count} of ${this.rows.length} categories`;
      if (!count) {const empty = document.createElement("p");empty.textContent = "No matching categories.";list.append(empty);}
    };
    const refresh = () => {
      const row = this.rows[this.selected];editor.disabled = !row;editor.hidden = !row;
      root.querySelector<HTMLElement>('[data-empty]')!.hidden = !!row;
      root.querySelector<HTMLButtonElement>('[data-action="remove"]')!.disabled = !row;
      if (row) {
        for (const key of ["name", "folder"] as const) field(key).value = row[key];
        for (const key of ["width", "height", "scale"] as const) field(key).value = String(row[key] ?? (key === "width" ? 2 : key === "height" ? 3 : 1));
        root.querySelector<HTMLElement>(".artwork-vehicle")!.hidden = row.kind !== "vehicle";
        syncSlider();
      }
      drawList();void loadPreview();
    };
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach(input => input.addEventListener("input", () => {
      const row = this.rows[this.selected];if (!row) return;
      const key = input.dataset.field!;
      if (["width", "height", "scale"].includes(key)) Object.assign(row, {[key]: Number(input.value)});
      else Object.assign(row, {[key]: input.value});
      root.querySelector<HTMLElement>(".artwork-vehicle")!.hidden = row.kind !== "vehicle";drawList();
      if (key === "scale") syncSlider();
      if (key === "folder") void loadPreview();
    }));
    search.addEventListener("input", drawList);
    root.querySelector('[data-action="add"]')!.addEventListener("click", () => {
      this.rows.push({kind: this.kind, name: "", folder: ""});this.selected = this.rows.length - 1;search.value = "";refresh();field("name").focus();
    });
    root.querySelector('[data-action="remove"]')!.addEventListener("click", () => {
      this.rows.splice(this.selected, 1);this.selected = Math.max(0, Math.min(this.selected, this.rows.length - 1));refresh();
    });
    root.querySelector('[data-action="browse"]')!.addEventListener("click", () => {
      const row = this.rows[this.selected];if (!row) return;
      void import("./artwork-folder-picker.js").then(({ArtworkFolderPicker}) => {
        new ArtworkFolderPicker({type: "folder", current: row.folder, callback: path => {row.folder = path;refresh();}}).render(true);
      }).catch(error => {root.querySelector('[role="alert"]')!.textContent = String(error);});
    });
    refresh();
  }
  protected override async _updateObject(): Promise<void> {
    try {
      if (!game.user?.isGM) throw new Error("Only GMs can configure artwork categories.");
      const updated = normalizeCategories(this.rows);
      // Read the other dialog's latest saved rows, not the snapshot from when this dialog opened.
      const other = artworkCategories().filter(row => row.kind !== this.kind);
      await game.settings!.set(MODULE_ID, "tokenArtworkCategories", [...other, ...updated]);
      await this.close();
    } catch (error) {this.element[0]!.querySelector('[role="alert"]')!.textContent = String(error);}
  }
}

class MookArtworkForm extends ArtworkCategoriesForm {
  constructor() {super("mook");}
  static override get defaultOptions(): FormApplication.Options {return {...super.defaultOptions, title: "Mook Artwork"};}
}

class VehicleArtworkForm extends ArtworkCategoriesForm {
  constructor() {super("vehicle");}
  static override get defaultOptions(): FormApplication.Options {return {...super.defaultOptions, title: "Vehicle Artwork"};}
}

export function registerArtworkSettings(): void {
  game.settings!.register(MODULE_ID, "tokenArtworkCategories", {scope: "world", config: false, type: Array, default: []});
  game.settings!.registerMenu(MODULE_ID, "mookArtworkMenu", {name: "Mook Artwork", label: "Configure Mook Artwork", hint: "Manage Mook artwork categories, folders, and previews.", icon: "fas fa-images", type: MookArtworkForm, restricted: true});
  game.settings!.registerMenu(MODULE_ID, "vehicleArtworkMenu", {name: "Vehicle Artwork", label: "Configure Vehicle Artwork", hint: "Manage vehicle artwork, footprints, scale, and seat positions.", icon: "fas fa-car", type: VehicleArtworkForm, restricted: true});
}

export function chooseArtworkCategory(kind: SpawnKind, rows: ArtworkCategory[]): Promise<ArtworkCategory | null> {
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[char]!);
  return new Promise(resolve => {
    new Dialog({title: kind === "mook" ? "What kind of Mook is this?" : "What kind of vehicle is this?",
      content: `<form><div class="form-group"><label>Category</label><select name="category">${rows.map((row, i) => `<option value="${i}">${escape(row.name)}</option>`).join("")}</select></div></form>`,
      buttons: {spawn: {label: "Spawn", callback: html => resolve(rows[Number((html as JQuery).find('[name="category"]').val())] ?? null)}, cancel: {label: "Cancel", callback: () => resolve(null)}},
      default: "spawn", close: () => resolve(null),
    }).render(true);
  });
}
