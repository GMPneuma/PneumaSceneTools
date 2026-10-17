import test from "node:test";
import assert from "node:assert/strict";
import {bounded} from "../dist/scripts/io.js";
test("Foundry gridless JSON retains its grid size and marks imported defaults",async()=>{
 const {environment}=await import("./netarch/helpers.mjs");environment();
 const {prepareScene}=await import("../dist/scripts/scene-import.js");
 globalThis.HTMLVideoElement=class {};
 globalThis.Image=class {naturalWidth=1000;naturalHeight=1000;set src(value){queueMicrotask(()=>this.onload?.());}removeAttribute(){}};
 globalThis.Scene={fromImport:async data=>({toObject:()=>structuredClone(data)})};
 const selected={kind:"Foundry Scene",path:"map.json",data:{name:"Map",grid:{size:73,type:0}}};
 const prepared=await prepareScene("map.webp",selected,["map.webp"],false,"edit");
 assert.equal(prepared.gridOptions.find(option=>option.selected).size,73);
 assert.match(prepared.gridOptions.find(option=>option.selected).label,/\(Imported\)/);
 assert.deepEqual(prepared.gridTypes,[{value:1,label:"Squares",selected:false},{value:0,label:"Gridless (Imported)",selected:true}]);
 selected.data.grid={};
 const fallback=await prepareScene("map.webp",selected,["map.webp"],false,"edit");
 assert.ok(!fallback.gridOptions.some(option=>option.label.includes('(Imported)')));
});
test("foreground rematching prefers the map folder, then the JSON folder, without changing source JSON",async()=>{
 const {environment}=await import("./netarch/helpers.mjs");environment();
 const {prepareScene}=await import("../dist/scripts/scene-import.js");
 globalThis.HTMLVideoElement=class {};
 globalThis.Image=class {naturalWidth=1000;naturalHeight=1000;set src(value){queueMicrotask(()=>this.onload?.());}removeAttribute(){}};
 globalThis.Scene={fromImport:async data=>({toObject:()=>structuredClone(data)})};
 const data={name:"Map",width:1000,height:1000,foreground:"old/roof.webp",grid:{size:100}};
 const selected={kind:"Foundry Scene",path:"json/map.json",data};
 const files=["maps/map.webp","maps/roof.webp","json/roof.webp","other/roof.webp","old/roof.webp"];
 const local=await prepareScene(files[0],selected,files,false,"edit");
 assert.equal(local.data.foreground,"maps/roof.webp");assert.equal(local.source.foreground,"old/roof.webp");
 const besideJson=await prepareScene(files[0],selected,files.filter(path=>path!=="maps/roof.webp"),false,"edit");
 assert.equal(besideJson.data.foreground,"json/roof.webp");
 const missing=await prepareScene(files[0],selected,[files[0]],false,"edit");
 assert.equal(missing.data.foreground,"old/roof.webp");assert.ok(missing.unresolved.includes("old/roof.webp"));
});
test("stalled reads time out, cancel promptly, and ignore late completion",async()=>{
  const stalled=new Promise(()=>{});
  await assert.rejects(bounded(stalled,new AbortController().signal,5),/timed out/);
  const abort=new AbortController();let finish;
  const waiting=bounded(new Promise(resolve=>finish=resolve),abort.signal);
  abort.abort(new Error("cancelled"));
  await assert.rejects(waiting,/cancelled/);finish("late");
  assert.equal(await bounded(Promise.resolve("next"),new AbortController().signal),"next");
});

test("cancelling media preparation releases handlers and its source",async()=>{
 const {imageDimensions}=await import("../dist/scripts/scene-import.js");let media;
 globalThis.HTMLVideoElement=class {};
 globalThis.Image=class {constructor(){media=this} removeAttribute(){this.src=""}};
 const controller=new AbortController();const loading=imageDimensions("map.webp",controller.signal);
 controller.abort(new Error("closed"));await assert.rejects(loading,/closed/);
 assert.equal(media.onload,null);assert.equal(media.onerror,null);assert.equal(media.src,"");
});

