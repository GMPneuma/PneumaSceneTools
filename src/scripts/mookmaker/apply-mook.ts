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
}

function getEmbeddedRollbackUpdates(actor: Actor, updates: object[]): object[] {
  return updates.flatMap((update) => {
    const id = String((update as { _id?: unknown })._id ?? "");
    const item = actor.items.get(id);
    if (!item) return [];
    const rollback: Record<string, unknown> = { _id: id };
    for (const key of Object.keys(update)) {
      if (key !== "_id") rollback[key] = foundry.utils.getProperty(item, key);
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
    const bulletDodging = changes.bulletDodging ?? "unchanged";
    if (!getBulletDodgingChoices().includes(bulletDodging)) throw new Error("Invalid bullet-dodging option.");
    const coprocessor = bulletDodging === "coprocessor" ? await prepareCoprocessor(actor) : undefined;
    if (bulletDodging === "reflex") {
      const originalRef = foundry.utils.getProperty(actor, "system.stats.ref.value");
      rollbackActions.push(() => updatableDelta.update({ "system.stats.ref.value": originalRef }));
      await updatableDelta.update({ "system.stats.ref.value": 8 });
    }
    if (coprocessor) await installCoprocessor(token, coprocessor, rollbackActions);
    const originalActiveRole = foundry.utils.getProperty(
      actor,
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
      await actor.updateEmbeddedDocuments("Item", embeddedUpdates);
      rollbackActions.push(async () => {
        const currentActor = token.actor;
        if (currentActor && rollbackUpdates.length > 0) {
          await currentActor.updateEmbeddedDocuments("Item", rollbackUpdates);
        }
      });
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
        }
        await updatableDelta.update({ "system.roleInfo.activeRole": originalActiveRole });
      });
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
    const deltaRollback: Record<string, unknown> = {
      "system.stats.move.value": foundry.utils.getProperty(actor, "system.stats.move.value"),
      "system.stats.body.value": foundry.utils.getProperty(actor, "system.stats.body.value"),
      "system.stats.will.value": foundry.utils.getProperty(actor, "system.stats.will.value"),
      "system.derivedStats.hp.max": foundry.utils.getProperty(actor, "system.derivedStats.hp.max"),
      "system.derivedStats.hp.value": foundry.utils.getProperty(actor, "system.derivedStats.hp.value"),
      "system.roleInfo.activeRole": originalActiveRole,
    };
    if (nameChanged) deltaRollback.name = actor.name;
    await updatableDelta.update(deltaChanges);
    rollbackActions.push(() => updatableDelta.update(deltaRollback));

    const oldTokenData = {
      name: token.document.name,
      displayName: token.document.displayName,
      disposition: token.document.disposition,
    };
    const updatableToken = token.document as unknown as {
      update(data: object): Promise<unknown>;
    };
    await updatableToken.update({
      ...(nameChanged ? { name: newName } : {}),
      displayName,
      disposition: tokenDisposition,
    });
    rollbackActions.push(() => updatableToken.update(oldTokenData));
    return nameChanged;
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply mook changes`, error);
    if (!(await rollbackApply(rollbackActions))) {
      console.error(`${MODULE_ID} | Apply rollback was incomplete`);
    }
    throw error;
  }
}
