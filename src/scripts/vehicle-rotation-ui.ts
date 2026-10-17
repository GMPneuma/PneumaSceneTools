import {MODULE_ID} from "./settings.js";
import {getVehiclePivot, getVehiclePose, isVehicleToken} from "./vehicle-rotation.js";
import {vehiclePivotPosition, type VehiclePivot} from "./vehicle-rotation-geometry.js";

const dialogs = new Map<string, Dialog>();

export async function openVehiclePivot(token: TokenDocument): Promise<void> {
  if (!isVehicleToken(token) || !token.isOwner || token.parent?.grid.type === 1) return;
  const existing = dialogs.get(token.uuid);
  if (existing) {existing.bringToTop(); return;}
  let pivot = getVehiclePivot(token);
  const content = await renderTemplate(`modules/${MODULE_ID}/templates/vehicle-pivot.hbs`, {x: pivot.x * 100, y: pivot.y * 100});
  // Template loading is asynchronous; recheck before creating a second dialog or a marker.
  if (dialogs.has(token.uuid) || !isVehicleToken(token) || !token.isOwner || token.parent?.tokens.get(token.id!) !== token) return;
  let marker: PIXI.Graphics | undefined;
  const clearMarker = () => {if (marker && !marker.destroyed) marker.destroy(); marker = undefined;};
  const preview = () => {
    clearMarker();
    if (canvas.scene?.id !== token.parent?.id || !canvas.tokens || !token.object?.visible) return;
    const point = vehiclePivotPosition(getVehiclePose(token), pivot);
    marker = new PIXI.Graphics();
    marker.eventMode = "none";
    marker.lineStyle(3, 0x000000).drawCircle(0, 0, 9);
    marker.lineStyle(2, 0xffffff).drawCircle(0, 0, 7).moveTo(-12, 0).lineTo(12, 0).moveTo(0, -12).lineTo(0, 12);
    marker.position.set(point.x, point.y);
    canvas.tokens.addChild(marker);
  };
  const onUpdate = (updated: TokenDocument) => {if (updated.uuid === token.uuid) preview();};
  const onDelete = (deleted: TokenDocument) => {if (deleted.uuid === token.uuid) void dialog.close();};
  const onTearDown = () => {void dialog.close();};
  const dialog = new Dialog({title: "Vehicle Rotation Pivot", content, buttons: {},
    render: html => {
      const root = (html as JQuery)[0]!;
      const form = root.querySelector("form")!;
      const message = root.querySelector<HTMLElement>('[role="alert"]')!;
      const read = (): VehiclePivot => {
        const xInput = root.querySelector<HTMLInputElement>('[name="pivotX"]')!;
        const yInput = root.querySelector<HTMLInputElement>('[name="pivotY"]')!;
        const x = xInput.valueAsNumber / 100, y = yInput.valueAsNumber / 100;
        if (![x, y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error("Pivot coordinates must be between 0 and 100%.");
        return {x, y};
      };
      form.addEventListener("input", () => {
        try {pivot = read(); message.textContent = ""; preview();}
        catch (error) {message.textContent = String(error);}
      });
      root.querySelector('[data-action="center"]')!.addEventListener("click", () => {
        root.querySelector<HTMLInputElement>('[name="pivotX"]')!.value = "50";
        root.querySelector<HTMLInputElement>('[name="pivotY"]')!.value = "50";
        pivot = {x: 0.5, y: 0.5}; message.textContent = ""; preview();
      });
      root.querySelector('[data-action="cancel"]')!.addEventListener("click", () => {void dialog.close();});
      let saving = false;
      form.addEventListener("submit", event => {
        event.preventDefault();
        if (saving) return;
        saving = true;
        void (async () => {
          try {
            pivot = read();
            if (!isVehicleToken(token) || !token.isOwner || token.parent?.tokens.get(token.id!) !== token) throw new Error("This vehicle is no longer available or you do not own it.");
            await token.update({[`flags.${MODULE_ID}.vehiclePivot`]: pivot} as object);
            await dialog.close();
          } catch (error) {message.textContent = String(error);}
          finally {saving = false;}
        })();
      });
      preview();
    },
    close: () => {
      clearMarker(); dialogs.delete(token.uuid);
      Hooks.off("updateToken", onUpdate); Hooks.off("deleteToken", onDelete); Hooks.off("canvasTearDown", onTearDown);
    },
  }, {width: 400});
  dialogs.set(token.uuid, dialog);
  Hooks.on("updateToken", onUpdate); Hooks.on("deleteToken", onDelete); Hooks.on("canvasTearDown", onTearDown);
  dialog.render(true);
}
