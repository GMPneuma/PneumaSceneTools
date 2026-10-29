import test from 'node:test';
import assert from 'node:assert/strict';
import {panToPin,registerPinJournal,addPinJournalButton} from '../dist/scripts/map-pin-journal.js';

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

test('hazard updates preserve the note lookup while pin membership changes invalidate it',()=>{
 const hooks=new Map();globalThis.Hooks={on(name,fn){hooks.set(name,fn);}};
 globalThis.foundry={utils:{getProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o)}};
 globalThis.document={createElement:()=>({append(){},addEventListener(){}})};
 const scene={id:'scene',flags:{'pneuma-scenetools':{mapPinning:true}},notes:[{entryId:'journal',pageId:'page'}]};
 let scans=0,buttons=0;
 globalThis.game={user:{isGM:true},scenes:{*[Symbol.iterator](){scans++;yield scene;}}};
 const page={id:'page',parent:{id:'journal'},testUserPermission:()=>true};
 const root={closest(){return this;},querySelectorAll:()=>[],prepend(){buttons++;}};
 registerPinJournal();hooks.get('createScene')(scene);
 addPinJournalButton(page,root);assert.equal(scans,1);assert.equal(buttons,1);
 for(let i=0;i<100;i++){
   hooks.get('updateScene')(scene,{'flags.pneuma-scenetools.hazards.trap.moveProgress.pc':i});
   addPinJournalButton(page,root);
 }
 assert.equal(scans,1,'Repeated Journal renders reuse their note index through hazard updates');
 scene.flags['pneuma-scenetools'].mapPinning=false;
 hooks.get('updateScene')(scene,{'flags.pneuma-scenetools.-=mapPinning':null});
 addPinJournalButton(page,root);assert.equal(scans,2);assert.equal(buttons,101);
});
