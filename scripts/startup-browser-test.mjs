import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
const {chromium}=await import(process.env.PNEUMA_PLAYWRIGHT_MODULE ?? "playwright");
const browser=await chromium.launch({headless:true,...(process.env.PNEUMA_BROWSER_CHANNEL?{channel:process.env.PNEUMA_BROWSER_CHANNEL}:{})});
try {
  const page=await browser.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("https://scene.test/**",async route=>{
    const path=new URL(route.request().url()).pathname.slice(1);
    if(path.startsWith("modules/pneuma-scenetools/")) {
      const relative=path.slice("modules/pneuma-scenetools/".length);
      return route.fulfill({contentType:relative.endsWith(".js")?"text/javascript":"application/json",body:await readFile(resolve("dist",relative))});
    }
    if(path.startsWith("systems/")) return route.fulfill({contentType:"text/javascript",body:"export default class CPRChat {static RenderRollCard(){}}"});
    return route.fulfill({contentType:"text/html",body:`<html><body><section id="scenes" class="directory"><header class="directory-header"><div class="action-buttons flexrow"><button>Create Scene</button><button>Create Folder</button></div><div class="directory-search"><input placeholder="Search Scenes"></div></header></section><script>
      class Collection extends Map {
        [Symbol.iterator](){return this.values()}
        find(fn){return [...this.values()].find(fn)}
        filter(fn){return [...this.values()].filter(fn)}
        some(fn){return [...this.values()].some(fn)}
        map(fn){return [...this.values()].map(fn)}
      }
      class Application {static get defaultOptions(){return {}};constructor(options={}){this.options=options};render(){return this}}
      class FormApplication extends Application {constructor(object,options){super(options);this.object=object}}
      class FilePicker extends Application {}
      class Token {}
      class Hooks {
        static events=new Map();
        static on(name,callback){const callbacks=this.events.get(name)??[];callbacks.push(callback);this.events.set(name,callbacks)}
        static once(name,callback){this.on(name,callback)}
        static async fire(name,...args){for(const callback of this.events.get(name)??[])await callback(...args)}
      }
      const foundry={data:{regionBehaviors:{RegionBehaviorType:class{}}},utils:{randomID:()=>crypto.randomUUID(),mergeObject:(a,b)=>({...a,...b}),getProperty:(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object),getRoute:path=>'/'+path}};
      const notices=[];
      const ui={scenes:{element:[document.querySelector('#scenes')]},notifications:{info(){},warn(){},error(message){notices.push(message)}}};
      const canvas={ready:false};
      const CONFIG={RegionBehavior:{dataModels:{}}};
      const CONST={REGION_VISIBILITY:{GAMEMASTER:1},REGION_EVENTS:{TOKEN_ENTER:"tokenEnter",TOKEN_EXIT:"tokenExit",TOKEN_MOVE:"tokenMove",TOKEN_TURN_START:"tokenTurnStart",TOKEN_TURN_END:"tokenTurnEnd"},TOKEN_DISPLAY_MODES:{OWNER_HOVER:20,NONE:0}};
      const values=new Map();
      const game={system:{id:'cyberpunk-red-core'},release:{generation:12},user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},documentTypes:{Actor:['character','container']},folders:new Collection(),actors:new Collection(),modules:new Map([['pneuma-scenetools',{}]]),i18n:{localize:key=>key},settings:{
        register:(scope,key,config)=>values.set(key,config.default),get:(scope,key)=>values.get(key),
        registerMenu(scope,key,config){if(!(config.type.prototype instanceof FormApplication))throw Error('Invalid native menu class')}
      }};
      class Folder {
        static async create(data){const folder=new this();Object.assign(folder,data,{id:'folder-'+game.folders.size,folder:game.folders.get(data.folder)??null});game.folders.set(folder.id,folder);return folder}
        async setFlag(scope,key,value){this.flags??={};this.flags[scope]??={};this.flags[scope][key]=value}
      }
      class Actor {
        constructor(data){Object.assign(this,data);this.id='actor-'+game.actors.size;this.folder=game.folders.get(data.folder);this.items=new Collection((data.items??[]).map((item,i)=>['item-'+i,item]));game.actors.set(this.id,this)}
        static async create(data){return new this(data)}
        static async createDocuments(data){return data.map(row=>new this(row))}
        static async updateDocuments(){return []}
        getFlag(scope,key){return this.flags?.[scope]?.[key]}
        async createEmbeddedDocuments(type,data){return data.map(entry=>{const item={...entry,id:'item-'+this.items.size};this.items.set(item.id,item);return item})}
      }
      game.items=new Collection();
      class Item {static async createDocuments(data){return data.map(entry=>{const item={...entry,id:'world-item-'+game.items.size};game.items.set(item.id,item);return item})}}
      globalThis.libWrapper={register(){}};
    </script></body></html>`});
  });
  await page.goto("https://scene.test/");
  await page.addStyleTag({content:'.directory-header{display:flex;flex-direction:column;width:300px}.flexrow{display:flex;flex-direction:row;flex-wrap:wrap}.flexrow>*{flex:1}.directory .action-buttons button{height:28px;line-height:26px;margin:4px;min-width:max-content;white-space:nowrap}'});
  await page.addStyleTag({content:await readFile('dist/styles/pneuma-scenetools.css','utf8')});
  const state=await page.evaluate(async()=>{
    if(globalThis.FormApplication!==undefined||globalThis.Hooks!==undefined)throw Error('Fixture must use lexical Foundry globals');
    await Promise.all(["main.js","mookmaker/entry.js","netarch/entry.js"].map(path=>import('/modules/pneuma-scenetools/scripts/'+path).catch(error=>notices.push(error.message))));
    await Hooks.fire('init');await Hooks.fire('ready');await Hooks.fire('renderSceneDirectory',{},[document.querySelector('#scenes')]);
    return {folders:[...game.folders].map(folder=>folder.name),sceneFolders:[...game.folders].filter(folder=>folder.type==='Scene').map(folder=>({id:folder.id,name:folder.name,parent:folder.folder?.id??null})),actors:game.actors.size,button:document.querySelectorAll('.pneuma-scene-create').length,api:Boolean(game.modules.get('pneuma-scenetools').api)};
  });
  assert.deepEqual(errors,[]);assert.equal(state.api,true);assert.equal(state.button,1);assert.equal(state.actors,9);
  assert.deepEqual(await page.locator('.pneuma-scene-tools-row button').allTextContents(),[' Import',' Modular']);
  assert.equal(await page.locator('.pneuma-scene-create .fa-file-import').count(),1);
  assert.equal(await page.locator('.pneuma-modular-open .fa-person-digging').count(),1);
  assert.deepEqual(await page.locator('.pneuma-scene-tools-row button').evaluateAll(buttons=>buttons.map(button=>button.title)),['Scene Tools - Quick Scene Importer','Scene Tools - Modular Scene Creator']);
  assert.equal(await page.locator('.directory-header > .action-buttons').first().locator('button').count(),2);
  assert.equal(await page.evaluate(()=>document.querySelector('.pneuma-scene-tools-row').nextElementSibling.className),'directory-search');
  const positions=await page.locator('.pneuma-scene-tools-row button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));
  assert.equal(positions[0].y,positions[1].y);assert.ok(positions[1].x>=positions[0].x+positions[0].width);
  const buttonStyles=await page.locator('.directory-header .action-buttons button').evaluateAll(buttons=>buttons.map(button=>{const s=getComputedStyle(button);return [s.height,s.lineHeight,s.margin,s.padding,s.fontFamily,s.fontSize,s.color,s.backgroundColor,s.border];}));
  assert.deepEqual(buttonStyles[2],buttonStyles[0]);assert.deepEqual(buttonStyles[3],buttonStyles[1]);
  await page.evaluate(()=>Hooks.fire('renderSceneDirectory',{},[document.querySelector('#scenes')]));
  assert.equal(await page.locator('.pneuma-scene-tools-row').count(),1);
  assert.deepEqual(new Set(state.folders),new Set(['SceneTools','Imported Scenes','MookMaker Templates','MookMaker Promoted Actors','Vehicle Templates','NetArchAPs','Hazard Actor Templates']));
  assert.equal(state.sceneFolders.length,2);
  assert.equal(state.sceneFolders[1].name,"Imported Scenes");
  assert.equal(state.sceneFolders[1].parent,state.sceneFolders[0].id);
  for (const failed of ["mookmaker/main.js","creator.js"]) {
    await page.route("**/scripts/"+failed,route=>route.fulfill({contentType:"text/javascript",body:"throw Error('Simulated feature load failure')"}));
    await page.reload();
    const isolated=await page.evaluate(async()=>{
      await Promise.all(["main.js","mookmaker/entry.js","netarch/entry.js"].map(path=>import('/modules/pneuma-scenetools/scripts/'+path).catch(error=>notices.push(error.message))));await Hooks.fire('init');await Hooks.fire('ready');
      return {actors:game.actors.size,notices,api:Object.keys(game.modules.get('pneuma-scenetools').api),button:document.querySelectorAll('.pneuma-scene-create').length};
    });
    assert.equal(isolated.actors,failed.startsWith("mookmaker")?7:8);
    assert.equal(isolated.button,failed.startsWith("mookmaker")?1:0);
    assert.ok(isolated.api.includes("netArchScanner"));assert.equal(isolated.notices.length,1,JSON.stringify({failed,notices:isolated.notices}));
    await page.unroute("**/scripts/"+failed);
  }
  assert.deepEqual(errors,[]);
  console.log("Foundry-style lexical globals: module loads, settings/API register, scene button appears, and nine template Actors provision.");
} finally {await browser.close();}
