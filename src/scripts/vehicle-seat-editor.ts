import {snapSeatPosition, type SeatLayout} from "./vehicle-seats-model.js";
interface SeatRiderControls {
  occupant(seatId: string): string | undefined;
  act(seatId: string): Promise<void>;
}
export function mountSeatEditor(root: HTMLElement, layout: SeatLayout, capacity: () => number, changed: () => void = () => {}, locked: () => boolean = () => false, riderControls?: SeatRiderControls): () => void {
  const picture = root.querySelector<HTMLElement>(".vehicle-seat-image")!, rows = root.querySelector<HTMLElement>(".vehicle-seat-rows")!;
  const message = root.querySelector<HTMLElement>('[role="alert"]')!;
  picture.style.width = Math.min(380, 360 * layout.imageWidth / layout.imageHeight) + 'px';
  picture.style.aspectRatio = layout.imageWidth + ' / ' + layout.imageHeight;
  let selected: string | undefined;
  const draw = () => {
    picture.querySelectorAll(".vehicle-seat-marker").forEach(node => node.remove());rows.replaceChildren();
    for (const [index, seat] of layout.seats.entries()) {
      const marker = document.createElement("button");marker.type = "button";marker.className = "vehicle-seat-marker";
      marker.style.left = `${seat.x * 100}%`;marker.style.top = `${seat.y * 100}%`;marker.textContent = String(index + 1);marker.title = seat.name;
      marker.classList.toggle("selected", seat.id === selected);
      marker.addEventListener("click", event => {event.stopPropagation();selected = seat.id;draw();});picture.append(marker);
      const row = document.createElement("div");row.className = "form-group";
      const number = document.createElement("label");number.textContent = String(index + 1);
      const input = document.createElement("input");input.type = "text";input.value = seat.name;input.setAttribute("aria-label", `Seat ${index + 1} name`);
      input.addEventListener("input", () => {if (locked()) return;seat.name = input.value;marker.title = input.value;changed();});
      const remove = document.createElement("button");remove.type = "button";remove.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i>';remove.className = 'vehicle-seat-remove';remove.title = `Remove seat ${index + 1}`;remove.setAttribute('aria-label',remove.title);
      remove.addEventListener("click", () => {if (locked()) return;if (riderControls?.occupant(seat.id)) {message.textContent = "Eject the rider before removing this seat.";return;}changed();layout.seats = layout.seats.filter(value => value.id !== seat.id);if (selected === seat.id) selected = undefined;draw();});
      row.append(number, input, remove);rows.append(row);
      if (riderControls) {
        row.classList.add('vehicle-seat-rider-row');
        const occupant = riderControls.occupant(seat.id);
        const name = document.createElement('span');name.className = 'vehicle-seat-occupant';name.textContent = occupant ?? 'Empty';name.title = name.textContent;
        const action = document.createElement('button');action.type = 'button';action.textContent = occupant ? 'Eject' : 'Enter';action.dataset.seatAction = seat.id;
        action.addEventListener('click', () => {
          if (locked()) return;
          action.disabled = true;message.textContent = '';
          void riderControls.act(seat.id).catch(error => {message.textContent = String(error);}).finally(draw);
        });
        row.append(name,action);
      }
    }
  };
  picture.addEventListener("click", event => {
    if (locked()) return;
    const bounds = picture.getBoundingClientRect();
    const point = {x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))};
    if (!event.shiftKey && root.querySelector<HTMLInputElement>('[name="snapSeats"]')!.checked) Object.assign(point, snapSeatPosition(point, layout.seats, selected));
    const seat = layout.seats.find(value => value.id === selected);
    if (seat) Object.assign(seat, point);
    else {
      if (layout.seats.length >= (capacity() > 0 ? capacity() : 100)) {message.textContent = "Seat capacity reached.";return;}
      layout.seats.push({id: foundry.utils.randomID(), name: layout.seats.length ? `Seat ${layout.seats.length + 1}` : "Driver", ...point});
    }
    message.textContent = "";changed();draw();
  });
  root.querySelector('[data-action="add"]')!.addEventListener("click", () => {selected = undefined;draw();message.textContent = "Click the image to place a new seat.";});

  draw();
  return draw;
}
