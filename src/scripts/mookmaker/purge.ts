import { MODULE_ID } from "./constants.js";
import {
  isPurgeAmmunitionEnabled,
  isPurgeConfirmationEnabled,
  isRetainWeaponAmmunitionEnabled,
} from "./skill-settings.js";

const PURGEABLE_GEAR_TYPES = new Set([
  "armor", "clothing", "cyberware", "drug", "gear", "itemUpgrade", "weapon",
]);

function isProtectedNaturalWeapon(item: Item): boolean {
  if (String(item.type) !== "weapon") return false;
  const name = (item.name ?? "").trim().toLocaleLowerCase();
  return name.includes("unarmed") || name.includes("martial arts");
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

  const ammoByReference = new Map<string, Item>();
  for (const item of actor.items) {
    if (String(item.type) !== "ammo") continue;
    if (item.id) ammoByReference.set(item.id, item);
    ammoByReference.set(item.uuid, item);
  }

  for (const weapon of actor.items) {
    if (String(weapon.type) !== "weapon") continue;
    const state = String(
      foundry.utils.getProperty(weapon, "system.equipped") ?? "",
    ).toLocaleLowerCase();
    if (state !== "equipped" && state !== "carried") continue;

    const ammoDataReference = String(
      foundry.utils.getProperty(weapon, "system.magazine.ammoData.uuid") ?? "",
    );
    let ammo = ammoByReference.get(ammoDataReference);
    if (!ammo) {
      const installedItems = foundry.utils.getProperty(
        weapon,
        "system.installedItems.list",
      );
      if (Array.isArray(installedItems)) {
        ammo = installedItems
          .filter((reference): reference is string => typeof reference === "string")
          .map((reference) => ammoByReference.get(reference))
          .find((item): item is Item => Boolean(item));
      }
    }
    if (ammo) signatures.add(getAmmoSignature(ammo));
  }
  return signatures;
}

function getPurgeableGear(actor: Actor): Item[] {
  const protectedIds = new Set<string>();
  const purgeAmmunition = isPurgeAmmunitionEnabled();
  const retainedAmmoSignatures = getRetainedAmmoSignatures(actor);
  const childrenByParent = new Map<string, string[]>();
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
    for (const id of actorInstalledItems) {
      if (typeof id === "string") protectedIds.add(id);
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
    const children = installedItems.filter(
      (id): id is string =>
        typeof id === "string" && itemTypesById.get(id) !== "ammo",
    );
    childrenByParent.set(item.id, children);
    for (const id of children) protectedIds.add(id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [parentId, childIds] of childrenByParent) {
      if (protectedIds.has(parentId)) {
        for (const childId of childIds) {
          if (!protectedIds.has(childId)) {
            protectedIds.add(childId);
            changed = true;
          }
        }
      }
      if (
        childIds.some((childId) => protectedIds.has(childId)) &&
        !protectedIds.has(parentId)
      ) {
        protectedIds.add(parentId);
        changed = true;
      }
    }
  }

  return Array.from(actor.items).filter((item) => {
    if (!item.id) return false;
    if (String(item.type) === "ammo") {
      return purgeAmmunition && !retainedAmmoSignatures.has(getAmmoSignature(item));
    }
    if (!PURGEABLE_GEAR_TYPES.has(String(item.type))) return false;
    if (isProtectedNaturalWeapon(item)) return false;
    if (protectedIds.has(item.id)) return false;
    const state = String(
      foundry.utils.getProperty(item, "system.equipped") ?? "",
    ).toLowerCase();
    return state !== "equipped" && state !== "carried";
  }) as Item[];
}

async function purgeGear(token: Token): Promise<boolean> {
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
  const unloadedWeaponRollbacks: object[] = [];
  try {
    const itemTypesById = new Map(
      Array.from(actor.items).flatMap((item) =>
        item.id ? [[item.id, String(item.type)] as const] : [],
      ),
    );
    const unloadedWeaponUpdates = purgeableGear.flatMap((item) => {
      if (!item.id || String(item.type) !== "weapon") return [];
      const installedItems = foundry.utils.getProperty(
        item,
        "system.installedItems.list",
      );
      const installedIds = Array.isArray(installedItems)
        ? installedItems.filter((id): id is string => typeof id === "string")
        : [];
      const retainedIds = installedIds.filter((id) => itemTypesById.get(id) !== "ammo");
      const magazineValue = Number(
        foundry.utils.getProperty(item, "system.magazine.value") ?? 0,
      );
      if (magazineValue === 0 && retainedIds.length === installedIds.length) return [];
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
    }
    await actor.deleteEmbeddedDocuments("Item", ids);
    ui.notifications?.info(
      game.i18n!.format("PNEUMA_MOOK_MAKER.Form.GearPurged", { count: ids.length }),
    );
    return true;
  } catch (error) {
    if (unloadedWeaponRollbacks.length > 0) {
      try {
        await actor.updateEmbeddedDocuments("Item", unloadedWeaponRollbacks);
      } catch (rollbackError) {
        console.error(`${MODULE_ID} | Failed to restore weapon ammunition after purge failure`, rollbackError);
      }
    }
    console.error(`${MODULE_ID} | Failed to purge mook gear`, error);
    ui.notifications?.error(
      game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PurgeFailed"),
    );
    return false;
  }
}

export async function confirmPurgeGear(token: Token): Promise<boolean> {
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
      new Dialog({
        title: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PurgeConfirmTitle"),
        content: `<p>${game.i18n!.format("PNEUMA_MOOK_MAKER.Form.PurgeWarning", { count })}</p>`,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-trash"></i>',
            label: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.PurgeGear"),
            callback: async () => { resolve(await purgeGear(token)); },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.Cancel"),
            callback: () => resolve(false),
          },
        },
        default: "cancel",
        close: () => resolve(false),
      }).render(true);
    });
  }
  return purgeGear(token);
}
