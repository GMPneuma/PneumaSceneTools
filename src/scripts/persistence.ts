/** Check source data: prepared Actor values may include temporary Active Effects. */
export function assertStoredChanges(document: object | null | undefined, changes: object): void {
  const source = document && ("toObject" in document && typeof document.toObject === "function" ? document.toObject() : document);
  for (const [path, value] of Object.entries(changes)) {
    if (path === "_id") continue;
    if (!source || JSON.stringify(foundry.utils.getProperty(source, path)) !== JSON.stringify(value)) {
      throw new Error(`Foundry did not save ${path}. The operation was cancelled or only partially saved.`);
    }
  }
}
