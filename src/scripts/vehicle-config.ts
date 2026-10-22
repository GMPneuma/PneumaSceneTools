import {MODULE_ID} from "./settings.js";
import {artworkCategories, type ArtworkCategory} from "./token-artwork.js";
import {isVehicleToken} from "./vehicle-rotation.js";
import {playersControlVehicle, setPlayerVehicleControl, requestSeatAction, syncVehicleSeats} from "./vehicle-seats.js";
import {mountSeatEditor} from "./vehicle-seat-editor.js";
import {validateSeatLayout, type SeatLayout, assignment, isPassenger, riders, seatFlag, seatLayout} from "./vehicle-seats-model.js";
import {armoredChassisData} from "./vehicle-chassis.js";
import {isArtworkVideo, listCategoryArtwork} from "./artwork-media.js";
import {vehicleFootprintSize, vehicleGridFootprintSize} from "./vehicle-rotation-geometry.js";
import {getVehicleBaseSize} from "./vehicle-footprint.js";
import {isPromotedVehicle, promoteVehicle} from "./vehicle-promotion.js";

export async function vehicleArtworkUpdate(token: TokenDocument, category: ArtworkCategory, image: string, capacity: number): Promise<Record<string, unknown>> {
  const base = getVehicleBaseSize(token), width = category.width ?? base.width, height = category.height ?? base.height;
  const footprint = token.parent?.grid.type === 1 ? vehicleGridFootprintSize({width,height}, token.rotation) : vehicleFootprintSize({width,height}, token.rotation);
  const update: Record<string, unknown> = {...footprint, "texture.src": image, "delta.img": image,
    "texture.scaleX": category.scale ?? 1, "texture.scaleY": category.scale ?? 1,
    [`flags.${MODULE_ID}.vehicleFootprint`]: {width,height}, [`flags.${MODULE_ID}.vehicleArtworkCategory`]: category.folder};
  if (category.seatLayout) {
    if (category.seatLayout.seats.length < capacity) throw new Error(`This artwork defines ${category.seatLayout.seats.length} seat positions; this vehicle needs ${capacity}. Add positions in the seat preview before saving.`);
    const texture = await loadTexture(image);
    if (!texture || !("width" in texture)) throw new Error("Cannot load the selected artwork.");
    update[`flags.${MODULE_ID}.vehicleSeats`] = {...structuredClone(category.seatLayout),image,imageWidth:texture.width,imageHeight:texture.height};
  } else if (capacity > 0) throw new Error("Place seat positions in the preview before saving a vehicle with seats.");
  else update[`flags.${MODULE_ID}.-=vehicleSeats`] = null;
  return update;
}

export function vehicleArmor(actor: Actor): Item | undefined {
  return actor.items.find(item => String(item.type) === "armor" && foundry.utils.getProperty(item, `flags.${MODULE_ID}.armoredChassis`) === true)
    ?? actor.items.find(item => String(item.type) === "armor" && foundry.utils.getProperty(item, "system.equipped") === "equipped" && foundry.utils.getProperty(item, "system.isBodyLocation"));
}

export interface VehicleStats {hp: number; maxHp: number; sp: number; maxSp: number; move: number; seats: number}
export function vehicleStats(actor: Actor): VehicleStats {
  const read = (object: object, path: string) => Number(foundry.utils.getProperty(object, path) ?? 0);
  const armor = vehicleArmor(actor), maxSp = armor ? read(armor, "system.bodyLocation.sp") : 0;
  return {hp: read(actor, "system.derivedStats.hp.value"), maxHp: read(actor, "system.derivedStats.hp.max"),
    sp: Math.max(0, maxSp - (armor ? read(armor, "system.bodyLocation.ablation") : 0)), maxSp, move: read(actor, "system.stats.move.value"), seats: Number(foundry.utils.getProperty(actor.items.find(item => String(item.type) === "vehicle") ?? {}, "system.seats") ?? 0)};
}

