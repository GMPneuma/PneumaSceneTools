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
    const existing = game.folders?.find(folder => folder.type === type && folder.name === name
      && (typeof folder.folder === "string" ? folder.folder : folder.folder?.id ?? null) === (parent?.id ?? null));
    if (existing) return existing;
    const created = await Folder.create({name, type, folder: parent?.id ?? null, sorting: "a",
      flags: {[MODULE_ID]: {SceneToolsFolder: child ?? "root"}}} as Folder.CreateData);
    if (!created) throw new Error(`Could not create SceneTools/${name}.`);
    return created;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
