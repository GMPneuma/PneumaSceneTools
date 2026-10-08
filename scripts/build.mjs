import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { cp, lstat, mkdir, realpath, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { check, root } from "./check.mjs";

await check();
const tsc = resolve(root, "node_modules/typescript/bin/tsc");
execFileSync(process.execPath, [tsc, "--noEmit"], { cwd: root, stdio: "inherit" });
const output = resolve(root, "dist");
const expectedOutput = resolve(await realpath(root), "dist");
let existing;
try { existing = await lstat(output); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (existing) {
  assert.ok(!existing.isSymbolicLink(), "Refusing to clean a linked output directory.");
  assert.equal(await realpath(output), expectedOutput, "Output must remain inside this project's dist directory.");
  await rm(output, { recursive: true });
}
await mkdir(resolve(output, "scripts"), { recursive: true });
for (const file of ["module.json", "styles", "lang", "templates", "assets", "docs", "README.md", "CHANGELOG.md", "IMPLEMENTED_FEATURES.md", "BACKLOG.md"]) {
  const source = ["styles", "lang", "templates", "assets"].includes(file) ? resolve(root, "src", file) : resolve(root, file);
  await cp(source, resolve(output, file), { recursive: true, filter: (path) => !path.endsWith("-preview.png") && !path.endsWith(".gitkeep") });
}
execFileSync(process.execPath, [tsc], { cwd: root, stdio: "inherit" });
await check(output);
console.log(`Built ${output}`);