export interface VehicleAppearance {layout: SeatLayout; width: number; height: number; scale: number}

export async function saveVehicleConfig(token: TokenDocument, stats: VehicleStats, initial: VehicleStats, artwork: string, appearance?: VehicleAppearance): Promise<void> {
  if (!game.user?.isGM || !isVehicleToken(token) || !token.isOwner || !token.actor || token.parent?.tokens.get(token.id!) !== token) throw new Error("This vehicle is unavailable or you do not own it.");
  if (token.actorLink && !isPromotedVehicle(token)) throw new Error("Unlink this vehicle before configuring the placed vehicle.");
  if (!Object.values(stats).every(value => Number.isFinite(value) && Number.isInteger(value)) || stats.maxHp < 1 || stats.hp > stats.maxHp || stats.sp < 0 || stats.maxSp < stats.sp || stats.move < 0 || !Number.isInteger(stats.seats) || stats.seats < 0 || stats.seats > 100) throw new Error("Enter whole numbers: maximum HP must be positive, HP cannot exceed maximum, and SP/MOVE cannot be negative; Seats must be between 0 and 100.");
  if (stats.seats !== initial.seats) {
    const allowed = new Set(seatLayout(token)?.seats.slice(0, stats.seats).map(seat => seat.id) ?? []);
    if (riders(token).some(rider => !allowed.has(assignment(rider)!.seatId))) throw new Error("Exit affected seats before reducing capacity.");
  }
  if (appearance) {
    appearance = {...appearance, layout: validateSeatLayout(appearance.layout)};
    if (![appearance.width, appearance.height].every(n => Number.isFinite(n) && n >= .1 && n <= 100) || !Number.isFinite(appearance.scale) || appearance.scale < .1 || appearance.scale > 10) throw new Error("Token size must be 0.1–100 squares and scale 0.1–10.");
    if (riders(token).some(rider => !appearance!.layout.seats.slice(0, stats.seats).some(seat => seat.id === assignment(rider)?.seatId))) throw new Error("Exit affected seats before removing their positions.");
  }
  let image: string | undefined;
  let categoryUpdate: Record<string, unknown> = {};
  if (appearance) {
    image = appearance.layout.image;
    if (riders(token).length && image !== token.texture.src) throw new Error("Exit the vehicle before changing artwork.");
    const category = artwork && artwork !== "__manual" ? artworkCategories("vehicle").find(row => row.folder === artwork) : undefined;
    if (artwork && artwork !== "__manual" && !category) throw new Error("That artwork category no longer exists.");
    categoryUpdate = await vehicleArtworkUpdate(token, {...category, name: category?.name ?? "Manual", kind: "vehicle", folder: category?.folder ?? "", width: appearance.width, height: appearance.height, scale: appearance.scale, seatLayout: appearance.layout}, image, stats.seats);
  } else if (artwork && artwork !== seatFlag(token, "vehicleArtworkCategory")) {
    const category = artworkCategories("vehicle").find(row => row.folder === artwork);
    if (!category) throw new Error("That artwork category no longer exists.");
    if (riders(token).length) throw new Error("Exit the vehicle before changing artwork so seat positions can be checked.");
    const files = await listCategoryArtwork(category.folder);
    if (!files.length) throw new Error("No token artwork found in this category.");
    image = files[Math.floor(Math.random() * files.length)]!;
    categoryUpdate = await vehicleArtworkUpdate(token, category, image, stats.seats);
  }
  const actor = token.actor;
  if (stats.seats !== initial.seats) {
    const vehicle = actor.items.find(item => String(item.type) === "vehicle");
    if (vehicle) {if (!await vehicle.update({"system.seats": stats.seats} as object)) throw new Error("Seat count update was cancelled.");}
    else if (!(await actor.createEmbeddedDocuments("Item", [{name: "Vehicle", type: "vehicle", system: {seats: stats.seats}}] as unknown as Item.CreateData[]))?.length) throw new Error("Seat count creation was cancelled.");
  }
  const changes: Record<string, number> = {};
  for (const [key, path] of [["hp", "derivedStats.hp.value"], ["maxHp", "derivedStats.hp.max"], ["move", "stats.move.value"]] as const) if (stats[key] !== initial[key]) changes[`system.${path}`] = stats[key];
  if (stats.sp !== initial.sp || stats.maxSp !== initial.maxSp) {
    const armor = vehicleArmor(actor), system = {"system.bodyLocation.sp": stats.maxSp, "system.bodyLocation.ablation": stats.maxSp - stats.sp};
    if (armor) {if (!await armor.update(system as object)) throw new Error("Armor update was cancelled.");}
    else {
      const data = armoredChassisData(true);data.system.bodyLocation = {sp: stats.maxSp, ablation: stats.maxSp - stats.sp};
      if (!(await actor.createEmbeddedDocuments("Item", [data] as unknown as Item.CreateData[]))?.length) throw new Error("Armor creation was cancelled.");
    }
  }
  if (Object.keys(changes).length && !await actor.update(changes as object)) throw new Error("Vehicle stat update was cancelled; armor changes may already have saved.");
  if (image) {
    if (token.actorLink) {
      delete categoryUpdate["delta.img"];
      if (!await actor.update({img: image} as object)) throw new Error("Vehicle artwork update was cancelled.");
    }
    if (!await token.update(categoryUpdate as object)) throw new Error("Artwork update was cancelled; stat changes may already have saved.");
    await syncVehicleSeats(token);
  }
}

