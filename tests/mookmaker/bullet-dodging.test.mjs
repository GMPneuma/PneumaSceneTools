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
  i18n: { localize: key => strings[key] ?? key, format: (key,data={}) => (strings[key] ?? key).replace(/{(w+)}/g,(_match,name)=>String(data[name]??name)) },
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
    name: "Mook", img:"old-portrait.png", system: { stats: { ref: { value: 5 }, will: { value: 3 }, move: { value: 4 }, body: { value: 4 }, dex: { value: 6 } },
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
  const token = { actor, document: { name: "Mook", texture:{src:"old-token.png"}, displayName: 0, disposition: -1,
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
assert.equal(f.token.document.flags["pneuma-scenetools"].mookMakerSaved, true);
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
  assert.notEqual(f.token.document.flags?.["pneuma-scenetools"]?.mookMakerSaved, true);
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
f=fixture();await applyMookChanges({...changes(f),artwork:'selected.png'});assert.equal(f.actor.img,'selected.png');assert.equal(f.token.document.texture.src,'selected.png');
f=fixture();f.token.document.update=async()=>{throw Error('artwork token failure');};console.error=()=>{};
try {await assert.rejects(applyMookChanges({...changes(f),artwork:'selected.png'}),/artwork token failure/);assert.equal(f.actor.img,'old-portrait.png');assert.equal(f.token.document.texture.src,'old-token.png');} finally {console.error=originalError;}
game.packs = [];
await assert.rejects(prepareCoprocessor(fixture().actor), /Could not find/);

const {default: Handlebars}=await import("handlebars");
Handlebars.registerHelper("localize",key=>game.i18n.localize(key));
globalThis.renderTemplate=async (_path,data)=>Handlebars.compile(await readFile(new URL("../../src/templates/mook-maker.hbs",import.meta.url),"utf8"))(data);
const {readMookForm}=await import("../../dist/scripts/mookmaker/form-input.js");
const selected={name:"Updated",move:"4",hitpoints:"30",role:"none",level:"0",bodyArmor:"None",headArmor:"None",displayName:"30",tokenDisposition:"-1",combatNumber:"custom",customCombatNumber:"12",secondarySkills:"unchanged",tertiarySkills:"unchanged",bulletDodging:"unchanged"};
const form={find(selector){const name=selector.match(/name="([^"]+)"/)[1];return {val:()=>selected[name]}}};
const parsed=readMookForm(form,fixture().token,[],"Mook");assert.equal(parsed.newName,"Updated");assert.equal(parsed.move,4);assert.equal(parsed.hitPoints,30);
selected.move="invalid";assert.throws(()=>readMookForm(form,fixture().token,[],"Mook"));selected.move="4";
let dialog;
globalThis.Dialog = class { constructor(data) { dialog = data; } render() {} };
const { showMookMakerMenu } = await import("../../dist/scripts/mookmaker/mook-form.js");
settings.set('tokenArtworkCategories',[{kind:'mook',name:'Gangers',folder:'tokens/gangers'},{kind:'mook',name:'Corporate',folder:'tokens/corp'},{kind:'vehicle',name:'Cars',folder:'cars'}]);
await showMookMakerMenu(fixture().token);
assert.match(dialog.content, /data-action="purge-gear" disabled title=/);
assert(!dialog.content.includes("setNonCombatSkills"));
assert(dialog.content.includes('name="bulletDodging"'));
if (process.env.PNEUMA_PLAYWRIGHT_MODULE) {
  const { chromium } = await import(process.env.PNEUMA_PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ headless: true, ...(process.env.PNEUMA_BROWSER_CHANNEL?{channel:process.env.PNEUMA_BROWSER_CHANNEL}:{}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const css = await readFile(new URL("../../src/styles/mookmaker.css", import.meta.url), "utf8");
    await page.setContent(`<style>body{font:14px Arial} .window-app{display:flex;flex-direction:column;width:780px;max-height:calc(100vh - 32px)} .window-header{flex:0 0 30px} .window-content{display:flex;flex-direction:column;flex:1;min-height:0;padding:12px;background:#eee;overflow-y:auto} .dialog-content{flex:1;height:100%} .dialog-buttons{display:flex;flex:0 0 32px} input,select{box-sizing:border-box;max-width:100%} fieldset{min-width:0}</style><style>${css}</style><div class="window-app dialog pneuma-mook-maker-dialog"><header class="window-header">MookMaker</header><div class="window-content"><div class="dialog-content">${dialog.content}</div><div class="dialog-buttons"></div></div></div>`);
    const cancel = await page.locator('[data-action="cancel"]').boundingBox();
    const apply = await page.locator('[data-action="apply"]').boundingBox();
    assert(apply.x > cancel.x && apply.y === cancel.y, 'Apply is to the right of Cancel');
    const overflows = () => page.locator('.window-content').evaluate(node => node.scrollHeight > node.clientHeight + 1);
    assert.equal(await overflows(), false, 'content fits without vertical scrolling at normal height');
    await page.setViewportSize({width:1280,height:500});
    assert.equal(await overflows(), true, 'short windows retain scrolling');
    await page.locator('[data-action="apply"]').scrollIntoViewIfNeeded();
    assert(await page.locator('[data-action="apply"]').isVisible(), 'Apply remains reachable');
    await page.setViewportSize({width:1280,height:1000});
    assert.equal(await page.locator('.pneuma-mook-maker-section-stats input[name="bulletDodging"]').count(), 3);
    assert.deepEqual((await page.locator('input[name="bulletDodging"]').evaluateAll(nodes=>nodes.map(node=>node.parentElement.textContent.trim()))), ["Unchanged", "REF 8", "Reflex Co-Processor"]);
    assert.equal(await page.locator('.pneuma-mook-weapon-row [data-action="purge-gear"]').count(), 1);
    assert.equal(await page.locator('.pneuma-mook-maker-identity-row [data-action="promote"]').count(), 1);
    assert.equal(await page.locator('.pneuma-mook-maker-mook-fields > .pneuma-mook-name-row').count(), 1);
    const fields = await page.locator('.pneuma-mook-maker-mook-fields').boundingBox();
    const actions = await page.locator('.pneuma-mook-name-row').boundingBox();
    const preview=await page.locator('[data-artwork-preview]').boundingBox();assert(actions.x<preview.x,'utility actions sit at left');
    assert((await page.locator(".pneuma-mook-maker-form").boundingBox()).height < 700, "MookMaker keeps its compact layout");
    console.log(`Rendered form height: ${Math.round((await page.locator('.pneuma-mook-maker-form').boundingBox()).height)}px`);
    for (const name of ["secondarySkills", "tertiarySkills"]) {
      assert(await page.locator(`input[name="${name}"][value="unchanged"]`).isChecked());
      assert(await page.locator(`input[name="${name}"][value="set-custom"]`).isEnabled());
      assert(await page.locator(`input[name="${name}Target"]`).isEnabled());
    }
    assert.equal(await page.locator('[name="artworkCategory"] option').count(),4);
    assert.equal(await page.locator('.pneuma-mook-maker-form-header').count(),0);
    assert.equal(await page.locator('[name="combatNumber"][value="Civilian"]').count(),0);
    assert.equal(await page.locator('[name="combatNumber"]').last().getAttribute('value'),'No change');
    assert.deepEqual(await page.locator('[name="artworkCategory"] option').allTextContents(),['Keep Current','Manual','Gangers','Corporate']);
    for (const name of ['hitpoints','move','bodyArmor','headArmor']) {
      const tops=await page.locator('input[name="'+name+'"]').evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)));
      assert.equal(new Set(tops).size,1,name+' choices remain in one row');
    }
    await page.route('https://mook.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/') return route.fulfill({contentType:'text/html',body:'<body></body>'});
      if(path==='/art.png'||path==='/chosen.png'||path==='/manual.png') return route.fulfill({contentType:'image/png',body:await readFile(new URL('../../src/assets/tokens/mook-01.png',import.meta.url))});
      return route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../../dist'+path,import.meta.url))});
    });
    await page.goto('https://mook.test/');
    await page.evaluate(async({content,strings})=>{
      window.FormApplication=class {};
      window.VideoHelper={hasVideoExtension:path=>/\.(webm|mp4|m4v|ogg)$/i.test(path)};
      window.ImageHelper={hasImageExtension:path=>/\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(path)};
      const get=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
      const write=(o,data)=>{for(const [p,v] of Object.entries(data)){const keys=p.split('.');let t=o;for(const k of keys.slice(0,-1))t=t[k]??={};t[keys.at(-1)]=v;}};
      window.foundry={utils:{getProperty:get,deepClone:structuredClone}};
      window.game={packs:[],settings:{get:(_m,k)=>k==='tokenArtworkCategories'?[{kind:'mook',name:'Gangers',folder:'ganger'},{kind:'mook',name:'Corporate',folder:'corp'}]:k==='civilianCombatNumber'?6:undefined},i18n:{localize:k=>strings[k]??k,format:k=>strings[k]??k}};
      window.ui={notifications:{warn:m=>{window.warning=m;},error:m=>{window.failure=m;},info(){}}};
      window.pending=[];window.FilePicker=class{constructor(options){window.manualPicker=options;}render(){}static browse(){return new Promise(resolve=>pending.push(resolve));}};
      const items=[];items.get=id=>items.find(i=>i.id===id);
      const actor={name:'Mook',img:'/old.png',items,system:{stats:{move:{value:4},body:{value:4},will:{value:3},ref:{value:5}},derivedStats:{hp:{value:30,max:30}},roleInfo:{activeRole:''}}};
      window.token={actor,document:{name:'Mook',texture:{src:'/art.png'},displayName:0,disposition:-1,actorLink:false,delta:{update:async data=>write(actor,data)},update:async function(data){write(this,data);}}};
      const wrap=nodes=>{const api={0:nodes[0],find:s=>wrap(nodes.flatMap(n=>[...n.querySelectorAll(s)])),val(v){if(v===undefined)return nodes[0]?.value;nodes.forEach(n=>n.value=v);return api;},prop(k,v){if(v===undefined)return nodes[0]?.[k];nodes.forEach(n=>n[k]=v);return api;},on(type,fn){nodes.forEach(n=>n.addEventListener(type,fn));return api;},trigger(type){nodes.forEach(n=>n.dispatchEvent(new Event(type)));return api;}};return api;};
      window.renderTemplate=async()=>content;
      window.Dialog=class{constructor(data){this.data=data;}render(){this.element=document.createElement('div');this.element.className='window-content';this.element.innerHTML=this.data.content;document.body.append(this.element);this.data.render(wrap([this.element]));}close(){window.dialogClosed=true;this.element.remove();}};
      window.openMook=(await import('/scripts/mookmaker/mook-form.js')).showMookMakerMenu;
      await openMook(token);
    },{content:dialog.content,strings});
    await page.addStyleTag({content:'body{font:14px Arial}.window-content{width:756px;padding:12px;background:#eee}input,select{box-sizing:border-box;max-width:100%}fieldset{min-width:0}'+css});
    await page.locator('[name="artworkCategory"]').selectOption('0');
    await page.locator('[data-action="apply"]').click();assert.match(await page.evaluate(()=>warning),/Wait for category/);
    await page.locator('[name="artworkCategory"]').selectOption('1');
    await page.evaluate(()=>pending[1]({files:['/art.png']}));await page.waitForFunction(()=>!document.querySelector('[data-action="choose-artwork"]').disabled);
    await page.evaluate(()=>pending[0]({files:['/stale.png']}));
    assert.equal(await page.locator('[data-artwork-preview] img').getAttribute('src'),'/art.png');
    assert.equal(await page.evaluate(()=>token.actor.img),'/old.png','Preview is draft-only');
    await page.locator('[data-action="cancel"]').click();assert.equal(await page.evaluate(()=>token.actor.img),'/old.png');
    await page.evaluate(()=>openMook(token));await page.locator('[name="artworkCategory"]').selectOption('0');
    await page.evaluate(()=>pending[2]({files:['/art.png','/chosen.png']}));await page.waitForFunction(()=>!document.querySelector('[data-action="choose-artwork"]').disabled);
    await page.locator('[data-action="choose-artwork"]').click();assert.equal(await page.locator('.pneuma-mook-image-choices button').count(),2);await page.locator('.pneuma-mook-image-choices button').last().click();
    assert.equal(await page.locator('[data-artwork-preview] img').getAttribute('src'),'/chosen.png');
    assert.equal(await page.locator('[data-artwork-status]').textContent(),'');
    await mkdir(new URL("../output/", import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL("../output/bullet-dodging-form.png", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
    await page.locator('[name="artworkCategory"]').selectOption('manual');
    await page.locator('[data-action="apply"]').click();assert.match(await page.evaluate(()=>warning),/Choose an image/);
    await page.locator('[data-action="choose-artwork"]').click();assert.equal(await page.evaluate(()=>manualPicker.type),'imagevideo');
    await page.evaluate(()=>manualPicker.callback('/manual.png'));assert.equal(await page.locator('[data-artwork-preview] img').getAttribute('src'),'/manual.png');
    await page.locator('[data-action="apply"]').click();await page.waitForFunction(()=>token.actor.img==='/manual.png');
    assert.equal(await page.evaluate(()=>token.document.texture.src),'/manual.png');assert.equal(await page.evaluate(()=>window.failure),undefined);
  } finally { await browser.close(); }
}
console.log("Bullet-dodging checks passed: fixed choices, REF/skills ordering, unchanged skills, installation/reuse, missing/full foundation, rollback, and compact form layout.");
