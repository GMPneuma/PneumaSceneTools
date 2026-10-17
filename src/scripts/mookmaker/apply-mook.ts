import {withMookOperation} from "./operations.js";
import {assertStoredChanges} from "../persistence.js";
import { MODULE_ID } from "./constants.js";
import type { HitPointStats } from "./stats.js";
import { getBulletDodgingChoices, installCoprocessor, prepareCoprocessor, type BulletDodging } from "./bullet-dodging.js";

type RollbackAction = () => Promise<unknown>;

export interface ApplyMookChanges {
  token: Token;
  actor: Actor;
  initialName: string;
  newName: string;
  displayName: number;
  tokenDisposition: number;
  move: number;
  hitPoints: number;
  hitPointStats: HitPointStats;
  roleName: string;
  roleLevel: number;
  roleSource?: Record<string, unknown>;
  armorUpdates: object[];
  weaponUpdates: object[];
  skillUpdates: object[];
  bulletDodging?: BulletDodging;
  artwork?: string;
}

function getEmbeddedRollbackUpdates(actor: Actor, updates: object[]): object[] {
  return updates.flatMap((update) => {
    const id = String((update as { _id?: unknown })._id ?? "");
    const item = actor.items.get(id);
    if (!item) return [];
    const rollback: Record<string, unknown> = { _id: id };
    for (const key of Object.keys(update)) {
      if (key !== "_id") rollback[key] = foundry.utils.deepClone(foundry.utils.getProperty(item.toObject?.() ?? item, key));
    }
    return [rollback];
  });
}

async function rollbackApply(actions: RollbackAction[]): Promise<boolean> {
  let restored = true;
  for (const action of actions.reverse()) {
    try {
      await action();
    } catch (error) {
      restored = false;
      console.error(`${MODULE_ID} | Failed to roll back an Apply operation`, error);
    }
  }
  return restored;
}

export async function applyMookChanges(changes: ApplyMookChanges): Promise<boolean> {
  return withMookOperation(changes.token, () => applyMookChangesUnlocked(changes));
}

