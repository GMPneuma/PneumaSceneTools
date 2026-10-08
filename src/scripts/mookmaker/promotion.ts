import {
  CREATED_BY_MOOK_MAKER_FLAG,
  FOLDER_KIND_FLAG,
  FOLDER_NAMES,
  MODULE_ID,
  PROMOTED_FROM_MOOK_MAKER_FLAG,
} from "./constants.js";

function findPromotedFolder(): Folder | undefined {
  return game.folders?.find(
    (folder) =>
      folder.type === "Actor" &&
      (foundry.utils.getProperty(folder, `flags.${MODULE_ID}.${FOLDER_KIND_FLAG}`) ===
        "promoted" || folder.name === FOLDER_NAMES.promoted) &&
      folder.folder?.type === "Actor" &&
      (foundry.utils.getProperty(
        folder.folder,
        `flags.${MODULE_ID}.${FOLDER_KIND_FLAG}`,
      ) === "root" || folder.folder.name === FOLDER_NAMES.root) &&
      folder.folder.folder === null,
  );
}

async function promoteToken(token: Token): Promise<boolean> {
  const actor = token.actor;
  if (!actor || token.document.actorLink) {
    ui.notifications?.warn(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.UnlinkedOnly"),
    );
    return false;
  }
  const folder = findPromotedFolder();
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
          if (await promoteToken(token)) sourceDialog.close();
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
