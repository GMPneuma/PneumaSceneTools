import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const getProperty = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const setProperty = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  let target = object;
  for (const key of keys) target = target[key] ??= {};
  target[last] = structuredClone(value);
};
const update = (object, data) => Object.entries(data).forEach(([key, value]) => setProperty(object, key, value));
let counter = 0;
globalThis.foundry = { utils: { getProperty, setProperty, deepClone: structuredClone, randomID: () => `created${++counter}` } };
globalThis.FormApplication = class {};
globalThis.CONFIG = { Item: { documentClass: {
  async createDocuments(data, options) { return options.parent.createEmbeddedDocuments("Item", data); },
} } };
const strings = JSON.parse(await readFile(new URL("../../src/lang/en.json", import.meta.url)));
const settings = new Map();
globalThis.game = {
  system: { id: "cyberpunk-red-core" }, modules: new Map(), packs: [], actors: [],
  i18n: { localize: key => strings[key] ?? key, format: key => strings[key] ?? key },
  settings: { get: (_module, key) => settings.get(key) },
};
globalThis.ui = { notifications: { error: message => { throw Error(message); } } };
class Items extends Map {
  [Symbol.iterator]() { return this.values(); }
  find(fn) { return [...this].find(fn); }
}
const { getBulletDodgingChoices, prepareCoprocessor, installCoprocessor } = await import("../../dist/scripts/mookmaker/bullet-dodging.js");
const { getSkillUpdates, getSkillTarget } = await import("../../dist/scripts/mookmaker/skills.js");
const { applyMookChanges } = await import("../../dist/scripts/mookmaker/apply-mook.js");
// Choices must not inspect installed modules or another module's settings.
game.modules = new Proxy({}, { get() { throw Error("Module integration removed"); } });
assert.deepEqual(getBulletDodgingChoices(), ["unchanged", "reflex", "coprocessor"]);

function fixture() {
  const events = [];
  const actor = {
    name: "Mook", system: { stats: { ref: { value: 5 }, will: { value: 3 }, move: { value: 4 }, body: { value: 4 }, dex: { value: 6 } },
      derivedStats: { hp: { value: 30, max: 30 } }, roleInfo: { activeRole: "" }, installedItems: { list: [], allowedTypes: ["cyberware"] } },
    items: new Items(),
    async update(data) { update(this, data); events.push(["actor", data]); return this; },
    async updateEmbeddedDocuments(_type, data) {
      events.push(["items", structuredClone(data)]);
      data.forEach(row => update(this.items.get(row._id), row));
      return data;
    },
    async createEmbeddedDocuments(_type, data) { return data.map(row => add(row)); },
    async deleteEmbeddedDocuments(_type, ids) {
      for (const id of ids) {
        this.items.delete(id);
        this.system.installedItems.list = this.system.installedItems.list.filter(value => value !== id);
        for (const item of this.items) if (item.system.installedItems) item.system.installedItems.list = item.system.installedItems.list.filter(value => value !== id);
      }
    },
    async installItems(items) { this.system.installedItems.list.push(...items.map(item => item.id)); return true; },
  };
  function installed(id, visited = new Set()) {
    if (visited.has(id)) return false;
    visited.add(id);
    return actor.system.installedItems.list.includes(id) || [...actor.items].some(item => item.system.installedItems?.list.includes(id) && installed(item.id, visited));
  }
  function add(data) {
    const item = structuredClone(data);
    item.id = data._id;
    item.availableInstallSlots = () => (item.system.installedItems?.slots ?? 0) - (item.system.installedItems?.list.length ?? 0);
    item.installItems = async items => {
      if (item.availableInstallSlots() < items.length) return false;
      item.system.installedItems.list.push(...items.map(row => row.id));
      return true;
    };
    Object.defineProperty(item.system, "isInstalledInActor", { get: () => installed(item.id), enumerable: false });
    actor.items.set(item.id, item);
    return item;
  }
  add({ _id: "handgun", name: "Handgun", type: "skill", system: { stat: "ref", level: 7 } });
  add({ _id: "evasion", name: "Evasion", type: "skill", system: { stat: "dex", level: 6 } });
  add({ _id: "concentration", name: "Concentration", type: "skill", system: { stat: "will", level: 3 } });
  const token = { actor, document: { name: "Mook", displayName: 0, disposition: -1,
    delta: { async update(data) { events.push(["delta", data]); update(actor, data); } },
    async update(data) { update(this, data); },
  } };
  return { actor, token, events, add };
}
let f = fixture();
assert.equal(getSkillTarget("unchanged", "garbage"), null);
assert.deepEqual(getSkillUpdates(f.actor, {}, 3, 8), []);
const skills = getSkillUpdates(f.actor, { 1: 12 }, 3, 8);
assert.deepEqual(skills, [{ _id: "handgun", "system.level": 4 }, { _id: "evasion", "system.level": 6 }]);
assert.equal(getSkillUpdates(f.actor, { 2: 10 }, 7, 8).find(row => row._id === "concentration")["system.level"], 3);
const changes = f => ({ token: f.token, actor: f.actor, initialName: "Mook", newName: "Mook", displayName: 0,
  tokenDisposition: -1, move: 4, hitPoints: 30, hitPointStats: { body: 4, will: 3 }, roleName: "", roleLevel: 0,
  armorUpdates: [], weaponUpdates: [], skillUpdates: getSkillUpdates(f.actor, { 1: 12 }, 3, 8), bulletDodging: "reflex" });
