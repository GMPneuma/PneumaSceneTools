import {MODULE_ID} from "./settings.js";

export const WORLD_FOLDERS = {
  root: "SceneTools",
  scenes: "Imported Scenes",
  mookTemplates: "MookMaker Templates",
  mookPromoted: "MookMaker Promoted Actors",
  netarchAPs: "NetArchAPs",
} as const;
export type WorldFolderType = "Actor" | "Scene" | "Item" | "JournalEntry" | "RollTable" | "Playlist";
const pending = new Map<string, Promise<Folder>>();
const legacyKinds: Record<string, string> = {root: "root", [WORLD_FOLDERS.mookTemplates]: "templates", [WORLD_FOLDERS.mookPromoted]: "promoted"};

export function findSceneToolsFolder(type: WorldFolderType, child?: string): Folder | undefined {
  const parent = child ? findSceneToolsFolder(type) : undefined;
  if (child && !parent) return undefined;
  const identity = child ?? "root";
  return game.folders?.find(folder => folder.type === type
    && (folder.folder?.id ?? null) === (parent?.id ?? null)
    && (foundry.utils.getProperty(folder, `flags.${MODULE_ID}.SceneToolsFolder`) === identity
      || (legacyKinds[identity] !== undefined && foundry.utils.getProperty(folder, `flags.${MODULE_ID}.FolderKind`) === legacyKinds[identity])
      || folder.name === (child ?? WORLD_FOLDERS.root)));
}

/** Foundry requires a separate same-named root for each document type. */
export async function ensureSceneToolsFolder(type: WorldFolderType, child?: string): Promise<Folder> {
  if (!game.user?.isGM) throw new Error("Only a GM can create SceneTools folders.");
  if (child?.includes("/") || child?.includes("\\")) throw new Error("Use a single child folder name.");
  const key = `${type}:${child ?? ""}`;
  const existingTask = pending.get(key);
  if (existingTask) return existingTask;
  const task = (async () => {
    const parent = child ? await ensureSceneToolsFolder(type) : undefined;
    const name = child ?? WORLD_FOLDERS.root;
    const existing = findSceneToolsFolder(type, child);
    if (existing) return existing;
    const created = await Folder.create({name, type, folder: parent?.id ?? null, sorting: "a",
      flags: {[MODULE_ID]: {SceneToolsFolder: child ?? "root"}}} as Folder.CreateData);
    if (!created) throw new Error(`Could not create SceneTools/${name}.`);
    return created;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
