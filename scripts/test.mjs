import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {execFileSync} from "node:child_process";
import { check, root } from "./check.mjs";

await check(resolve(root, "dist"));
const callbacks = new Map();
const registeredHooks = new Map();
const registeredSettings = new Map();
globalThis.game = { settings: { register: (_id, key, value) => registeredSettings.set(key, value) } };
globalThis.Application = class {};
globalThis.FormApplication = class {};
globalThis.Hooks = { on: (name, callback) => registeredHooks.set(name, callback), once: (event, callback) => {
  assert.ok(!callbacks.has(event), `Duplicate startup hook: ${event}`);
  callbacks.set(event, callback);
} };
try {
  const module = await import(pathToFileURL(resolve(root, "dist/scripts/main.js")).href);
  assert.equal(module.MODULE_ID, "pneuma-scenetools");
  assert.deepEqual([...callbacks.keys()], ["init", "ready"]);
  for (const callback of callbacks.values()) await callback();
  assert.ok(registeredHooks.has("renderSceneDirectory"));
  assert.equal(registeredSettings.size, 3);
} finally {
  delete globalThis.Hooks;
  delete globalThis.game;
}
console.log("Module startup smoke check passed.");


await import("./scene-tests.mjs");
await import("./matching-tests.mjs");
execFileSync(process.execPath, ["--test", "tests/netarch/*.test.mjs", "tests/world-folders.test.mjs"], {cwd: root, stdio: "inherit"});
execFileSync(process.execPath, ["tests/mookmaker/bullet-dodging.test.mjs"], {cwd: root, stdio: "inherit"});
