const ARMOR_NAMES: Record<string, string> = {
  Leathers: "Leathers",
  Kevlar: "Kevlar",
  LightArmorJack: "Light Armorjack",
  MedArmorJack: "Medium Armorjack",
};

function normalizeArmorName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getArmorUpdates(
  actor: Actor,
  bodySelection: string,
  headSelection: string,
): { updates: object[]; missingArmor?: string } {
  const managedArmor = Array.from(actor.items).filter(
    (item) =>
      String(item.type) === "armor" &&
      !foundry.utils.getProperty(item, "system.isShield") &&
      (foundry.utils.getProperty(item, "system.isBodyLocation") === true ||
        foundry.utils.getProperty(item, "system.isHeadLocation") === true),
  );
  const equippedIds = new Set<string>();

  for (const [selection, location] of [
    [bodySelection, "Body"],
    [headSelection, "Head"],
  ] as const) {
    if (selection === "None") continue;
    const armorBaseName = ARMOR_NAMES[selection];
    if (!armorBaseName) return { updates: [], missingArmor: selection };

    const expectedName = normalizeArmorName(`${armorBaseName} (${location})`);
    const armor = managedArmor.find(
      (item) => normalizeArmorName(item.name ?? "") === expectedName,
    );
    if (!armor?.id) {
      return { updates: [], missingArmor: `${armorBaseName} (${location})` };
    }
    equippedIds.add(armor.id);
  }

  return {
    updates: managedArmor.map((armor) => ({
      _id: armor.id,
      "system.equipped":
        armor.id && equippedIds.has(armor.id) ? "equipped" : "owned",
    })),
  };
}

export function getCurrentArmorSelections(
  actor: Actor,
): { body: string; head: string } {
  const selections = { body: "None", head: "None" };
  for (const item of actor.items) {
    if (
      String(item.type) !== "armor" ||
      String(foundry.utils.getProperty(item, "system.equipped")) !== "equipped"
    ) continue;
    const normalizedName = normalizeArmorName(item.name ?? "");
    for (const [selection, armorName] of Object.entries(ARMOR_NAMES)) {
      const base = normalizeArmorName(armorName);
      if (normalizedName === `${base}body`) selections.body = selection;
      if (normalizedName === `${base}head`) selections.head = selection;
    }
  }
  return selections;
}
