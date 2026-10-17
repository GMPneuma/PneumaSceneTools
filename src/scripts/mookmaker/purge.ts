import {isNaturalWeapon} from "./weapons.js";
import {withMookOperation} from "./operations.js";
import {assertStoredChanges} from "../persistence.js";
import { MODULE_ID } from "./constants.js";
import {
  isPurgeConfirmationEnabled,
  isRetainWeaponAmmunitionEnabled,
} from "./skill-settings.js";

export function hasSavedMook(token: Token): boolean {
  return foundry.utils.getProperty(token.document, `flags.${MODULE_ID}.mookMakerSaved`) === true;
}

function requireSavedMook(token: Token): boolean {
  if (hasSavedMook(token)) return true;
  ui.notifications?.warn(game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.SaveBeforePurge"));
  return false;
}

const PURGEABLE_GEAR_TYPES = new Set([
  "armor", "clothing", "cyberware", "drug", "gear", "itemUpgrade", "weapon",
]);

function referencedItem(actor: Actor, reference: unknown): Item | undefined {
  if (typeof reference !== "string") return;
  const native = actor as Actor & {getOwnedItem?(id: string): Item | undefined};
  return (native.getOwnedItem ? native.getOwnedItem(reference) : actor.items.get(reference) ?? actor.items.find(item => item.uuid === reference))
    ?? (reference.includes(".Item.") ? actor.items.get(reference.split(".").at(-1)!) : undefined);
}

function getAmmoSignature(item: Item): string {
  const variety = String(
    foundry.utils.getProperty(item, "system.variety") ?? "",
  ).toLocaleLowerCase();
  const type = String(
    foundry.utils.getProperty(item, "system.type") ?? "",
  ).toLocaleLowerCase();
  return variety || type
    ? `${variety}:${type}`
    : `name:${(item.name ?? "").trim().toLocaleLowerCase()}`;
}

function getRetainedAmmoSignatures(actor: Actor): Set<string> {
  const signatures = new Set<string>();
  if (!isRetainWeaponAmmunitionEnabled()) return signatures;

  for (const weapon of actor.items) {
    if (String(weapon.type) !== "weapon") continue;
    const state = String(
      foundry.utils.getProperty(weapon, "system.equipped") ?? "",
    ).toLocaleLowerCase();
    if (state !== "equipped" && state !== "carried") continue;

    const ammoDataReference = String(
      foundry.utils.getProperty(weapon, "system.magazine.ammoData.uuid") ?? "",
    );
    let ammo = referencedItem(actor, ammoDataReference);
    if (!ammo) {
      const installedItems = foundry.utils.getProperty(
        weapon,
        "system.installedItems.list",
      );
      if (Array.isArray(installedItems)) {
        ammo = installedItems
          .filter((reference): reference is string => typeof reference === "string")
          .map((reference) => referencedItem(actor, reference))
          .find((item): item is Item => Boolean(item));
      }
    }
    if (ammo) signatures.add(getAmmoSignature(ammo));
  }
  return signatures;
}

function getPurgeableGear(actor: Actor): Item[] {
  const protectedIds = new Set<string>();
  const retainedAmmoSignatures = getRetainedAmmoSignatures(actor);
  const itemTypesById = new Map(
    Array.from(actor.items).flatMap((item) =>
      item.id ? [[item.id, String(item.type)] as const] : [],
    ),
  );
  const actorInstalledItems = foundry.utils.getProperty(
    actor,
    "system.installedItems.list",
  );
  if (Array.isArray(actorInstalledItems)) {
    for (const reference of actorInstalledItems) {
      const id = referencedItem(actor, reference)?.id;
      if (id) protectedIds.add(id);
    }
  }

  for (const item of actor.items) {
    if (!item.id) continue;
    const state = String(
      foundry.utils.getProperty(item, "system.equipped") ?? "",
    ).toLowerCase();
    if (state === "equipped" || state === "carried") protectedIds.add(item.id);

    const installedItems = foundry.utils.getProperty(
      item,
      "system.installedItems.list",
    );
    if (!Array.isArray(installedItems)) continue;
    const children = installedItems.flatMap(reference => {
      const id = referencedItem(actor, reference)?.id;
      return id && itemTypesById.get(id) !== "ammo" ? [id] : [];
    });
    if (children.length) protectedIds.add(item.id);
    for (const id of children) protectedIds.add(id);
  }

  return Array.from(actor.items).filter((item) => {
    if (!item.id) return false;
    if (String(item.type) === "ammo") {
      return !retainedAmmoSignatures.has(getAmmoSignature(item));
    }
    if (!PURGEABLE_GEAR_TYPES.has(String(item.type))) return false;
    if (isNaturalWeapon(item)) return false;
    if (protectedIds.has(item.id)) return false;
    const state = String(
      foundry.utils.getProperty(item, "system.equipped") ?? "",
    ).toLowerCase();
    return state !== "equipped" && state !== "carried";
  }) as Item[];
}

export async function purgeGear(token: Token): Promise<boolean> {
  return withMookOperation(token, () => purgeGearUnlocked(token));
}

async function purgeGearUnlocked(token: Token): Promise<boolean> {
  if (!requireSavedMook(token)) return false;
  const actor = token.actor;
  if (!actor || token.document.actorLink) {
    ui.notifications?.warn(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.UnlinkedOnly"),
    );
    return false;
  }
  const purgeableGear = getPurgeableGear(actor);
  const ids = purgeableGear.flatMap((item) =>
    item.id ? [item.id] : [],
  );
  if (ids.length === 0) {
    ui.notifications?.info(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.NothingToPurge"),
    );
    return true;
  }
  const unloadedWeaponRollbacks: {_id: string; "system.magazine.value": number; "system.installedItems.list": string[]}[] = [];
  const loadedAmmo = new Map<string, string>();
  try {
    const unloadedWeaponUpdates = purgeableGear.flatMap((item) => {
      if (!item.id || String(item.type) !== "weapon") return [];
      const installedItems = foundry.utils.getProperty(
        item,
        "system.installedItems.list",
      );
      const installedIds = Array.isArray(installedItems)
        ? installedItems.filter((id): id is string => typeof id === "string")
        : [];
      const retainedIds = installedIds.filter(reference => String(referencedItem(actor, reference)?.type) !== "ammo");
      const magazineValue = Number(
        foundry.utils.getProperty(item, "system.magazine.value") ?? 0,
      );
      if (magazineValue === 0 && retainedIds.length === installedIds.length) return [];
      const ammoReference = foundry.utils.getProperty(item, "system.magazine.ammoData.uuid");
      if (typeof ammoReference === "string" && ammoReference) loadedAmmo.set(item.id, ammoReference);
      unloadedWeaponRollbacks.push({
        _id: item.id,
        "system.magazine.value": magazineValue,
        "system.installedItems.list": installedIds,
      });
      return [{
        _id: item.id,
        "system.magazine.value": 0,
        "system.installedItems.list": retainedIds,
      }];
    });
    if (unloadedWeaponUpdates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", unloadedWeaponUpdates);
      for (const update of unloadedWeaponUpdates) assertStoredChanges(token.actor?.items.get(update._id), update);
    }
    await actor.deleteEmbeddedDocuments("Item", ids);
    if (!token.actor || ids.some(id => token.actor!.items.has(id))) throw new Error("Gear deletion was cancelled or only partially completed.");
    ui.notifications?.info(
      game.i18n!.format("PNEUMA_MOOK_MAKER.Form.GearPurged", { count: ids.length }),
    );
    return true;
  } catch (error) {
    if (unloadedWeaponRollbacks.length > 0) {
      try {
        const current = token.actor;
        // Never restore a magazine pointing at ammunition already removed by a partial delete.
        const restorable = unloadedWeaponRollbacks.filter(update => current?.items.has(update._id)
          && update["system.installedItems.list"].every(reference => referencedItem(current, reference))
          && (!loadedAmmo.has(update._id) || referencedItem(current, loadedAmmo.get(update._id))));
        if (current && restorable.length) {
          await current.updateEmbeddedDocuments("Item", restorable);
          for (const update of restorable) assertStoredChanges(token.actor?.items.get(update._id), update);
        }
      } catch (rollbackError) {
        console.error(`${MODULE_ID} | Failed to restore weapon ammunition after purge failure`, rollbackError);
      }
    }
    console.error(`${MODULE_ID} | Failed to purge mook gear`, error);
    ui.notifications?.error(
      `${game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PurgeFailed")} ${ids.filter(id => !token.actor?.items.has(id)).length} of ${ids.length} items removed. Check remaining gear before retrying.`,
    );
    return false;
  }
}

export async function confirmPurgeGear(token: Token): Promise<boolean> {
  if (!requireSavedMook(token)) return false;
  const actor = token.actor;
  if (!actor) return false;
  const count = getPurgeableGear(actor).length;
  if (count === 0) {
    ui.notifications?.info(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.NothingToPurge"),
    );
    return false;
  }
  if (isPurgeConfirmationEnabled()) {
    return new Promise<boolean>((resolve) => {
      let confirmed = false;
      new Dialog({
        title: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PurgeConfirmTitle"),
        content: `<p>${game.i18n!.format("PNEUMA_MOOK_MAKER.Form.PurgeWarning", { count })}</p>`,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-trash"></i>',
            label: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PurgeGear"),
            callback: async () => {
              confirmed = true;
              try { resolve(await purgeGear(token)); }
              catch (error) { ui.notifications?.error(String(error)); resolve(false); }
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Cancel"),
            callback: () => resolve(false),
          },
        },
        default: "cancel",
        close: () => { if (!confirmed) resolve(false); },
      }).render(true);
    });
  }
  return purgeGear(token);
}
