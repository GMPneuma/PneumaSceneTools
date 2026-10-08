import test from "node:test";
import assert from "node:assert/strict";
import {bounded} from "../dist/scripts/io.js";
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
 const {environment}=await import("./netarch/helpers.mjs");environment();
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
 const updates=[];const scene={toObject:()=>structuredClone(data),update:async changes=>updates.push(changes),updateEmbeddedDocuments:async(type,changes)=>updates.push({type,changes})};
 await applySceneOverrides(scene,preview,preview.data);
 assert.deepEqual(updates,[{foreground:"new/roof.webp"},{type:"Tile",changes:[{_id:"tile","texture.src":"new/tile.webp"}]},{type:"Token",changes:[{_id:"token","texture.src":"new/token.webp"}]},{type:"AmbientSound",changes:[{_id:"sound",path:"new/sound.ogg"}]}]);
 preview.created="saved";preview.useJson=true;enableSceneOverrides(preview,[]);assert.equal(preview.useJson,true);
});
