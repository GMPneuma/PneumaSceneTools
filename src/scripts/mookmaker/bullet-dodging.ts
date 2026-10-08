import { SUPPORTED_SYSTEM_ID } from "./constants.js";

export type BulletDodging = "unchanged" | "reflex" | "coprocessor";
const COPROCESSOR_ID = "0z0v50kDAgHvMquv";
const get = (document: object, path: string): unknown => foundry.utils.getProperty(document, path);

export function getBulletDodgingChoices(): BulletDodging[] {
  return ["unchanged", "reflex", "coprocessor"];
}

export function isReflexCoprocessor(item: Item): boolean {
  const localized = game.i18n!.localize("CPR.global.itemType.cyberware.reflexCoProcessor");
  return String(item.type) === "cyberware" && (
    item.name?.toLowerCase() === "reflex co-processor" || item.name === localized ||
    String(get(item, "flags.core.sourceId") ?? "").endsWith("." + COPROCESSOR_ID) ||
    String(get(item, "_stats.compendiumSource") ?? "").endsWith("." + COPROCESSOR_ID)
  );
}

interface CyberwarePack {
  documentName?: string;
  metadata?: { packageName?: string };
  getIndex(options: object): Promise<Iterable<{ _id?: string; name?: string; type?: string }>>;
  getDocument(id: string): Promise<Item | null>;
}

async function findSystemCyberware(name: string, sourceId?: string): Promise<Record<string, unknown>> {
  for (const pack of game.packs as unknown as Iterable<CyberwarePack>) {
    if (pack.documentName !== "Item" || pack.metadata?.packageName !== (game.system?.id ?? SUPPORTED_SYSTEM_ID)) continue;
    const index = await pack.getIndex({ fields: ["type"] });
    for (const row of index) {
      if (!row._id || row.type !== "cyberware" ||
        !(row._id === sourceId || row.name?.toLowerCase() === name.toLowerCase())) continue;
      const item = await pack.getDocument(row._id);
      if (!item || String(item.type) !== "cyberware") continue;
      const data = item.toObject() as unknown as Record<string, unknown>;
      for (const key of ["_id", "folder", "sort", "_stats"]) delete data[key];
      foundry.utils.setProperty(data, "flags.core.sourceId", item.uuid);
      return data;
    }
  }
  throw new Error(`Could not find ${name} in the Cyberpunk RED system compendiums.`);
}

export interface CoprocessorPlan {
  existingId?: string;
  source?: Record<string, unknown>;
  foundationId?: string;
  foundationSource?: Record<string, unknown>;
}

/** Resolve native data before any Apply writes. Never fabricate a cyberware item or a derived installed flag. */
export async function prepareCoprocessor(actor: Actor): Promise<CoprocessorPlan | undefined> {
  const matches = Array.from(actor.items).filter(isReflexCoprocessor);
  if (matches.some(item => get(item, "system.isInstalledInActor") === true)) return undefined;
  const existing = matches[0];
  const source = existing ? undefined : await findSystemCyberware("Reflex Co-Processor", COPROCESSOR_ID);
  const itemData = existing ?? source!;
  const foundations = Array.from(actor.items).filter(item => String(item.type) === "cyberware" &&
    get(item, "system.isFoundational") === true && get(item, "system.type") === get(itemData, "system.type"));
  const foundation = foundations.find(item => {
    const slots = item as unknown as { availableInstallSlots?: () => number };
    return typeof slots.availableInstallSlots === "function" &&
      slots.availableInstallSlots() >= Number(get(itemData, "system.size"));
  });
  if (foundations.length && !foundation) throw new Error("The mook's Neural Link has no room for a Reflex Co-Processor.");
  return {
    existingId: existing?.id ?? undefined, source, foundationId: foundation?.id ?? undefined,
    foundationSource: foundation ? undefined : await findSystemCyberware("Neural Link"),
  };
}

type NativeContainer = { installItems(items: Item[]): Promise<boolean> };
type Undo = () => Promise<unknown>;

/** Use CPR's container API (v0.92.4); no Humanity roll or charge for GM mook configuration. */
export async function installCoprocessor(token: Token, plan: CoprocessorPlan, rollback: Undo[]): Promise<void> {
  const actor = token.actor!;
  const actorInstall = foundry.utils.deepClone(get(actor, "system.installedItems"));
  const existingItems = Array.from(actor.items).filter(item => item.id === plan.existingId || item.id === plan.foundationId).map(item => ({
    _id: item.id,
    ...(get(item, "system.installedItems") !== undefined
      ? { "system.installedItems": foundry.utils.deepClone(get(item, "system.installedItems")) } : {}),
    ...(get(item, "system.equipped") !== undefined ? { "system.equipped": get(item, "system.equipped") } : {}),
  })).filter(row => Object.keys(row).length > 1);
  const createdIds: string[] = [];
  rollback.push(async () => {
    const current = token.actor!;
    const created = createdIds.filter(id => current.items.has(id));
    if (created.length) await current.deleteEmbeddedDocuments("Item", created);
    if (existingItems.length) await current.updateEmbeddedDocuments("Item", existingItems);
    await (current as unknown as { update(data: object): Promise<unknown> }).update({ "system.installedItems": actorInstall });
  });
  const create = async (source: Record<string, unknown>): Promise<Item> => {
    const id = foundry.utils.randomID();
    createdIds.push(id);
    // Create through the configured native Item class. CPRActor's convenience wrapper
    // opens an installation/Humanity wizard when a mook sheet is open; this workflow
    // installs explicitly below instead, independent of which sheets are open.
    const docs = await (CONFIG.Item.documentClass as unknown as {
      createDocuments(data: object[], options: object): Promise<Item[]>;
    }).createDocuments([{ ...source, _id: id }], { parent: token.actor, keepId: true });
    const doc = docs[0]?.id ? token.actor!.items.get(docs[0].id) : undefined;
    if (!doc) throw new Error("Could not create the required cyberware.");
    return doc;
  };
  let foundation = plan.foundationId ? token.actor!.items.get(plan.foundationId) : await create(plan.foundationSource!);
  if (!foundation) throw new Error("The selected Neural Link no longer exists.");
  if (get(foundation, "system.isInstalledInActor") !== true) {
    if (!await (token.actor as unknown as NativeContainer).installItems([foundation])) throw new Error("Could not install the Neural Link.");
  }
  const co = plan.existingId ? token.actor!.items.get(plan.existingId) : await create(plan.source!);
  if (!co) throw new Error("The selected Reflex Co-Processor no longer exists.");
  foundation = token.actor!.items.get(foundation.id!);
  if (get(co, "system.isInstalledInActor") !== true &&
    !await (foundation as unknown as NativeContainer).installItems([co])) throw new Error("Could not install the Reflex Co-Processor.");
  if (get(token.actor!.items.get(co.id!)!, "system.isInstalledInActor") !== true) {
    throw new Error("The system did not mark the Reflex Co-Processor as installed.");
  }
}
