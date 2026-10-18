import test from 'node:test';
import assert from 'node:assert/strict';
import {panToPin} from '../dist/scripts/map-pin-journal.js';

test('journal pan never uses another scene coordinates for players and validates GM scene transitions',async()=>{
  const notices=[],pans=[];
  globalThis.ui={notifications:{info:m=>notices.push(m),warn:m=>notices.push(m)}};
  globalThis.foundry={utils:{getProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o)}};
  const scene={id:'target',flags:{'pneuma-scenetools':{mapPinning:true}},notes:{contents:[],get:id=>scene.notes.contents.find(n=>n.id===id)},async view(){canvas.scene=scene;}};
  const note={id:'pin',entryId:'journal',pageId:'page',parent:scene,x:123,y:456,object:{isVisible:true}};scene.notes.contents.push(note);
  const page={id:'page',parent:{id:'journal'},testUserPermission:()=>true};
  globalThis.game={user:{isGM:false},scenes:{contents:[scene]}};
  globalThis.canvas={ready:true,scene:{id:'other'},animatePan:async p=>pans.push(p)};
  await panToPin(page);assert.deepEqual(pans,[]);assert.match(notices.pop(),/another scene/);assert.equal(canvas.scene.id,'other');
  canvas.scene=scene;await panToPin(page);assert.deepEqual(pans,[{x:123,y:456}]);
  note.object.isVisible=false;await panToPin(page);assert.equal(pans.length,1);
  game.user.isGM=true;canvas.scene={id:'other'};await panToPin(page);assert.equal(canvas.scene,scene);assert.equal(pans.length,2);
  canvas.scene={id:'other'};scene.view=async()=>{};await panToPin(page);assert.equal(pans.length,2);
  scene.notes.contents=[];await panToPin(page);assert.equal(pans.length,2);assert.match(notices.pop(),/no longer/);
});
