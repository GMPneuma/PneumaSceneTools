import {mountSeatEditor} from "./vehicle-seat-editor.js";
import {styleVehicleHud} from "./vehicle-hud-style.js";
import {MODULE_ID} from "./settings.js";
import {isVehicleToken} from "./vehicle-rotation.js";
import {assignment, isPassenger, riders, seatCapacity, seatLayout, type SeatLayout} from "./vehicle-seats-model.js";
import {playersControlVehicle, requestSeatAction, setPlayerVehicleControl} from "./vehicle-seats.js";

let closeSeatMenu: (() => void) | undefined;
let menuRequest = 0;
export async function openVehicleSeats(vehicle: TokenDocument, preferred?: TokenDocument, anchor?: HTMLElement): Promise<void> {
  const request = anchor ? ++menuRequest : 0;
  if (!isVehicleToken(vehicle) || (!game.user?.isGM && (vehicle.hidden || !vehicle.object?.visible))) return;
  const passengers = vehicle.parent!.tokens.filter(token => isPassenger(token) && token.isOwner);
  const selectedPassenger = () => {
    const selected = canvas.tokens?.controlled.filter(token => isPassenger(token.document) && token.document.isOwner && token.document.parent === vehicle.parent) ?? [];
    return selected.length === 1 ? selected[0]!.document : undefined;
  };
  preferred = game.user?.isGM ? passengers.find(token => token.id === preferred?.id) ?? (passengers.length === 1 ? passengers[0] : undefined) : selectedPassenger();
  const occupied = riders(vehicle);
  const layout = seatLayout(vehicle);
  const content = await renderTemplate(`modules/${MODULE_ID}/templates/vehicle-seats.hbs`, {
    hud: Boolean(anchor),
    choosePassenger: Boolean(game.user?.isGM), selectedPassengerName: preferred?.name,
    occupied: occupied.length, capacity: seatCapacity(vehicle) ?? layout?.seats.length ?? 0, missingSeats: Math.max(0, (seatCapacity(vehicle) ?? 0) - (layout?.seats.length ?? 0)),
    vehicle: vehicle.name, gm: !anchor && game.user?.isGM, passengers: passengers.map(token => ({id: token.id, name: token.name, selected: token.id === preferred?.id})),
    seats: (layout?.seats ?? []).map((seat, index) => {const rider = occupied.find(token => assignment(token)?.seatId === seat.id);return {...seat, canBoard: index < (seatCapacity(vehicle) ?? layout!.seats.length), occupant: rider?.name, riderId: rider?.id, canExit: rider?.isOwner};}),
  });
  if (anchor && (!anchor.isConnected || request !== menuRequest)) return;
  let dialog: Dialog | undefined;
  const close = () => {if (anchor) closeSeatMenu?.();else void dialog?.close();};
  const render = (html: JQuery) => {
    const root = (html as JQuery)[0]!, message = root.querySelector<HTMLElement>('[role="alert"]')!;
    const passengerSelect = root.querySelector<HTMLSelectElement>('[name="passenger"]');
    const passengerId = () => game.user?.isGM ? passengerSelect?.value : selectedPassenger()?.id;
    const refreshSelection = () => {
      root.querySelectorAll<HTMLButtonElement>('[data-action="exit"]').forEach(button => {button.hidden = button.dataset.rider !== passengerId();});
    };
    passengerSelect?.addEventListener('change', refreshSelection);refreshSelection();
    let busy = false;
    root.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");if (!button || button.disabled || busy) return;
      event.preventDefault();
      if (button.dataset.action === "edit") {void openSeatEditor(vehicle).then(close).catch(error => {message.textContent = String(error);});return;}
      const id = passengerId();
      if (button.dataset.action === 'exit' && button.dataset.rider !== id) {refreshSelection();message.textContent = 'Select the character in this seat to exit.';return;}
      const passenger = vehicle.parent?.tokens.get(id ?? "");
      if (!passenger) {message.textContent = "Select one character token on the scene.";return;}
      busy = true;message.textContent = "Updating seat…";
      void requestSeatAction(passenger, button.dataset.action === "exit" ? {action: "exit"} : {action: "board", vehicleId: vehicle.id!, seatId: button.dataset.seat})
        .then(async () => {if (anchor && !root.isConnected) return;close(); await openVehicleSeats(vehicle, passenger, anchor);})
        .catch(error => {message.textContent = String(error);}).finally(() => {busy = false;});
    });
  };
  if (anchor) {
    closeSeatMenu?.();
    const panel = document.createElement('div');panel.className = 'pneuma-vehicle-seat-menu pneuma-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Vehicle seats');
    panel.innerHTML = '<button type="button" class="vehicle-seat-menu-close" aria-label="Close vehicle seats">×</button>' + content;
    anchor.append(panel);
    const trigger = anchor.querySelector<HTMLElement>('.pneuma-vehicle-seats-control');
    trigger?.classList.add('active');trigger?.setAttribute('aria-expanded','true');
    const listeners = new AbortController();
    closeSeatMenu = () => {listeners.abort();panel.remove();trigger?.classList.remove('active');trigger?.setAttribute('aria-expanded','false');closeSeatMenu = undefined;};
    panel.querySelector('.vehicle-seat-menu-close')!.addEventListener('click', event => {event.stopPropagation();close();trigger?.focus();});
    panel.addEventListener('pointerdown', event => event.stopPropagation());
    panel.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('pointerdown', event => {if (!panel.contains(event.target as Node) && !trigger?.contains(event.target as Node)) close();}, {signal:listeners.signal});
    document.addEventListener('keydown', event => {if (event.key === 'Escape') {event.stopImmediatePropagation();close();trigger?.focus();}}, {capture:true,signal:listeners.signal});
    render($(panel));
    if (panel.getBoundingClientRect().right > window.innerWidth - 8) {panel.style.left = 'auto';panel.style.right = 'calc(100% + 140px)';}
  } else {
    dialog = new Dialog({title:'Vehicle Seats',content,buttons:{},render:html => render(html as JQuery)}, {width:440});dialog.render(true);
  }
}

