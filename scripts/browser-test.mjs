import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const runtime = process.env.PNEUMA_PLAYWRIGHT_MODULE;
if (!runtime) throw new Error("Set PNEUMA_PLAYWRIGHT_MODULE to a Playwright ESM module URL.");
const {chromium} = await import(runtime);
const browser = await chromium.launch({headless:true, ...(process.env.PNEUMA_BROWSER_CHANNEL ? {channel:process.env.PNEUMA_BROWSER_CHANNEL} : {})});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://scene.test/**",async route => {
    const path = new URL(route.request().url()).pathname;
    if(path.startsWith("/scripts/")) return route.fulfill({contentType:"text/javascript",body:await readFile(resolve("dist",path.slice(1)),"utf8")});
    if(path.endsWith(".svg")) return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000"><rect width="4000" height="3000" fill="#555"/></svg>'});
    await route.fulfill({contentType:"text/html",body:"<html><body></body></html>"});
  });
  await page.goto("https://scene.test/");
  await page.evaluate(async()=> {
    const once = new Map(), hooks = new Map();
    window.Application = class {};
    window.FormApplication = class {};
    window.Hooks = {once:(name,fn)=>once.set(name,fn),on:(name,fn)=>hooks.set(name,fn)};
    const defaults = new Map();
    window.game = {user:{isGM:true},folders:[],system:{grid:{distance:2,units:"m"}},settings:{register:(_id,key,config)=>defaults.set(key,config.default),get:(_id,key)=>defaults.get(key)}};
    window.Folder = {create:async data=>{const folder={...data,id:`folder-${game.folders.length}`};window.game.folders.push(folder);return folder;}};
    window.ui = {notifications:{info:()=>{},warn:()=>{},error:message=>{window.failure=message;}}};
    window.Dialog = class {
      constructor(data){this.data=data;}
      render(){this.element=document.createElement("section");this.element.innerHTML=`<h2>${this.data.title}</h2>${this.data.content}<button data-button="next">Next</button><button data-button="cancel">Cancel</button>`;document.body.append(this.element);this.element.querySelector('[data-button="cancel"]').onclick=()=>this.close();this.data.render(this.element);}
      close(){this.element.remove();this.data.close();}
    };
    window.FilePicker = class {
      activeSource="data";sources={data:{target:"maps"}};
      constructor(options){this.options=options;}
      render(){this.options.callback("maps/map.svg");}
      static async browse(){return {files:["maps/map.svg","maps/map-OVERLAY.svg"],dirs:[]};}
    };
    window.Scene = class {
      constructor(data){this.data=data;}
      getDimensions(){return {sceneX:100,sceneY:100};}
      static async create(data){window.created=data;return {name:data.name,sheet:{render:()=>{}},createThumbnail:async()=>({thumb:"thumb"}),update:async()=>{}};}
    };
    await import("/scripts/main.js");once.get("init")();
    const root=document.createElement("section");
    root.innerHTML='<header class="directory-header"><div class="header-actions"><button class="create-document">Create Scene</button></div></header><ol class="directory-list"></ol>';
    document.body.append(root);
    hooks.get("renderSidebarTab")({tabName:"scenes"},[root]);
    hooks.get("renderSceneDirectory")({},root);
    if(root.querySelectorAll(".pneuma-scene-create").length!==1) throw new Error("Scene header must receive exactly one creator button without a footer");
    if(!root.querySelector(".header-actions .pneuma-scene-create")) throw new Error("Creator must join native header actions");
    const actors=document.createElement("section");hooks.get("renderSidebarTab")({tabName:"actors"},actors);
    if(actors.querySelector(".pneuma-scene-create")) throw new Error("Creator must not appear in Actors sidebar");
    game.user.isGM=false;
    const playerRoot=document.createElement("section");hooks.get("renderSceneDirectory")({},playerRoot);
    if(playerRoot.querySelector(".pneuma-scene-create")) throw new Error("Creator is GM-only");
    game.user.isGM=true;
    root.querySelector(".pneuma-scene-create").click();
  });
  await page.locator('[name="variant-0"]').waitFor();
  await page.locator('[data-button="next"]').click();
  await page.locator('[name="gridChoice"]').selectOption("custom");
  await page.locator('[name="customGrid"]').fill("10");
  await page.locator('[data-button="next"]').click();
  assert.equal(await page.locator('[name="gridChoice"]').count(),1);
  await page.locator('[name="customGrid"]').fill("150");
  await page.locator('[name="name"]').fill("Test Scene");
  assert.match(await page.locator(".pneuma-grid-count").textContent(),/26.67 × 20.00/);
  await page.locator('[data-button="next"]').click();
  await page.locator('[name="overlay-0"]').check();
  await page.locator('[name="x-0"]').fill("25");
  await page.locator('[name="layer-0"]').selectOption("foreground");
  await page.locator('[data-button="next"]').click();
  assert.equal(await page.locator('[name="layer-0"]').count(),1);
  await page.locator('[name="layer-0"]').selectOption("tile");
  await page.locator('[data-button="next"]').click();
  await page.waitForFunction(()=>window.created || window.failure);
  const result = await page.evaluate(()=>({data:window.created,failure:window.failure}));
  assert.equal(result.failure,undefined);assert.equal(result.data.name,"Test Scene");
  assert.equal(result.data.grid.size,150);assert.equal(result.data.grid.distance,2);
  assert.equal(result.data.background.src,"maps/map.svg");assert.equal(result.data.tiles[0].x,125);
  assert.equal(result.data.environment.globalLight.enabled,true);assert.equal(result.data.active,false);
  assert.deepEqual(errors,[]);
  console.log("Browser fixture: picker → import choice → custom grid preview → overlay → Scene creation passed.");
} finally {await browser.close();}
