import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function check(base = root) {
  const manifest = JSON.parse(await readFile(resolve(base, "module.json"), "utf8"));
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  assert.equal(manifest.id, "pneuma-scenetools");
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.compatibility.minimum, "12");
  assert.equal(manifest.compatibility.maximum, "12");
  assert.ok(manifest.relationships.systems.some(system => system.id === "cyberpunk-red-core"));
  assert.ok(manifest.relationships.requires.some(module => module.id === "lib-wrapper"));
  const featureAssets = ["templates/mook-maker.hbs","templates/scene-creator.hbs", "templates/default-mook.json", "templates/skill-classifications.hbs", "templates/scanner.hbs", "templates/ap-editor.hbs", "templates/type-manager.hbs", "assets/actor/default-mook.png",
    ...[1,2,3,4,5,6].map(n => `assets/tokens/mook-0${n}.png`), ...["computer","camera","turret","door","alarm","generic"].map(name => `assets/${name}.svg`)];
  for (const asset of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(lang => lang.path), ...featureAssets]) {
    const sourceAsset = asset.endsWith(".js") ? asset.replace(/\.js$/, ".ts") : asset;
    const path = base === root ? resolve(root, "src", sourceAsset) : resolve(base, asset);
    assert.ok(path.startsWith(resolve(base) + sep), `Asset outside module: ${asset}`);
    assert.ok((await stat(path)).isFile(), `Missing asset: ${asset}`);
    if (base !== root && asset.endsWith(".js")) execFileSync(process.execPath, ["--check", path], { stdio: "inherit" });
    if (asset.endsWith(".json")) {
      const text = await readFile(path, "utf8"); JSON.parse(text);
      assert.ok(!/modules\/(?:pneuma-mook-maker|pneuma-net-arch-scanner)\//.test(text), `Legacy module asset path in ${asset}`);
    }
  }
  console.log(`Validated ${manifest.id} v${manifest.version}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await check();

