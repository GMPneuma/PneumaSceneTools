export interface WeaponChoice {
  id: string;
  name: string;
}

export interface WeaponInventoryChoices {
  weapons: WeaponChoice[];
  selectedWeaponIds: string[];
}

function isNaturalWeapon(item: Item): boolean {
  const name = (item.name ?? "").trim().toLocaleLowerCase();
  return name.includes("unarmed") || name.includes("martial arts");
}

export function getWeaponInventoryChoices(actor: Actor): WeaponInventoryChoices {
  const weapons = Array.from(actor.items)
    .filter(
      (item) => String(item.type) === "weapon" && Boolean(item.id) && !isNaturalWeapon(item),
    )
    .map((item) => ({ id: item.id!, name: item.name ?? "" }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const selectedWeaponIds = Array.from(actor.items)
    .filter((item) => {
      if (String(item.type) !== "weapon" || !item.id || isNaturalWeapon(item)) return false;
      const state = String(foundry.utils.getProperty(item, "system.equipped") ?? "")
        .toLocaleLowerCase();
      return state === "equipped" || state === "carried";
    })
    .flatMap((item) => item.id ? [item.id] : [])
    .slice(0, 2);

  return { weapons, selectedWeaponIds };
}

export function getWeaponUpdates(
  actor: Actor,
  selectedWeaponIds: readonly string[],
): object[] {
  const selectedIds = new Set(selectedWeaponIds.filter(Boolean));
  return Array.from(actor.items).flatMap((item) => {
    if (String(item.type) !== "weapon" || !item.id || isNaturalWeapon(item)) return [];
    return [{
      _id: item.id,
      "system.equipped": selectedIds.has(item.id) ? "equipped" : "owned",
    }];
  });
}
