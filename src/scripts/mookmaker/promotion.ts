import {withMookOperation} from "./operations.js";
import {
  CREATED_BY_MOOK_MAKER_FLAG,
  DEFAULT_MOOK_TEMPLATE_FLAG,
  DEFAULT_MOOK_TEMPLATE_VERSION_FLAG,
  FOLDER_NAMES,
  MODULE_ID,
  PROMOTED_FROM_MOOK_MAKER_FLAG,
} from "./constants.js";

import {findSceneToolsFolder} from "../world-folders.js";

export async function promoteToken(token: Token): Promise<boolean> {
  return withMookOperation(token, () => promoteTokenUnlocked(token));
}

async function promoteTokenUnlocked(token: Token): Promise<boolean> {
  const actor = token.actor;
  if (!actor || token.document.actorLink) {
    ui.notifications?.warn(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.UnlinkedOnly"),
    );
    return false;
  }
  const folder = findSceneToolsFolder("Actor", FOLDER_NAMES.promoted);
  if (!folder) {
    ui.notifications?.error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PromotedFolderMissing"),
    );
    return false;
  }

  let promotedActor: Actor | undefined;
  try {
    const actorData = actor.toObject() as Record<string, unknown>;
    const prototypeToken = (actorData.prototypeToken ?? {}) as Record<string, unknown>;
    const prototypeTexture = (prototypeToken.texture ?? {}) as Record<string, unknown>;
    const tokenImage = token.document.texture.src;
    delete actorData._id;
    const flags = (actorData.flags ??= {}) as Record<string, Record<string, unknown>>;
    const moduleFlags = (flags[MODULE_ID] ??= {});
    delete moduleFlags[DEFAULT_MOOK_TEMPLATE_FLAG];
    delete moduleFlags[DEFAULT_MOOK_TEMPLATE_VERSION_FLAG];
    moduleFlags[PROMOTED_FROM_MOOK_MAKER_FLAG] = true;
    Object.assign(actorData, {
      name: actor.name,
      img: tokenImage,
      folder: folder.id,
      prototypeToken: {
        ...prototypeToken,
        name: actor.name,
        actorLink: true,
        texture: { ...prototypeTexture, src: tokenImage },
      },
    });

    promotedActor = await (Actor as unknown as {
      create(data: object): Promise<Actor | undefined>;
    }).create(actorData);
    if (!promotedActor) throw new Error("Actor creation returned no document.");

    await (token.document as unknown as {
      update(data: object): Promise<unknown>;
    }).update({
      actorId: promotedActor.id,
      actorLink: true,
      [`flags.${MODULE_ID}.-=${CREATED_BY_MOOK_MAKER_FLAG}`]: null,
      [`flags.${MODULE_ID}.${PROMOTED_FROM_MOOK_MAKER_FLAG}`]: true,
    });
    if (token.document.actorId !== promotedActor.id || !token.document.actorLink) {
      throw new Error("Foundry did not confirm the token was linked to the promoted Actor.");
    }
    ui.notifications?.info(
      game.i18n!.format("PNEUMA_MOOK_MAKER.Form.Promoted", { name: actor.name }),
    );
    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to promote mook`, error);
    if (promotedActor && token.document.actorId !== promotedActor.id) {
      try {
        await promotedActor.delete();
      } catch (rollbackError) {
        console.error(`${MODULE_ID} | Failed to roll back promoted Actor`, rollbackError);
      }
    }
    ui.notifications?.error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PromoteFailed"),
    );
    return false;
  }
}

export function confirmPromotion(token: Token, sourceDialog: Dialog): void {
  new Dialog({
    title: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PromoteConfirmTitle"),
    content: `<p>${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PromoteWarning")}</p>`,
    buttons: {
      confirm: {
        icon: '<i class="fas fa-user-graduate"></i>',
        label: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Ok"),
        callback: async () => {
          try { if (await promoteToken(token)) await sourceDialog.close(); }
          catch (error) { ui.notifications?.error(String(error)); }
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Cancel"),
      },
    },
    default: "cancel",
  }).render(true);
}