test("JSON preview to edit rematches all supported assets without changing the native import source",async()=>{
 const {environment,applyChanges}=await import("./netarch/helpers.mjs");environment();
 const {prepareScene,enableSceneOverrides,applySceneOverrides}=await import("../dist/scripts/scene-import.js");
 globalThis.HTMLVideoElement=class {};
 globalThis.Image=class {naturalWidth=1000;naturalHeight=1000;set src(value){queueMicrotask(()=>this.onload?.());}removeAttribute(){}};
 globalThis.Scene={fromImport:async data=>({toObject:()=>structuredClone(data)})};
 const data={name:"Map",width:1000,height:1000,foreground:"old/roof.webp",tiles:[{_id:"tile",texture:{src:"old/tile.webp"}}],tokens:[{_id:"token",texture:{src:"old/token.webp"}}],sounds:[{_id:"sound",path:"old/sound.ogg"}],grid:{size:100},walls:[{c:[1,2,3,4]}],lights:[{x:100,y:100}]};
 const selected={kind:"Foundry Scene",path:"map.json",data};
 const files=["new/map.webp","new/roof.webp","new/tile.webp","new/token.webp","new/sound.ogg"];
 const preview=await prepareScene(files[0],selected,files,false,"json");
 assert.equal(preview.data.foreground,"old/roof.webp");enableSceneOverrides(preview,files);
 const direct=await prepareScene(files[0],selected,files,false,"edit");
 assert.deepEqual(preview.data,direct.data);assert.deepEqual(preview.source,data);assert.deepEqual(preview.unresolved,[]);
 const saved=structuredClone(data),updates=[];const scene={toObject:()=>structuredClone(saved),update:async changes=>{updates.push(changes);applyChanges(saved,changes);},updateEmbeddedDocuments:async(type,changes)=>{updates.push({type,changes});const key={Tile:'tiles',Token:'tokens',AmbientSound:'sounds'}[type];for(const change of changes)applyChanges(saved[key].find(item=>item._id===change._id),change);}};
 await applySceneOverrides(scene,preview,preview.data);
 assert.deepEqual(updates,[{foreground:"new/roof.webp"},{type:"Tile",changes:[{_id:"tile","texture.src":"new/tile.webp"}]},{type:"Token",changes:[{_id:"token","texture.src":"new/token.webp"}]},{type:"AmbientSound",changes:[{_id:"sound",path:"new/sound.ogg"}]}]);
 preview.created="saved";preview.useJson=true;enableSceneOverrides(preview,[]);assert.equal(preview.useJson,true);
});


test("separate same-folder Grid Offset files supply grid size without overriding imports or filename hints",async()=>{
 const {environment}=await import("./netarch/helpers.mjs");environment();
 const {prepareScene}=await import("../dist/scripts/scene-import.js");
 const {isMedia}=await import("../dist/scripts/matching.js");
 globalThis.HTMLVideoElement=class {};
 globalThis.Image=class {naturalWidth=1000;naturalHeight=1000;set src(value){queueMicrotask(()=>this.onload?.());}removeAttribute(){}};
 globalThis.Scene={fromImport:async data=>({toObject:()=>structuredClone(data)})};
 const map='maps/warehouse.webp',files=[map,'maps/Grid Offset 108.txt','other/Grid Offset 140.txt'];
 const result=await prepareScene(map,undefined,files,false,'edit');
 assert.equal(result.defaults.gridSize,108);assert.match(result.gridOptions[0].label,/Folder grid hint/);
 assert.equal(isMedia('maps/Grid Offset 108.png'),false);
 assert.notEqual((await prepareScene(map,undefined,[map,'other/Grid Offset 108.txt'],false,'edit')).defaults.gridSize,108);
 assert.notEqual((await prepareScene(map,undefined,[...files,'maps/Grid Offset 140'],false,'edit')).defaults.gridSize,108);
 assert.equal((await prepareScene('maps/warehouse-140ppi.webp',undefined,files,false,'edit')).defaults.gridSize,140);
 const imported={kind:'Foundry Scene',path:'maps/warehouse.json',data:{name:'Map',grid:{size:73,type:1}}};
 assert.equal((await prepareScene(map,imported,files,false,'edit')).defaults.gridSize,73);
});
