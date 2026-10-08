import { isAP } from "./model.js";

export function isNetrunner(doc: TokenDocument | null | undefined) {
  return Boolean(doc?.actor && !isAP(doc) && doc.actor.items?.some((item) =>
    String(item.type) === "role" && String(item.name ?? "").trim().toLowerCase() === "netrunner"));
}

export function isPlayerOwned(doc: TokenDocument | null | undefined) {
  return Boolean(doc?.actor && game.users!.some((user) => !user.isGM
    && doc.actor!.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)));
}