export async function openVehicleConfig(token: TokenDocument): Promise<void> {
  if (!game.user?.isGM || !isVehicleToken(token) || !token.isOwner || !token.actor) return;
  const initial = vehicleStats(token.actor), selected = seatFlag(token, "vehicleArtworkCategory"), base = getVehicleBaseSize(token);
  const categories = artworkCategories("vehicle").sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
  let closed = false;
  let disposeSizing = () => {};
  const content = await renderTemplate(`modules/${MODULE_ID}/templates/vehicle-config.hbs`, {stats: initial, gm: true, selectedArtwork: selected ?? "",
    canPromote: !token.actorLink, linked: token.actorLink,
    width: base.width, height: base.height, scale: Math.abs(token.texture.scaleX ?? 1),
    artwork: categories.map(row => ({...row,width:row.width ?? 2,height:row.height ?? 3,seatCount:row.seatLayout?.seats.length ?? 0,selected:row.folder === selected}))});
  const dialog = new Dialog({title: `Configure ${token.name}`, content, buttons: {}, close: () => {closed = true;disposeSizing();}, render: html => {
    const root = (html as JQuery)[0]!, alert = root.querySelector<HTMLElement>('[data-config-error]')!;
    // This dialog has form controls rather than native Dialog footer buttons.
    // Keep Tab's browser focus navigation out of Dialog/game keyboard handlers.
    root.addEventListener('keydown', event => {if (event.key === 'Tab') event.stopImmediatePropagation();}, true);
    const host = root.querySelector<HTMLElement>('[data-seat-editor]')!, status = root.querySelector<HTMLElement>('[data-preview-status]')!;
    const choice = root.querySelector<HTMLInputElement>('[name="artwork"]')!;
    const field = (name: string) => root.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    const number = (name: string) => field(name).valueAsNumber;
    // Use actual rendered controls to reserve space, including native font sizes.
    let sizingFrame = 0;
    const fitSeats = () => {
      cancelAnimationFrame(sizingFrame);
      sizingFrame = requestAnimationFrame(() => {
        if (closed) return;
        const rows = host.querySelector<HTMLElement>('.vehicle-seat-rows');
        if (!rows) return;
        const form = root.querySelector<HTMLFormElement>('form')!;
        const middle = root.querySelector<HTMLElement>('.vehicle-config-middle')!;
        const columns = root.querySelector<HTMLElement>('.vehicle-config-columns')!;
        const chrome = root.querySelector<HTMLElement>('.window-header')?.offsetHeight ?? 32;
        const overhead = middle.offsetHeight - rows.offsetHeight + form.offsetHeight - columns.offsetHeight + chrome + 56;
        rows.style.maxHeight = Math.max(80, window.innerHeight - overhead) + 'px';
        dialog.setPosition?.({height: 'auto'});
      });
    };
    const sizingObserver = new MutationObserver(fitSeats);
    sizingObserver.observe(host, {childList:true,subtree:true});
    window.addEventListener('resize',fitSeats);
    disposeSizing();
    disposeSizing = () => {sizingObserver.disconnect();cancelAnimationFrame(sizingFrame);window.removeEventListener('resize',fitSeats);};
    let busy = false, loading = false, failed = false, dirty = false, ticket = 0, layout: SeatLayout | undefined;
    const signature = (seats: SeatLayout['seats'], width: number, height: number, scale: number) =>
      JSON.stringify({seats:seats.map(({name,x,y}) => ({name,x,y})),width,height,scale});
    let setupBaseline: string | undefined;
    const customized = () => layout && setupBaseline !== undefined &&
      signature(layout.seats,number('width'),number('height'),number('scale')) !== setupBaseline;
    const saveDraft = async () => {
      if (loading || failed) throw new Error("Wait for a valid artwork preview before saving.");
      await saveVehicleConfig(token, {hp:number("hp"),maxHp:number("maxHp"),sp:number("sp"),maxSp:number("maxSp"),move:number("move"),seats:number("seats")}, initial, choice.value,
        dirty && layout ? {layout,width:number("width"),height:number("height"),scale:number("scale")} : undefined);
      Object.assign(initial, vehicleStats(token.actor!));dirty = false;
      choice.value = String(seatFlag(token, "vehicleArtworkCategory") ?? "");
    };
    const resize = () => {
      if (!layout) return;
      const width = number("width"), height = number("height"), scale = number("scale");
      if (![width,height,scale].every(n => Number.isFinite(n) && n > 0) || width > 100 || height > 100 || scale > 10) return;
      const previewSize = Math.min(340, Math.max(200, root.querySelector<HTMLElement>('.vehicle-config-preview')!.clientWidth - 24));
      const cell = Math.min(previewSize / (width + 2), previewSize / (height + 2)),  grid = root.querySelector<HTMLElement>('.vehicle-preview-grid'), picture = root.querySelector<HTMLElement>('.vehicle-seat-image');
      if (!grid || !picture) return;
      grid.style.width = (width + 2) * cell + "px";grid.style.height = (height + 2) * cell + "px";grid.style.setProperty('--vehicle-cell', cell + 'px');
      grid.style.setProperty('--vehicle-footprint-width', width * cell + 'px');
      grid.style.setProperty('--vehicle-footprint-height', height * cell + 'px');
      root.querySelector<HTMLOutputElement>('[data-scale-value]')!.value = scale + '×';
      picture.style.width = Math.min(width * cell / layout.imageWidth, height * cell / layout.imageHeight) * layout.imageWidth * scale + 'px';
      status.textContent = width + ' × ' + height + ' squares · scale ' + scale;
    };
    const load = async (image: string, seats: SeatLayout | undefined, request: number) => {
      const texture = await loadTexture(image);
      if (closed || request !== ticket) return;
      if (!texture || !("width" in texture) || !texture.width || !texture.height) throw new Error("Cannot load the artwork preview.");
      const draft: SeatLayout = {image,imageWidth:texture.width,imageHeight:texture.height,seats:structuredClone(seats?.seats ?? [])};
      const markup = await renderTemplate(`modules/${MODULE_ID}/templates/vehicle-seat-controls.hbs`, {image,video:isArtworkVideo(image)});
      if (closed || request !== ticket) return;
      layout = draft;host.innerHTML = markup;
      const category = categories.find(row => row.folder === choice.value);
      setupBaseline = category
        ? signature(category.seatLayout?.seats ?? [],category.width ?? base.width,category.height ?? base.height,category.scale ?? 1)
        : signature(draft.seats,number('width'),number('height'),number('scale'));
      root.querySelector('[data-preview-image]')!.replaceChildren(host.querySelector('.vehicle-preview-grid')!, host.querySelector('.vehicle-seat-preview-help')!);
      mountSeatEditor(root,layout,() => number("seats"),() => {dirty = true;},() => busy || loading, {
        occupant: id => riders(token).find(rider => assignment(rider)?.seatId === id)?.name ?? undefined,
        act: async id => {
          if (busy || closed || !game.user?.isGM) return;
          busy = true;
          const controls = root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select');
          controls.forEach(control => {control.disabled = true;});
          try {
            const occupant = riders(token).find(rider => assignment(rider)?.seatId === id);
            if (occupant) await requestSeatAction(occupant, {action:"exit"});
            else {
              const passenger = await chooseSeatPassenger(token);
              if (!passenger || closed) return;
              if (assignment(passenger)) throw new Error("That token is already seated.");
              await saveDraft();
              await requestSeatAction(passenger, {action:"board",vehicleId:token.id!,seatId:id});
            }
          } finally {busy = false;controls.forEach(control => {control.disabled = false;});}
        },
      });
      resize();
    };
    const preview = async (manual?: string, current = false) => {
      const request = ++ticket;loading = true;failed = false;host.replaceChildren();root.querySelector('[data-preview-image]')!.replaceChildren();status.textContent = "Loading artwork…";
      try {
        if (manual) {choice.value = "__manual";dirty = true;await load(manual,undefined,request);}
        else if (current || !choice.value) {
          if (!current) {field("width").value = String(base.width);field("height").value = String(base.height);field("scale").value = String(Math.abs(token.texture.scaleX ?? 1));dirty = false;}
          await load(token.texture.src!,seatLayout(token) ?? undefined,request);
        } else if (choice.value === "__manual") {layout = undefined;status.textContent = "Choose an artwork file.";failed = true;}
        else {
          const category = categories.find(row => row.folder === choice.value);
          if (!category) throw new Error("That artwork category no longer exists.");
          const files = await listCategoryArtwork(category.folder);
          if (closed || request !== ticket) return;
          if (!files.length) throw new Error("No token artwork found in this category.");
          const image = files.includes(category.seatLayout?.image ?? '') ? category.seatLayout!.image : files[0]!;
          field("width").value = String(category.width ?? base.width);field("height").value = String(category.height ?? base.height);field("scale").value = String(category.scale ?? 1);
          dirty = true;await load(image,category.seatLayout,request);
        }
      } catch (error) {if (!closed && request === ticket) {failed = true;status.textContent = String(error);}}
      finally {if (request === ticket) {loading = false;refreshCategories();}}
    };
    const run = (work: () => Promise<unknown>) => {
      if (busy) return;busy = true;alert.textContent = "";
      root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select').forEach(control => {control.disabled = true;});
      void work().catch(error => {alert.textContent = String(error);}).finally(() => {busy = false;root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select').forEach(control => {control.disabled = false;});});
    };
    const refreshCategories = () => {
      root.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => {
        const active = button.dataset.category === choice.value;
        button.setAttribute('aria-pressed',String(active));button.closest('tr')!.classList.toggle('selected',active);
      });
    };
    const replaceArtwork = (work: () => Promise<void>) => run(async () => {
      if (loading || closed) return;
      if (customized() && !await Dialog.confirm({
        title: "Replace vehicle setup?", defaultYes: false,
        content: "<p>Changing artwork can replace your seat names and positions, token footprint, and scale with the selected artwork's setup. Your current customizations may be lost.</p><p>Continue? Choose No to keep the current setup.</p>",
      })) return;
      if (!closed) await work();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => button.addEventListener('click', () => {
      if (busy || loading || button.dataset.category === choice.value) return;
      replaceArtwork(async () => {choice.value = button.dataset.category!;refreshCategories();await preview();});
    }));
    root.querySelector<HTMLInputElement>('[data-category-filter]')!.addEventListener('input', event => {
      const query = (event.target as HTMLInputElement).value.trim().toLocaleLowerCase();let matches = 0;
      root.querySelectorAll<HTMLTableRowElement>('[data-category-row]').forEach(row => {row.hidden = !row.textContent!.toLocaleLowerCase().includes(query);if (!row.hidden) matches++;});
      root.querySelector<HTMLElement>('[data-no-categories]')!.hidden = matches > 0;
    });
    refreshCategories();
    root.querySelector('[data-action="artwork-file"]')!.addEventListener('click',() => {
      new FilePicker({type:"imagevideo",current:layout?.image ?? token.texture.src!,callback:path => {if (!closed && !busy && path !== layout?.image) replaceArtwork(() => preview(path));}}).render(true);
    });
    for (const name of ['width','height','scale']) field(name).addEventListener('input',() => {dirty = true;resize();});
    const drive = root.querySelector<HTMLInputElement>('[name="playersCanDrive"]');
    if (drive) {
      drive.checked = playersControlVehicle(token);
      drive.addEventListener("change", () => {
        const enabled = drive.checked;
        if (busy) {drive.checked = playersControlVehicle(token);return;}
        run(async () => {
          try {await setPlayerVehicleControl(token, enabled);}
          finally {drive.checked = playersControlVehicle(token);}
        });
      });
    }
    root.querySelector('[data-action="promote"]')?.addEventListener('click', () => run(async () => {
      if (!await Dialog.confirm({title: "Promote Vehicle", defaultYes: false,
        content: "<p>Save pending edits and create a permanent Actor in SceneTools/Promoted Vehicles? This token will link to the Actor. Its prototype token will retain the vehicle artwork, footprint, rotation pivot, and seats.</p>"})) return;
      if (closed) return;
      await saveDraft();
      await promoteVehicle(token);
      await dialog.close();
    }));
    root.querySelector("form")!.addEventListener("submit", event => {event.preventDefault();run(async () => {
      await saveDraft();
      await dialog.close();
    });});
    void preview(undefined,true);
  }}, {width: 1080, height: "auto", resizable: true, classes: ["dialog", "pneuma-vehicle-config-dialog"]});dialog.render(true);
}

function chooseSeatPassenger(vehicle: TokenDocument): Promise<TokenDocument | undefined> {
  const available = vehicle.parent?.tokens.filter(token => isPassenger(token) && token.isOwner && !assignment(token)) ?? [];
  if (!available.length) throw new Error("No unseated character tokens are available on this scene.");
  return new Promise(resolve => {
    new Dialog({title:"Enter vehicle",content:'<p>Entering saves pending vehicle edits.</p><label>Scene token <select name="seatPassenger"></select></label>',
      render: html => {
        const select = (html as JQuery)[0]!.querySelector<HTMLSelectElement>('[name="seatPassenger"]')!;
        for (const token of available) {const option = document.createElement('option');option.value = token.id!;option.textContent = `${token.name} (${token.id})`;select.append(option);}
      },
      buttons:{cancel:{label:"Cancel"},enter:{label:"Enter",callback:html => {
        const id = (html as JQuery)[0]!.querySelector<HTMLSelectElement>('[name="seatPassenger"]')!.value;
        resolve(vehicle.parent?.tokens.get(id));
      }}},default:"enter",close:() => resolve(undefined),
    },{width:360}).render(true);
  });
}
