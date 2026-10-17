import test from "node:test";
import assert from "node:assert/strict";
import {refreshSceneThumbnail} from "../dist/scripts/scene-thumbnail.js";

function sceneWith(generate, thumb = null) {
  return {thumb, createThumbnail: generate, toObject(){return {thumb:this.thumb};}, async update(data) { this.thumb = data.thumb;return this; }};
}

test("replaces a nonempty inherited thumbnail with the final Scene thumbnail", async () => {
  const scene = sceneWith(async () => ({thumb: "final-map"}), "old-map");
  await refreshSceneThumbnail(scene);
  assert.equal(scene.thumb, "final-map");
});

test('native cache-busting URLs do not turn a successful save into a thumbnail failure',async()=>{
 const scene=sceneWith(async()=>({thumb:'data:image/webp;base64,new-image'}),'old-map');
 let stored='old-map';scene.toObject=()=>({thumb:stored});
 scene.update=async()=>{stored='worlds/test/scenes/map-thumb.webp';scene.thumb=stored+'?1792190000000';return scene;};
 await refreshSceneThumbnail(scene);assert.equal(stored,'worlds/test/scenes/map-thumb.webp');
});

test('replacing the contents of an existing thumbnail file is a successful save',async()=>{
 const scene=sceneWith(async()=>({thumb:'data:image/webp;base64,new-image'}),'worlds/test/scenes/map-thumb.webp');
 const stored=scene.thumb;scene.toObject=()=>({thumb:stored});scene.update=async()=>{scene.thumb=stored+'?new-cache-key';return scene;};
 await refreshSceneThumbnail(scene);
});

test('a native no-diff update is accepted only if the generated thumbnail is already stored',async()=>{
 const scene=sceneWith(async()=>({thumb:'existing'}),'existing');scene.update=async()=>undefined;
 await refreshSceneThumbnail(scene);
 scene.toObject=()=>({thumb:null});await assert.rejects(refreshSceneThumbnail(scene),/did not save/);
});

test('generation failures and empty thumbnails stop after one attempt',async()=>{
 for(const generate of [async()=>{throw Error('Texture not ready');},async()=>({thumb:''})]){
   let attempts=0;const scene=sceneWith(async()=>{attempts++;return generate();},'existing');
   await assert.rejects(refreshSceneThumbnail(scene));assert.equal(attempts,1);assert.equal(scene.thumb,'existing');
 }
});
test('cancelled thumbnail writes report failure without retrying',async()=>{
 const scene=sceneWith(async()=>({thumb:'new'}),'existing');let saves=0;scene.update=async()=>{saves++;};
 await assert.rejects(refreshSceneThumbnail(scene),/did not save/);assert.equal(saves,1);assert.equal(scene.thumb,'existing');
});
