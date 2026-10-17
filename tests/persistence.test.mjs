import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,Collection,applyChanges} from './netarch/helpers.mjs';
globalThis.FormApplication=class {};
const {purgeGear}=await import('../dist/scripts/mookmaker/purge.js');
const {applyMookChanges}=await import('../dist/scripts/mookmaker/apply-mook.js');
const {applySceneOverrides}=await import('../dist/scripts/scene-import.js');
const {assertStoredChanges}=await import('../dist/scripts/persistence.js');
const flatten=(object,prefix='',out={})=>{for(const [key,value] of Object.entries(object)){const path=prefix?`${prefix}.${key}`:key;if(value&&typeof value==='object'&&!Array.isArray(value))flatten(value,path,out);else out[path]=value;}return out;};
function setup(){
 const env=environment();foundry.utils.deepClone=structuredClone;foundry.utils.flattenObject=flatten;
 game.i18n={localize:k=>k,format:k=>k};
 const actor={name:'Mook',system:{stats:{ref:{value:5},move:{value:4},body:{value:4},will:{value:4}},derivedStats:{hp:{value:20,max:20}},roleInfo:{activeRole:''},installedItems:{list:[]}},items:new Collection(),
  async updateEmbeddedDocuments(_type,rows){for(const row of rows)applyChanges(this.items.get(row._id),row);},
  async deleteEmbeddedDocuments(_type,ids){for(const id of ids)this.items.delete(id);}};
 const token={actor,document:{flags:{"pneuma-scenetools":{mookMakerSaved:true}},uuid:'Scene.s.Token.mook',name:'Mook',actorLink:false,displayName:0,disposition:0,delta:{async update(data){applyChanges(actor,data);}},async update(data){applyChanges(this,data);}}};
 const changes={token,actor,initialName:'Mook',newName:'Changed',displayName:20,tokenDisposition:-1,move:8,hitPoints:40,hitPointStats:{body:8,will:8},roleName:'',roleLevel:0,armorUpdates:[],weaponUpdates:[],skillUpdates:[]};
 return {...env,actor,token,changes};
}
const gear=(id,type='gear',system={})=>({id,uuid:`Scene.s.Token.mook.Actor.base.Item.${id}`,name:id,type,system:{equipped:'owned',...system}});
async function quiet(work){const old=console.error;console.error=()=>{};try{return await work();}finally{console.error=old;}}

