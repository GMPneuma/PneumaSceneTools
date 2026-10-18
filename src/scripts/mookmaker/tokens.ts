import { CREATED_BY_MOOK_MAKER_FLAG, MODULE_ID } from "./constants.js";
import {registerTemplateSpawning} from "../template-spawning.js";
import { showMookMakerMenu } from "./mook-form.js";
import {confirmPurgeGear, hasSavedMook} from "./purge.js";
import {styleVehicleHud} from "../vehicle-hud-style.js";

function isMookMakerToken(token: Token): boolean {
  return foundry.utils.getProperty(
    token.document,
    `flags.${MODULE_ID}.${CREATED_BY_MOOK_MAKER_FLAG}`,
  ) === true;
}

export function registerTemplateTokenTagging(): void {
  registerTemplateSpawning();
}

export function registerTokenHudAction(): void {
  Hooks.on("renderTokenHUD", (hud: TokenHUD, html: JQuery) => {
    const token = hud.object;
    if (!token || !isMookMakerToken(token) || !game.user?.isGM || token.document.actorLink || html.find('.pneuma-mook-maker-control').length) return;
    const title = game.i18n!.localize("PNEUMA_MOOK_MAKER.Menu.Open");
    const button = $(
      `<div class="control-icon pneuma-mook-maker-control" ` +
        `data-action="pneuma-mook-maker" data-tooltip="${title}" ` +
        `aria-label="${title}"><i class="fas fa-user-gear"></i></div>`,
    );
    button.on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void showMookMakerMenu(token).catch(error=>ui.notifications?.error(String(error)));
    });
    let controls=html.find('.pneuma-vehicle-controls');
    if(!controls.length){
      controls=$('<div class="pneuma-vehicle-controls" role="group" aria-label="Scene Tools controls"></div>');
      (html[0]!.querySelector(':scope > .col.left')??html[0]!).append(controls[0]!);
    }
    controls.append(button);
    const purge=$('<button type="button" class="control-icon pneuma-mook-purge-hud" data-tooltip="Purge unequipped items" aria-label="Purge unequipped items"><i class="fas fa-trash"></i></button>');
    purge.prop('disabled',!hasSavedMook(token));
    if(!hasSavedMook(token))purge.attr('data-tooltip',game.i18n!.localize('PNEUMA_MOOK_MAKER.Form.SaveBeforePurge'));
    purge.on('click',event=>{
      event.preventDefault();event.stopPropagation();
      if(!hasSavedMook(token)||!game.user?.isGM)return;
      purge.prop('disabled',true);
      void confirmPurgeGear(token).catch(error=>ui.notifications?.error(String(error))).finally(()=>purge.prop('disabled',!hasSavedMook(token)));
    });
    controls.append(purge);
    requestAnimationFrame(()=>styleVehicleHud(html[0]!));
  });
}