await applyMookChanges(changes(f));
assert.equal(f.actor.system.stats.ref.value, 8);
assert.equal(f.actor.items.get("handgun").system.level + f.actor.system.stats.ref.value, 12);
assert.equal(f.events[0][0], "delta");
assert.equal(f.actor.items.get("concentration").system.level, 3);
const originalError = console.error;
console.error = () => {};
try {
  f = fixture();
  f.token.document.update = async () => { throw Error("token write failed"); };
  await assert.rejects(applyMookChanges(changes(f)), /token write failed/);
  assert.equal(f.actor.system.stats.ref.value, 5);
  assert.equal(f.actor.items.get("handgun").system.level, 7);
  f = fixture();
  await assert.rejects(applyMookChanges({ ...changes(f), bulletDodging: "invalid" }), /Invalid bullet/);
  assert.equal(f.events.length, 0);
} finally { console.error = originalError; }

const neural = { _id: "neural", name: "Neural Link", type: "cyberware", system: { type: "neuralWare", isFoundational: true, size: 1, installedItems: { list: [], slots: 5 } } };
const co = { _id: "0z0v50kDAgHvMquv", name: "Reflex Co-Processor", type: "cyberware", system: { type: "neuralWare", isFoundational: false, size: 1 } };
game.packs = [{ documentName: "Item", metadata: { packageName: "cyberpunk-red-core" },
  async getIndex() { return [neural, co]; }, async getDocument(id) {
    const data = [neural, co].find(row => row._id === id);
    return { type: data.type, uuid: `Compendium.cyberpunk-red-core.cyberware.Item.${id}`, toObject: () => structuredClone(data) };
  } }];
