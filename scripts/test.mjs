import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {execFileSync} from "node:child_process";
import { check, root } from "./check.mjs";

await check(resolve(root, "dist"));
globalThis.FormApplication = class {};
await import("./scene-tests.mjs");
await import("./matching-tests.mjs");
execFileSync(process.execPath, ["--test", "tests/netarch/*.test.mjs", "tests/world-folders.test.mjs", "tests/mookmaker/workflows.test.mjs", "tests/io.test.mjs"], {cwd: root, stdio: "inherit"});
execFileSync(process.execPath, ["tests/mookmaker/bullet-dodging.test.mjs"], {cwd: root, stdio: "inherit"});
