import {game, CONST} from "./runtime.js";
import { isAP } from "./model.js";

export function isNetrunner(doc: any) {
  return Boolean(doc?.actor && !isAP(doc) && doc.actor.items?.some((item: any) =>
    item.type === "role" && String(item.name ?? "").trim().toLowerCase() === "netrunner"));
}

export function isPlayerOwned(doc: any) {
  return Boolean(doc?.actor && game.users.some((user: any) => !user.isGM
    && doc.actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)));
}