test('purge protects native actor and nested installation UUIDs, including world references on synthetic actors',async()=>{
 const {actor,token}=setup();
 actor.items=new Collection([gear('core','cyberware',{installedItems:{list:['Actor.base.Item.upgrade']}}),gear('upgrade','itemUpgrade'),gear('weapon','weapon',{equipped:'equipped',installedItems:{list:['Scene.s.Token.mook.Actor.base.Item.scope']}}),gear('scope','itemUpgrade'),gear('spare')]);
 actor.system.installedItems.list=['Actor.base.Item.core'];
 assert.equal(await purgeGear(token),true);
 assert.deepEqual([...actor.items.keys()],['core','upgrade','weapon','scope']);
});
test('purge unloads native UUID ammunition references and preserves retained ammunition',async()=>{
 const {actor,token,values}=setup();values.set('retainWeaponAmmunition',true);
 actor.items=new Collection([gear('gun','weapon',{magazine:{value:6},installedItems:{list:['Actor.base.Item.ammo']}}),gear('ammo','ammo',{variety:'medium',type:'basic'}),gear('keep','weapon',{equipped:'equipped',magazine:{ammoData:{uuid:'Actor.base.Item.ammo'}}})]);
 actor.deleteEmbeddedDocuments=async(_type,ids)=>{assert.equal(actor.items.get('gun').system.magazine.value,0);assert.deepEqual(actor.items.get('gun').system.installedItems.list,[]);ids.forEach(id=>actor.items.delete(id));};
 assert.equal(await purgeGear(token),true);assert(actor.items.has('ammo'));
});
test('cancelled unload prevents deletion, cancelled deletion restores a surviving magazine',async()=>{
 for(const cancel of ['unload','delete']){
  const {actor,token}=setup();actor.items=new Collection([gear('gun','weapon',{magazine:{value:6},installedItems:{list:['Actor.base.Item.ammo']}}),gear('ammo','ammo')]);
  let deletes=0;
  actor.deleteEmbeddedDocuments=async()=>{deletes++;return [];};
  if(cancel==='unload')actor.updateEmbeddedDocuments=async()=>[];
  assert.equal(await quiet(()=>purgeGear(token)),false);
  assert.equal(deletes,cancel==='unload'?0:1);assert.equal(actor.items.get('gun').system.magazine.value,6);
 }
});
test('partial purge reports failure without restoring references to deleted ammunition',async()=>{
 for(const installed of [true,false]){
 const {actor,token,notices}=setup();actor.items=new Collection([gear('gun','weapon',{magazine:{value:6,ammoData:{uuid:'Actor.base.Item.ammo'}},installedItems:{list:installed?['Actor.base.Item.ammo']:[]}}),gear('ammo','ammo')]);
 actor.deleteEmbeddedDocuments=async()=>{actor.items.delete('ammo');return [];};
 assert.equal(await quiet(()=>purgeGear(token)),false);
 assert.equal(actor.items.get('gun').system.magazine.value,0);assert.deepEqual(actor.items.get('gun').system.installedItems.list,[]);
 assert(notices.some(text=>text.includes('1 of 2 items removed')));
 }
});
test('Apply rejects cancelled ActorDelta and token writes and rolls back prior changes',async()=>{
 for(const cancel of ['delta','token']){
  const {actor,token,changes}=setup();
  if(cancel==='delta')token.document.delta.update=async()=>undefined;
  else token.document.update=async()=>undefined;
  await quiet(()=>assert.rejects(applyMookChanges(changes),/did not save/));
  assert.equal(actor.name,'Mook');assert.equal(actor.system.stats.move.value,4);assert.equal(token.document.name,'Mook');
 }
});
test('Apply rolls back a partially saved embedded-item batch and allows retry',async()=>{
 const {actor,token,changes}=setup();actor.items=new Collection([gear('a','skill',{level:1}),gear('b','skill',{level:2})]);
 changes.skillUpdates=[{_id:'a','system.level':8},{_id:'b','system.level':9}];
 const update=actor.updateEmbeddedDocuments.bind(actor);let first=true;
 actor.updateEmbeddedDocuments=async(type,rows)=>{await update(type,first?rows.slice(0,1):rows);first=false;};
 await quiet(()=>assert.rejects(applyMookChanges(changes),/did not save/));
 assert.equal(actor.items.get('a').system.level,1);assert.equal(actor.items.get('b').system.level,2);
 assert.equal(await applyMookChanges(changes),true);assert.equal(token.document.name,'Changed');
});
test('Apply reports incomplete rollback and source verification accepts no-op updates and prepared modifiers',async()=>{
 const {token,changes}=setup();let writes=0;
 const update=token.document.delta.update;
 token.document.delta.update=async data=>{if(++writes===1)await update(data);};token.document.update=async()=>undefined;
 await quiet(()=>assert.rejects(applyMookChanges(changes),/could not be restored/));
 assert.doesNotThrow(()=>assertStoredChanges({system:{stats:{ref:{value:6}}},toObject:()=>({system:{stats:{ref:{value:8}}}})},{'system.stats.ref.value':8}));
 const f=setup();assert.equal(await applyMookChanges(f.changes),true);assert.equal(await applyMookChanges(f.changes),true);
});
function sceneFixture(){
 setup();const data={background:{src:'old.webp'},tiles:[{_id:'a',texture:{src:'old.webp'}},{_id:'b',texture:{src:'old.webp'}}]};
 const scene={toObject:()=>structuredClone(data),async update(changes){applyChanges(data,changes);},async updateEmbeddedDocuments(_type,rows){rows.forEach(row=>applyChanges(data.tiles.find(item=>item._id===row._id),row));},async createEmbeddedDocuments(_type,rows){const created=rows.map((row,i)=>({...row,_id:`new${i}`}));data.tiles.push(...created);return created.map(row=>({id:row._id}));}};
 return {data,scene,draft:{useJson:false,data:structuredClone(data)}};
}
test('scene overrides reject cancelled and partial writes and accept unchanged saved values',async()=>{
 const {data,scene,draft}=sceneFixture();scene.update=async()=>undefined;
 await assert.rejects(applySceneOverrides(scene,{...draft,useJson:true},{background:{src:'new.webp'}}),/did not save/);
 await applySceneOverrides(scene,{...draft,useJson:true},{background:{src:'old.webp'}});
 scene.updateEmbeddedDocuments=async(_type,rows)=>{applyChanges(data.tiles[0],rows[0]);return [];};
 await assert.rejects(applySceneOverrides(scene,draft,{tiles:data.tiles.map(row=>({...row,texture:{src:'new.webp'}}))}),/did not save/);
});
test('scene overrides detect partial overlay creation and verify persisted overlays',async()=>{
 const {data,scene,draft}=sceneFixture();const overlay={texture:{src:'overlay.webp'},x:0,y:0,width:100,height:100};
 const desired={tiles:[...data.tiles,overlay,overlay]};const create=scene.createEmbeddedDocuments.bind(scene);
 scene.createEmbeddedDocuments=async(type,rows)=>create(type,rows.slice(0,1));
 await assert.rejects(applySceneOverrides(scene,draft,desired),/partially saved/);
 const fresh=sceneFixture();await applySceneOverrides(fresh.scene,fresh.draft,{tiles:[...fresh.data.tiles,overlay]});assert.equal(fresh.data.tiles.length,3);
});