export async function openSeatEditor(vehicle: TokenDocument): Promise<void> {
  if (!game.user?.isGM || !isVehicleToken(vehicle)) return;
  const texture = await loadTexture(vehicle.texture.src!);
  if (!texture || !("width" in texture)) throw new Error("Unable to load vehicle artwork.");
  const layout: SeatLayout = structuredClone(seatLayout(vehicle) ?? {image: vehicle.texture.src!, imageWidth: texture.width, imageHeight: texture.height, seats: []});
  layout.imageWidth = texture.width; layout.imageHeight = texture.height;
  const capacity = Number((vehicle.actor?.items.find(item => String(item.type) === "vehicle")?.system as {seats?: number} | undefined)?.seats ?? 0);
  await editSeatLayout(layout, capacity, async (updated, template, templateAllImages) => {
    await requestSeatAction(vehicle, {action: "layout", layout: updated, template, templateAllImages});
    await openVehicleSeats(vehicle);
  }, true);
}

export async function editSeatLayout(layout: SeatLayout, capacity: number, save: (layout: SeatLayout, template: boolean, allImages: boolean) => Promise<void>, templateOptions = false): Promise<void> {
  const content = await renderTemplate(`modules/${MODULE_ID}/templates/vehicle-seat-editor.hbs`, {
    templateOptions, image: layout.image, video: /\.(?:webm|mp4|m4v)(?:[?#].*)?$/i.test(layout.image), capacity: capacity > 0 ? capacity : "Not set",
  });
  const dialog = new Dialog({title: "Define Vehicle Seats", content, buttons: {}, render: html => {
    const root = (html as JQuery)[0]!, picture = root.querySelector<HTMLElement>(".vehicle-seat-image")!;
    const message = root.querySelector<HTMLElement>('[role="alert"]')!;
    picture.style.width = `${Math.min(460, 420 * layout.imageWidth / layout.imageHeight)}px`;
    picture.style.aspectRatio = `${layout.imageWidth} / ${layout.imageHeight}`;
    let saving = false;
    mountSeatEditor(root, layout, () => capacity, () => {}, () => saving);
    root.querySelector("form")!.addEventListener("submit", event => {
      event.preventDefault();if (saving) return;saving = true;
      root.querySelectorAll<HTMLButtonElement>("button").forEach(button => {button.disabled = true;});
      void save(layout, root.querySelector<HTMLInputElement>('[name="template"]')?.checked ?? false, root.querySelector<HTMLSelectElement>('[name="templateScope"]')?.value === "all")
        .then(async () => {await dialog.close();})
        .catch(error => {message.textContent = String(error);})
        .finally(() => {saving = false;root.querySelectorAll<HTMLButtonElement>("button").forEach(button => {button.disabled = false;});});
    });
  }}, {width: 520});
  dialog.render(true);
}

export function registerSeatHud(): void {
  const mount = (hud: TokenHUD, html: JQuery): void => {
    const token = hud.object?.document;
    if (!token || (!isVehicleToken(token) && !isPassenger(token))) return;
    if (html.find(".pneuma-vehicle-controls").length) return;
    ++menuRequest;closeSeatMenu?.();
    const vehicle = isVehicleToken(token);
    const selected = canvas.tokens?.controlled.find(value => isPassenger(value.document) && value.document.isOwner)?.document;
    const showSeats = vehicle || Boolean(assignment(token));
    if (!showSeats && !(vehicle && game.user?.isGM)) return;
    const nativeLeft = html[0]?.querySelector<HTMLElement>(":scope > .col.left");
    // Standalone Combat Tools HUDs omit the native columns. Mount beside the HUD itself.
    const title = isVehicleToken(token) ? "Enter/Exit" : "Vehicle seats";
    const button = $(`<div class="control-icon pneuma-vehicle-seats-control" role="button" tabindex="0" data-tooltip="${title}" aria-label="${title}"><svg viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><rect x="5" y="2" width="7" height="6" rx="2" transform="rotate(-12 8.5 5)"/><path d="M6 10c-.3-1.2.5-2 1.7-2h2.6c1 0 1.7.6 2 1.6l3 10.4h9.2c2.5 0 4.5 1.8 4.5 4v1H14c-2.6 0-4.4-1.5-5-4L6 10z"/><path d="M13 26h4v2h9v2H10v-2h3z"/></g></svg></div>`);
    button.on("click keydown", event => {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();event.stopPropagation();
      const currentVehicle = vehicle ? token : token.parent?.tokens.get(assignment(token)?.vehicleId ?? "");
      if (html[0]!.querySelector('.pneuma-vehicle-seat-menu')) {++menuRequest;closeSeatMenu?.();return;}
      const task = currentVehicle ? openVehicleSeats(currentVehicle, vehicle ? selected : token, html[0]!) : requestSeatAction(token, {action: "exit"});
      void task.catch(error => ui.notifications?.error(String(error)));
    });
    const controls = $('<div class="pneuma-vehicle-controls" role="group" aria-label="Vehicle controls"></div>');
    if (isVehicleToken(token) && game.user?.isGM) {
      const configure = $('<div class="control-icon" role="button" tabindex="0" data-tooltip="Configure" aria-label="Configure"><span class="pneuma-car-gear"><i class="fas fa-car"></i><i class="fas fa-gear"></i></span></div>');
      configure.on("click keydown", event => {
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();event.stopPropagation();
        void import("./vehicle-config.js").then(module => module.openVehicleConfig(token)).catch(error => ui.notifications?.error(String(error)));
      });
      controls.append(configure);
      const access = $('<div class="control-icon" role="button" tabindex="0"><i class="fas fa-users" aria-hidden="true"></i></div>');
      const element = access[0]!;
      const refresh = () => {
        const enabled = playersControlVehicle(token);
        const label = enabled ? "Disable player control" : "Enable player control";
        element.classList.toggle("active", enabled);
        element.setAttribute("aria-pressed", String(enabled));
        element.setAttribute("aria-label", label);element.setAttribute("data-tooltip", label);
      };
      let busy = false;
      access.on("click keydown", event => {
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();event.stopPropagation();
        if (busy) return;
        busy = true;element.setAttribute("aria-disabled", "true");
        void setPlayerVehicleControl(token, !playersControlVehicle(token))
          .catch(error => ui.notifications?.error(String(error)))
          .finally(() => {busy = false;element.removeAttribute("aria-disabled");refresh();});
      });
      refresh();controls.append(access);
    }
    if (showSeats) controls.append(button);
    (nativeLeft ?? html[0]!).append(controls[0]!);
    requestAnimationFrame(()=>styleVehicleHud(html[0]!));
    return;
  };
  Hooks.on("renderTokenHUD", mount);
}
