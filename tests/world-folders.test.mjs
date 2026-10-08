import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {Collection, environment, getPath} from "./netarch/helpers.mjs";
import {ensureSceneToolsFolder, WORLD_FOLDERS} from "../dist/scripts/world-folders.js";
import {PIXI as runtimePIXI} from "../dist/scripts/netarch/runtime.js";

test("scanner runtime preserves PIXI constructor static properties",()=>{
  globalThis.PIXI={Texture:class {static EMPTY={empty:true};}};
  assert.equal(runtimePIXI.Texture,globalThis.PIXI.Texture);
  assert.equal(runtimePIXI.Texture.EMPTY,globalThis.PIXI.Texture.EMPTY);
  assert.ok(new runtimePIXI.Texture() instanceof globalThis.PIXI.Texture);
});

test("concurrent Actor features share one SceneTools root; Scene and Item roots remain separate",async()=> {
  environment();
  const [templates,promoted,aps]=await Promise.all([ensureSceneToolsFolder("Actor",WORLD_FOLDERS.mookTemplates),ensureSceneToolsFolder("Actor",WORLD_FOLDERS.mookPromoted),ensureSceneToolsFolder("Actor",WORLD_FOLDERS.netarchAPs)]);
  const roots=game.folders.filter(folder=>folder.name==="SceneTools");assert.equal(roots.length,1);
  for(const child of [templates,promoted,aps]) assert.equal(child.folder,roots[0].id);
  const imported=await ensureSceneToolsFolder("Scene",WORLD_FOLDERS.scenes),itemFolder=await ensureSceneToolsFolder("Item","Generated Items");
  assert.notEqual(imported.folder,templates.folder);assert.notEqual(itemFolder.folder,templates.folder);
  assert.equal(game.folders.filter(folder=>folder.name==="SceneTools").length,3);
  assert.equal((await ensureSceneToolsFolder("Actor",WORLD_FOLDERS.netarchAPs)).id,aps.id);
});

test("players cannot provision in-world folders",async()=>{
  const {player}=environment();game.user=player;
  await assert.rejects(ensureSceneToolsFolder("Actor",WORLD_FOLDERS.netarchAPs),/Only a GM/);assert.equal(game.folders.size,0);
});

test("MookMaker and Scanner startup use one module namespace without duplicate settings or APIs",async()=> {
  const env=environment(),settings=new Set(),menus=new Set(),hooks=[];
  globalThis.Application=class {static get defaultOptions(){return {};}};
  globalThis.FormApplication=class extends Application {};
  game.modules=new Map([["pneuma-scenetools",{}]]);
  game.settings.register=(scope,key,config)=>{assert.equal(scope,"pneuma-scenetools");assert.ok(!settings.has(key),`Duplicate setting ${key}`);settings.add(key);env.values.set(key,config.default);};
  game.settings.registerMenu=(scope,key)=>{assert.equal(scope,"pneuma-scenetools");assert.ok(!menus.has(key));menus.add(key);};
  const callbacks=new Map();Hooks.once=(key,callback)=>callbacks.set(key,callback);
  Hooks.on=(key,callback)=>hooks.push({key,callback});
  await import("../dist/scripts/main.js");callbacks.get("init")();
  const api=game.modules.get("pneuma-scenetools").api;
  assert.equal(typeof api.openSceneCreator,"function");assert.equal(typeof api.netArchScanner.openScanner,"function");
  assert.equal(api.mookMaker.moduleId,"pneuma-scenetools");assert.equal(api.folders.root,"SceneTools");
  assert.ok(settings.has("skillClassifications"));assert.ok(settings.has("apTypes"));assert.ok(settings.has("defaultGrid"));
  assert.ok(menus.has("manageTypes"));assert.ok(hooks.some(hook=>hook.key==="renderSceneDirectory"));
  assert.equal(hooks.filter(hook=>hook.key==="preCreateToken").length,2);
});

test("MookMaker default template and AP templates provision together into their dedicated folders",async()=> {
  environment();
  game.users.activeGM=game.user;
  globalThis.FormApplication=class {};
  foundry.utils.getProperty=getPath;
  game.i18n={localize:key=>key.includes("DefaultMook") ? "Default Mook" : key};
  const template=JSON.parse(await readFile(new URL("../src/templates/default-mook.json",import.meta.url),"utf8"));
  const originalFetch=globalThis.fetch;globalThis.fetch=async path=>{assert.equal(path,"modules/pneuma-scenetools/templates/default-mook.json");return {ok:true,json:async()=>structuredClone(template)};};
  const originalCreate=Folder.create;
  Folder.create=async data=>{
    const folder=await originalCreate(data);
    folder.folder=game.folders.get(data.folder)??null;
    folder.setFlag=async(scope,key,value)=>{folder.flags??={};folder.flags[scope]??={};folder.flags[scope][key]=value;};
    return folder;
  };
  Actor.create=async data=>{
    const actor={...structuredClone(data),id:"default-mook",folder:game.folders.get(data.folder),items:new Collection(data.items.map((item,i)=>({...item,id:`item-${i}`})))};
    game.actors.set(actor.id,actor);return actor;
  };
  try {
    const {ensureMookMakerFolders,isTemplateActor}=await import("../dist/scripts/mookmaker/folders.js");
    const {ensureTemplates}=await import("../dist/scripts/netarch/templates.js");
    await Promise.all([ensureMookMakerFolders(),ensureTemplates()]);
    assert.equal(game.folders.filter(folder=>folder.name==="SceneTools"&&folder.type==="Actor").length,1);
    for(const name of [WORLD_FOLDERS.mookTemplates,WORLD_FOLDERS.mookPromoted,WORLD_FOLDERS.netarchAPs]) assert.ok(game.folders.find(folder=>folder.name===name));
    assert.equal(game.actors.size,7);assert.equal(isTemplateActor(game.actors.get("default-mook")),true);
    assert.equal(game.actors.get("default-mook").img,"modules/pneuma-scenetools/assets/actor/default-mook.png");
    await ensureMookMakerFolders();await ensureTemplates();assert.equal(game.actors.size,7);assert.equal(game.folders.size,4);
  } finally {globalThis.fetch=originalFetch;}
});
