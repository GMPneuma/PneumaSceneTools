import {
  DEFAULT_MOOK_TEMPLATE_FLAG,
  DEFAULT_MOOK_TEMPLATE_VERSION,
  DEFAULT_MOOK_TEMPLATE_VERSION_FLAG,
  FOLDER_NAMES,
  FOLDER_KIND_FLAG,
  MODULE_ID,
} from "./constants.js";
import {ensureSceneToolsFolder} from "../world-folders.js";

type FolderKind = keyof typeof FOLDER_NAMES;

function findActorFolder(
  kind: FolderKind,
  name: string,
  parentId: string | null,
): Folder | undefined {
  return game.folders?.find(
    (folder) =>
      folder.type === "Actor" &&
      (folder.folder?.id ?? null) === parentId &&
      (foundry.utils.getProperty(folder, `flags.${MODULE_ID}.${FOLDER_KIND_FLAG}`) ===
        kind ||
        folder.name === name),
  );
}

async function getOrCreateActorFolder(
  kind: FolderKind,
  name: string,
  parentId: string | null,
): Promise<Folder | null> {
  const existing = findActorFolder(kind, name, parentId);
  if (existing) {
    if (
      foundry.utils.getProperty(existing, `flags.${MODULE_ID}.${FOLDER_KIND_FLAG}`) !==
      kind
    ) {
      await (existing as unknown as {
        setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
      }).setFlag(MODULE_ID, FOLDER_KIND_FLAG, kind);
    }
    return existing;
  }

  const folder = await ensureSceneToolsFolder("Actor", kind === "root" ? undefined : name);
  await (folder as unknown as {setFlag(scope: string, key: string, value: unknown): Promise<unknown>}).setFlag(MODULE_ID, FOLDER_KIND_FLAG, kind);
  return folder;
}

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
    `modules/${MODULE_ID}/templates/default-mook.json`,
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
      actor.folder?.id === templatesFolder.id &&
      actor.type === actorType &&
      foundry.utils.getProperty(
        actor,
        `flags.${MODULE_ID}.${DEFAULT_MOOK_TEMPLATE_FLAG}`,
      ) === true,
  ) as Actor | undefined;

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
        [DEFAULT_MOOK_TEMPLATE_VERSION_FLAG]: DEFAULT_MOOK_TEMPLATE_VERSION,
      },
    },
  };

  if (existing) {
    // Upgrade the blank template produced by early module builds without
    // overwriting a template the GM has already started customizing.
    if (existing.items.size === 0) {
      const updatableActor = existing as unknown as {
        update(data: object): Promise<unknown>;
      };
      await updatableActor.update(actorData);
      await existing.createEmbeddedDocuments("Item", items);
    }
    const currentVersion = Number(
      foundry.utils.getProperty(
        existing,
        `flags.${MODULE_ID}.${DEFAULT_MOOK_TEMPLATE_VERSION_FLAG}`,
      ) ?? 0,
    );
    if (currentVersion < DEFAULT_MOOK_TEMPLATE_VERSION) {
      const existingItemKeys = new Set(
        Array.from(
          existing.items,
          (item) => `${String(item.type)}:${item.name?.trim().toLocaleLowerCase() ?? ""}`,
        ),
      );
      const missingItems = items.filter((item) => {
        const data = item as { name?: unknown; type?: unknown };
        const key = `${String(data.type)}:${String(data.name ?? "").trim().toLocaleLowerCase()}`;
        return !existingItemKeys.has(key);
      });
      if (missingItems.length > 0) {
        await existing.createEmbeddedDocuments("Item", missingItems);
      }
      await (existing as unknown as { update(data: object): Promise<unknown> }).update({
        img: template.img,
        "prototypeToken.actorLink": false,
        "prototypeToken.randomImg": true,
        "prototypeToken.texture.src": foundry.utils.getProperty(
          actorData,
          "prototypeToken.texture.src",
        ),
        [`flags.${MODULE_ID}.${DEFAULT_MOOK_TEMPLATE_FLAG}`]: true,
        [`flags.${MODULE_ID}.${DEFAULT_MOOK_TEMPLATE_VERSION_FLAG}`]:
          DEFAULT_MOOK_TEMPLATE_VERSION,
      });
    }
    return;
  }

  const actorClass = Actor as unknown as {
    create(data: object): Promise<Actor | undefined>;
  };

  await actorClass.create({ ...actorData, items });
}

export async function ensureMookMakerFolders(): Promise<void> {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;

  try {
    const root = await getOrCreateActorFolder("root", FOLDER_NAMES.root, null);
    if (!root) return;

    const [templatesFolder] = await Promise.all([
      getOrCreateActorFolder("templates", FOLDER_NAMES.templates, root.id),
      getOrCreateActorFolder("promoted", FOLDER_NAMES.promoted, root.id),
    ]);
    if (templatesFolder) await ensureDefaultMookTemplate(templatesFolder);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to create actor folders`, error);
    ui.notifications?.error(
      game.i18n.localize("PNEUMA_MOOK_MAKER.Folders.CreationFailed"),
    );
  }
}

export function isTemplateActor(actor: Actor | undefined): boolean {
  if (!actor?.folder) return false;

  const templates = actor.folder;
  const root = templates.folder;

  return (
    templates.type === "Actor" &&
    (foundry.utils.getProperty(templates, `flags.${MODULE_ID}.${FOLDER_KIND_FLAG}`) ===
      "templates" || templates.name === FOLDER_NAMES.templates) &&
    root?.type === "Actor" &&
    (foundry.utils.getProperty(root, `flags.${MODULE_ID}.${FOLDER_KIND_FLAG}`) ===
      "root" || root.name === FOLDER_NAMES.root) &&
    root.folder === null
  );
}
