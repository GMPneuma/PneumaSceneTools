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
    return route.fulfill({contentType:"text/html",body:`<html><body><section id="scenes"><header class="directory-header"><div class="header-actions"></div></header></section><script>
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
        static async fire(name){for(const callback of this.events.get(name)??[])await callback()}
      }
      const foundry={utils:{mergeObject:(a,b)=>({...a,...b}),getProperty:(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object),getRoute:path=>'/'+path}};
      const ui={scenes:{element:[document.querySelector('#scenes')]},notifications:{info(){},warn(){},error(message){throw Error(message)}}};
      const canvas={ready:false};
      const CONST={TOKEN_DISPLAY_MODES:{OWNER_HOVER:20,NONE:0}};
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
      }
      globalThis.libWrapper={register(){}};
    </script></body></html>`});
  });
  await page.goto("https://scene.test/");
  const state=await page.evaluate(async()=>{
    if(globalThis.FormApplication!==undefined||globalThis.Hooks!==undefined)throw Error('Fixture must use lexical Foundry globals');
    await import('/modules/pneuma-scenetools/scripts/main.js');
    await Hooks.fire('init');await Hooks.fire('ready');
    return {folders:[...game.folders].map(folder=>folder.name),sceneFolders:[...game.folders].filter(folder=>folder.type==='Scene').map(folder=>({id:folder.id,name:folder.name,parent:folder.folder?.id??null})),actors:game.actors.size,button:document.querySelectorAll('.pneuma-scene-create').length,api:Boolean(game.modules.get('pneuma-scenetools').api)};
  });
  assert.deepEqual(errors,[]);assert.equal(state.api,true);assert.equal(state.button,1);assert.equal(state.actors,7);
  assert.deepEqual(new Set(state.folders),new Set(['SceneTools','Imported Scenes','MookMaker Templates','MookMaker Promoted Actors','NetArchAPs']));
  assert.equal(state.sceneFolders.length,2);
  assert.equal(state.sceneFolders[1].name,"Imported Scenes");
  assert.equal(state.sceneFolders[1].parent,state.sceneFolders[0].id);
  console.log("Foundry-style lexical globals: module loads, settings/API register, scene button appears, and seven template Actors provision.");
} finally {await browser.close();}
