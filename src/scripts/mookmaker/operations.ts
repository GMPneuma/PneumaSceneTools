/** Serialize destructive actions on a token across this client's MookMaker windows. */
const busy = new Set<string>();
export async function withMookOperation<T>(token: Token, operation: () => Promise<T>): Promise<T> {
  const key = token.document.uuid;
  if (busy.has(key)) throw new Error("Another MookMaker operation is already running for this token.");
  if (token.document.actorLink || !token.actor) throw new Error("Choose an unlinked mook token.");
  busy.add(key);
  try { return await operation(); } finally { busy.delete(key); }
}