f = fixture();
const undo = [];
await installCoprocessor(f.token, await prepareCoprocessor(f.actor), undo);
assert.equal([...f.actor.items].filter(item => item.type === "cyberware").length, 2);
assert.equal([...f.actor.items].find(item => item.name === co.name).system.isInstalledInActor, true);
assert.equal(await prepareCoprocessor(f.actor), undefined, "repeated Apply must not duplicate installed cyberware");
f.add({ _id: "unrelated", name: "Added elsewhere", type: "gear", system: {} });
await undo[0]();
assert.equal([...f.actor.items].filter(item => item.type === "cyberware").length, 0);
assert(f.actor.items.has("unrelated"), "rollback must retain unrelated new items");
assert.deepEqual(f.actor.system.installedItems.list, []);
f = fixture();
f.add(neural); f.add(co); await f.actor.installItems([f.actor.items.get("neural")]);
const reuse = await prepareCoprocessor(f.actor);
assert.equal(reuse.existingId, co._id); assert.equal(reuse.foundationId, neural._id);
await installCoprocessor(f.token, reuse, []);
assert.equal(f.actor.items.size, 5);
f = fixture(); f.add({ ...neural, system: { ...neural.system, installedItems: { list: [], slots: 0 } } });
await assert.rejects(prepareCoprocessor(f.actor), /no room/);
console.error = () => {};
try {
  f = fixture();
  f.token.document.update = async () => { throw Error("late Apply failure"); };
  await assert.rejects(applyMookChanges({ ...changes(f), bulletDodging: "coprocessor" }), /late Apply failure/);
  assert.equal(f.actor.items.size, 3, "late failure must remove newly installed cyberware");
  assert.deepEqual(f.actor.system.installedItems.list, []);
  assert.equal(f.actor.items.get("handgun").system.level, 7);
  f = fixture(); f.add(neural); f.add(co);
  await f.actor.installItems([f.actor.items.get("neural")]);
  f.token.document.update = async () => { throw Error("late Apply failure"); };
  await assert.rejects(applyMookChanges({ ...changes(f), bulletDodging: "coprocessor" }), /late Apply failure/);
  assert.equal(f.actor.items.size, 5, "rollback must preserve reused inventory");
  assert.deepEqual(f.actor.items.get("neural").system.installedItems.list, []);
  assert.deepEqual(f.actor.system.installedItems.list, ["neural"]);
} finally { console.error = originalError; }
game.packs = [];
await assert.rejects(prepareCoprocessor(fixture().actor), /Could not find/);

let dialog;
globalThis.Dialog = class { constructor(data) { dialog = data; } render() {} };
const { showMookMakerMenu } = await import("../../dist/scripts/mookmaker/mook-form.js");
await showMookMakerMenu(fixture().token);
assert(!dialog.content.includes("setNonCombatSkills"));
assert(dialog.content.includes('name="bulletDodging"'));
if (process.env.PNEUMA_PLAYWRIGHT_MODULE) {
  const { chromium } = await import(process.env.PNEUMA_PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const css = await readFile(new URL("../../src/styles/mookmaker.css", import.meta.url), "utf8");
    await page.setContent(`<style>body{font:14px Arial} .window-content{width:626px;padding:12px;background:#eee} input,select{box-sizing:border-box;max-width:100%} fieldset{min-width:0}</style><style>${css}</style><div class="window-content">${dialog.content}</div>`);
    assert.equal(await page.locator('.pneuma-mook-maker-section-stats select[name="bulletDodging"]').count(), 1);
    assert.deepEqual(await page.locator('select[name="bulletDodging"] option').allTextContents(), ["Unchanged", "REF 8", "Reflex Co-Processor"]);
    assert.equal(await page.locator('.pneuma-mook-maker-section-mook [data-action="purge-gear"]').count(), 1);
    assert.equal(await page.locator('.pneuma-mook-maker-section-mook [data-action="promote"]').count(), 1);
    assert.equal(await page.locator('.pneuma-mook-maker-form > .pneuma-mook-maker-secondary-actions').count(), 0);
    const fields = await page.locator('.pneuma-mook-maker-mook-fields').boundingBox();
    const actions = await page.locator('.pneuma-mook-maker-secondary-actions').boundingBox();
    assert(actions.x >= fields.x + fields.width, "action box sits beside the compact fields");
    console.log(`Rendered form height: ${Math.round((await page.locator('.pneuma-mook-maker-form').boundingBox()).height)}px`);
    for (const name of ["secondarySkills", "tertiarySkills"]) {
      assert(await page.locator(`input[name="${name}"][value="unchanged"]`).isChecked());
      assert(await page.locator(`input[name="${name}"][value="set-custom"]`).isEnabled());
      assert(await page.locator(`input[name="${name}Target"]`).isEnabled());
    }
    const bounds = await page.locator('select[name="bulletDodging"]').boundingBox();
    const parent = await page.locator('.pneuma-mook-maker-non-combat-pane').boundingBox();
    assert(bounds.x >= parent.x && bounds.x + bounds.width <= parent.x + parent.width + 1);
    await mkdir(new URL("../output/", import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL("../output/bullet-dodging-form.png", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
  } finally { await browser.close(); }
}
console.log("Bullet-dodging checks passed: fixed choices, REF/skills ordering, unchanged skills, installation/reuse, missing/full foundation, rollback, and compact form layout.");
