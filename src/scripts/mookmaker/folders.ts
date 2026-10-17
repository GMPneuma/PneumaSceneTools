import {
  DEFAULT_MOOK_TEMPLATE_FLAG,
  FOLDER_NAMES,
  MODULE_ID,
  PROMOTED_FROM_MOOK_MAKER_FLAG,
} from "./constants.js";
import {ensureSceneToolsFolder, findSceneToolsFolder} from "../world-folders.js";

function getCharacterActorType(): string | undefined {
  const actorTypes = (game.documentTypes?.Actor ?? []) as readonly string[];
  return actorTypes.find((type) => type.toLowerCase() === "character");
}

type DefaultMookData = Record<string, unknown> & {
  items?: object[];
  prototypeToken?: Record<string, unknown>;
};

async function loadDefaultMookData(): Promise<DefaultMookData> {
  const response = await fetch(
    `modules/${MODULE_ID}/templates/default-mook.json`, {signal: AbortSignal.timeout(15000)},
  );
  if (!response.ok) {
    throw new Error(`Could not load the default mook (${response.status}).`);
  }

  return (await response.json()) as DefaultMookData;
}

async function ensureDefaultMookTemplate(templatesFolder: Folder): Promise<void> {
  const actorType = getCharacterActorType();
  if (!actorType) {
    throw new Error(
      'The active game system does not define the required "character" Actor type.',
    );
  }

  const existing = game.actors?.find(
    (actor) =>
      actor.type === actorType &&
      actor.folder?.id !== findSceneToolsFolder("Actor", FOLDER_NAMES.promoted)?.id &&
      foundry.utils.getProperty(actor, `flags.${MODULE_ID}.${PROMOTED_FROM_MOOK_MAKER_FLAG}`) !== true &&
      foundry.utils.getProperty(
        actor,
        `flags.${MODULE_ID}.${DEFAULT_MOOK_TEMPLATE_FLAG}`,
      ) === true,
  ) as Actor | undefined;

  if (existing) return;
  const template = await loadDefaultMookData();
  const items = template.items ?? [];
  const actorData = {
    ...template,
    name: game.i18n!.localize("PNEUMA_MOOK_MAKER.DefaultMook.Name"),
    type: actorType,
    folder: templatesFolder.id,
    prototypeToken: {
      ...template.prototypeToken,
      actorLink: false,
      name: game.i18n!.localize("PNEUMA_MOOK_MAKER.DefaultMook.Name"),
    },
    items: undefined,
    flags: {
      ...((template.flags as Record<string, unknown> | undefined) ?? {}),
      [MODULE_ID]: {
        [DEFAULT_MOOK_TEMPLATE_FLAG]: true,
      },
    },
  };

  const actorClass = Actor as unknown as {
    create(data: object): Promise<Actor | undefined>;
  };

  await actorClass.create({ ...actorData, items });
}

export async function ensureMookMakerFolders(): Promise<void> {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;

  const templatesFolder = await ensureSceneToolsFolder("Actor", FOLDER_NAMES.templates);
  await ensureSceneToolsFolder("Actor", FOLDER_NAMES.promoted);
  await ensureDefaultMookTemplate(templatesFolder);
}

export function isTemplateActor(actor: Actor | undefined): boolean {
  return Boolean(actor?.folder && actor.folder.id === findSceneToolsFolder("Actor", FOLDER_NAMES.templates)?.id);
}
