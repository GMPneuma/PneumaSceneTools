export interface AvailableRole {
  key: string;
  name: string;
  source: Record<string, unknown>;
}

interface RoleIndexEntry {
  _id?: string;
  name?: string;
  type?: string;
}

interface RolePack {
  documentName?: string;
  metadata?: {
    packageName?: string;
    packageType?: string;
  };
  getIndex(options?: object): Promise<Iterable<RoleIndexEntry>>;
  getDocument(id: string): Promise<Item | null>;
}

function normalizeRoleName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export async function getAvailableSystemRoles(): Promise<AvailableRole[]> {
  const systemId = game.system?.id ?? SUPPORTED_SYSTEM_ID;
  const packs = Array.from(game.packs as unknown as Iterable<RolePack>).filter(
    (pack) =>
      pack.documentName === "Item" &&
      (pack.metadata?.packageName === systemId || pack.metadata?.packageType === "system"),
  );
  const rolesByName = new Map<string, AvailableRole>();

  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type"] });
    for (const entry of index) {
      if (entry.type !== "role" || !entry._id) continue;
      const role = await pack.getDocument(entry._id);
      if (!role || String(role.type) !== "role") continue;
      const name = role.name?.trim() ?? "";
      if (!name) continue;
      const normalizedName = normalizeRoleName(name);
      if (rolesByName.has(normalizedName)) continue;
      rolesByName.set(normalizedName, {
        key: normalizedName,
        name,
        source: role.toObject() as unknown as Record<string, unknown>,
      });
    }
  }

  return Array.from(rolesByName.values()).sort((left, right) =>
    left.name.localeCompare(right.name, game.i18n?.lang),
  );
}
import { SUPPORTED_SYSTEM_ID } from "./constants.js";