async function applyMookChangesUnlocked(changes: ApplyMookChanges): Promise<boolean> {
  const {
    token, actor, initialName, newName, displayName, tokenDisposition,
    move, hitPoints, hitPointStats,
    roleName, roleLevel, roleSource, armorUpdates, weaponUpdates, skillUpdates,
  } = changes;
  const rollbackActions: RollbackAction[] = [];
  try {
    const nameChanged = newName !== initialName;
    const delta = token.document.delta;
    if (!delta) throw new Error("The unlinked token has no ActorDelta.");
    const updatableDelta = delta as unknown as {
      update(data: object): Promise<unknown>;
    };
    const updateDelta = async (data: object) => {
      await updatableDelta.update(data);
      assertStoredChanges(token.actor, data);
    };
    const bulletDodging = changes.bulletDodging ?? "unchanged";
    if (!getBulletDodgingChoices().includes(bulletDodging)) throw new Error("Invalid bullet-dodging option.");
    const coprocessor = bulletDodging === "coprocessor" ? await prepareCoprocessor(actor) : undefined;
    if (bulletDodging === "reflex") {
      const originalRef = foundry.utils.getProperty(actor.toObject?.() ?? actor, "system.stats.ref.value");
      rollbackActions.push(() => updateDelta({ "system.stats.ref.value": originalRef }));
      await updateDelta({ "system.stats.ref.value": 8 });
    }
    if (coprocessor) await installCoprocessor(token, coprocessor, rollbackActions);
    const originalActiveRole = foundry.utils.getProperty(
      actor.toObject?.() ?? actor,
      "system.roleInfo.activeRole",
    );
    const existingRole = roleName
      ? actor.items.find(
          (item) =>
            String(item.type) === "role" &&
            item.name?.toLowerCase() === roleName.toLowerCase(),
        )
      : undefined;
    const roleUpdates = existingRole?.id
      ? [{ _id: existingRole.id, "system.rank": roleLevel }]
      : [];
    const embeddedUpdates = [
      ...armorUpdates,
      ...weaponUpdates,
      ...skillUpdates,
      ...roleUpdates,
    ];
    if (embeddedUpdates.length > 0) {
      const rollbackUpdates = getEmbeddedRollbackUpdates(actor, embeddedUpdates);
      rollbackActions.push(async () => {
        const currentActor = token.actor;
        if (currentActor && rollbackUpdates.length > 0) {
          await currentActor.updateEmbeddedDocuments("Item", rollbackUpdates);
          for (const update of rollbackUpdates) assertStoredChanges(token.actor?.items.get(String((update as {_id:string})._id)), update);
        }
      });
      await actor.updateEmbeddedDocuments("Item", embeddedUpdates);
      for (const update of embeddedUpdates) assertStoredChanges(token.actor?.items.get(String((update as {_id:string})._id)), update);
    }

    if (roleName && !existingRole) {
      if (!roleSource) throw new Error(`Could not find the ${roleName} role in the system.`);
      const roleData = foundry.utils.deepClone(roleSource) as Record<string, unknown>;
      delete roleData._id;
      delete roleData.folder;
      delete roleData.sort;
      delete roleData._stats;
      const roleSystem = {
        ...((roleData.system as Record<string, unknown> | undefined) ?? {}),
        rank: roleLevel,
      };
      const createdRoles = await (actor as unknown as {
        createEmbeddedDocuments(type: string, data: object[]): Promise<Item[] | undefined>;
      }).createEmbeddedDocuments("Item", [{
        ...roleData,
        name: roleName,
        type: "role",
        system: roleSystem,
      }]);
      const createdRoleId = createdRoles?.[0]?.id;
      if (!createdRoleId) throw new Error(`Could not create the ${roleName} role.`);
      rollbackActions.push(async () => {
        const currentActor = token.actor;
        if (currentActor) {
          await currentActor.deleteEmbeddedDocuments("Item", [createdRoleId]);
          if (token.actor?.items.has(createdRoleId)) throw new Error("The created role could not be removed during rollback.");
        }
        await updateDelta({ "system.roleInfo.activeRole": originalActiveRole });
      });
      assertStoredChanges(token.actor?.items.get(createdRoleId), {"system.rank":roleLevel});
    }

    const deltaChanges: Record<string, unknown> = {
      "system.stats.move.value": move,
      "system.stats.body.value": hitPointStats.body,
      "system.stats.will.value": hitPointStats.will,
      "system.derivedStats.hp.max": hitPoints,
      "system.derivedStats.hp.value": hitPoints,
      "system.roleInfo.activeRole": roleName,
    };
    if (nameChanged) deltaChanges.name = newName;
    if (changes.artwork) deltaChanges.img = changes.artwork;
    const actorSource = actor.toObject?.() ?? actor;
    const deltaRollback: Record<string, unknown> = {
      "system.stats.move.value": foundry.utils.getProperty(actorSource, "system.stats.move.value"),
      "system.stats.body.value": foundry.utils.getProperty(actorSource, "system.stats.body.value"),
      "system.stats.will.value": foundry.utils.getProperty(actorSource, "system.stats.will.value"),
      "system.derivedStats.hp.max": foundry.utils.getProperty(actorSource, "system.derivedStats.hp.max"),
      "system.derivedStats.hp.value": foundry.utils.getProperty(actorSource, "system.derivedStats.hp.value"),
      "system.roleInfo.activeRole": originalActiveRole,
    };
    if (nameChanged) deltaRollback.name = actor.name;
    if (changes.artwork) deltaRollback.img = actor.img;
    rollbackActions.push(() => updateDelta(deltaRollback));
    await updateDelta(deltaChanges);

    const savedPath = `flags.${MODULE_ID}.mookMakerSaved`;
    const oldTokenData = {
      [savedPath]: foundry.utils.getProperty(token.document, savedPath) === true,
      name: token.document.name,
      displayName: token.document.displayName,
      disposition: token.document.disposition,
      ...(changes.artwork ? {"texture.src": token.document.texture.src} : {}),
    };
    const updatableToken = token.document as unknown as {
      update(data: object): Promise<unknown>;
    };
    const tokenChanges = {
      [savedPath]: true,
      ...(nameChanged ? { name: newName } : {}),
      displayName,
      disposition: tokenDisposition,
      ...(changes.artwork ? {"texture.src": changes.artwork} : {}),
    };
    rollbackActions.push(async () => {await updatableToken.update(oldTokenData);assertStoredChanges(token.document, oldTokenData);});
    await updatableToken.update(tokenChanges);
    assertStoredChanges(token.document, tokenChanges);
    return nameChanged;
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply mook changes`, error);
    if (!(await rollbackApply(rollbackActions))) {
      console.error(`${MODULE_ID} | Apply rollback was incomplete`);
      throw new Error(`${String(error)} Some changes could not be restored. Check the Actor and token before retrying.`);
    }
    throw error;
  }
}
