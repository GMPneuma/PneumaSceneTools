import { CREATED_BY_MOOK_MAKER_FLAG, MODULE_ID } from "./constants.js";
import { isTemplateActor } from "./folders.js";
import { showMookMakerMenu } from "./mook-form.js";

function isMookMakerToken(token: Token): boolean {
  return foundry.utils.getProperty(
    token.document,
    `flags.${MODULE_ID}.${CREATED_BY_MOOK_MAKER_FLAG}`,
  ) === true;
}

export function registerTemplateTokenTagging(): void {
  Hooks.on(
    "preCreateToken",
    (token: TokenDocument, _data: object, _options: object, userId: string) => {
      if (userId !== game.user?.id || token.actorLink) return;
      const sourceActor = token.actorId ? game.actors?.get(token.actorId) : undefined;
      if (!isTemplateActor(sourceActor as Actor | undefined)) return;
      token.updateSource({
        flags: {
          [MODULE_ID]: { [CREATED_BY_MOOK_MAKER_FLAG]: true },
        },
      } as object);
    },
  );
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
