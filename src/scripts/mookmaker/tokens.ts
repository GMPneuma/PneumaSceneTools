import { CREATED_BY_MOOK_MAKER_FLAG, MODULE_ID } from "./constants.js";
import {registerTemplateSpawning} from "../template-spawning.js";
import { showMookMakerMenu } from "./mook-form.js";

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
    if (!token || !isMookMakerToken(token)) return;
    const title = game.i18n!.localize("PNEUMA_MOOK_MAKER.Menu.Open");
    const button = $(
      `<div class="control-icon pneuma-mook-maker-control" ` +
        `data-action="pneuma-mook-maker" data-tooltip="${title}" ` +
        `aria-label="${title}"><i class="fas fa-user-gear"></i></div>`,
    );
    button.on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showMookMakerMenu(token);
    });
    html.find(".col.right").append(button);
  });
}
