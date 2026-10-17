import {recordModularEdit, canUndoModular, undoModularEdit} from '../dist/scripts/modular-undo.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cellGeometry, expandLayout, shrinkLayout, tilesInRemovedEdge, translateContents, validateLayout} from '../dist/scripts/modular-model.js';
import {cellTile, createModularScene, createNamedModularScene, expandModularScene, shrinkModularScene, placeModularTile, rotateModularTile, removeModularTile} from '../dist/scripts/modular-scenes.js';
const ID = 'pneuma-scenetools';
const layout = {version:1,width:1000,height:1000,columns:2,rows:2};
// Simplified geometry fixture; runtime uses native Foundry getDimensions.
function dimensions(){return {sceneX:Math.ceil(this.width*(this.padding??0)/100)*100,sceneY:Math.ceil(this.height*(this.padding??0)/100)*100};}
function setup() {
  globalThis.Scene=class {constructor(data){Object.assign(this,data);}getDimensions(){return dimensions.call(this);}};
  globalThis.foundry = {utils:{getProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o)}};
  globalThis.game = {user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},system:{grid:{distance:2,units:'m'}},settings:{get:(_id,key)=>key==='defaultGlobalLight'?true:0},folders:[{id:'root',name:'SceneTools',type:'Scene'},{id:'folder',name:'Modular Scenes',type:'Scene',folder:{id:'root'}}]};
  globalThis.HTMLVideoElement = class {};
  globalThis.Image = class {naturalWidth=1000;naturalHeight=1000;set src(path){if(path.includes('wrong'))this.naturalWidth=500;queueMicrotask(()=>this.onload?.());}removeAttribute(){}};
  const tile={_id:'tile',id:'tile',x:0,y:0,width:1000,height:1000,rotation:0,texture:{src:'one.png'},flags:{[ID]:{modularCell:{column:0,row:0}}},
    async update(data){Object.assign(this,data);if(data['texture.src'])this.texture.src=data['texture.src'];},async delete(){scene.tiles.splice(scene.tiles.indexOf(this),1);}};
  const scene={width:2000,height:2000,padding:0,flags:{[ID]:{modularScene:{...layout}}},tiles:[tile],updates:[],
    getDimensions:dimensions,
    toObject(){return {width:this.width,height:this.height,padding:this.padding,flags:this.flags,tiles:this.tiles.map(({update,delete:del,...data})=>structuredClone(data)),tokens:this.tokens??[{_id:'actor',x:150,y:250}],walls:this.walls??[{_id:'wall',c:[0,0,100,200]}]};},
    async update(data,options){this.updates.push({data,options});if(data.tokens)this.tokens=data.tokens;if(data.walls)this.walls=data.walls;if(data.width)this.width=data.width;if(data.height)this.height=data.height;if(data.flags)this.flags=structuredClone(data.flags);else if(data[`flags.${ID}.modularScene`])this.flags[ID].modularScene=data[`flags.${ID}.modularScene`];if(data.tiles)for(const value of data.tiles)Object.assign(this.tiles.find(t=>t._id===value._id),value);},
    async createEmbeddedDocuments(type,rows){assert.equal(type,'Tile');this.tiles.push(...rows.map(row=>({...row,_id:row._id??row.id??'new-tile',id:row._id??row.id??'new-tile'})));},
    async deleteEmbeddedDocuments(type,ids){assert.equal(type,'Tile');this.tiles=this.tiles.filter(tile=>!ids.includes(tile.id));}
  };
  return {scene,tile};
}
test('all four expansions add one complete row or column with correct translation',()=>{
  for(const [direction,columns,rows,dx,dy] of [['north',2,3,0,1000],['south',2,3,0,0],['west',3,2,1000,0],['east',3,2,0,0]])assert.deepEqual(expandLayout(layout,direction),{layout:{...layout,columns,rows},dx,dy});
  assert.deepEqual(layout,{version:1,width:1000,height:1000,columns:2,rows:2});
});
test('name-only scene creation needs no image and uses the requested folder',async()=>{
  setup();let created;globalThis.Scene={create:async data=>(created=data)};
  await createNamedModularScene('Test named scene');
  assert.equal(created.name,'Test named scene');assert.equal(created.folder,'folder');assert.deepEqual(created.tiles,[]);
  assert.equal(created.flags[ID].modularScene.awaitingFirstTile,true);
});
test('first placed tile sizes a named scene and enables later expansion',async()=>{
  const {scene}=setup();scene.tiles=[];scene.flags[ID].modularScene={version:1,width:2000,height:2000,columns:1,rows:1,awaitingFirstTile:true};
  await assert.rejects(expandModularScene(scene,'east'),/first tile/);
  await placeModularTile(scene,0,0,'first.png');
  assert.equal(scene.width,1000);assert.equal(scene.height,1000);assert.equal(scene.flags[ID].modularScene.awaitingFirstTile,false);
  await expandModularScene(scene,'east');assert.equal(scene.width,2000);
});
test('shrink removes each edge and never removes the final row or column',()=>{
  for(const [direction,columns,rows,dx,dy] of [['north',2,1,0,-1000],['south',2,1,0,0],['west',1,2,-1000,0],['east',1,2,0,0]])assert.deepEqual(shrinkLayout(layout,direction),{layout:{...layout,columns,rows},dx,dy});
  for(const direction of ['north','south','east','west'])assert.throws(()=>shrinkLayout({...layout,rows:1,columns:1},direction),/at least one/);
});
test('removed-edge warning includes native overlapping tiles and excludes touching boundaries',()=>{
  const source={tiles:[{_id:'west',x:0,y:0,width:1000,height:1000,rotation:90},{_id:'east',x:1000,y:0,width:1000,height:1000},{_id:'cross',x:950,y:20,width:100,height:100}]};
  assert.deepEqual(tilesInRemovedEdge(source,layout,'west').map(t=>t._id),['west','cross']);
  assert.deepEqual(tilesInRemovedEdge(source,layout,'east').map(t=>t._id),['east','cross']);
});
test('empty edge shrinks immediately while cancelling a populated edge changes nothing',async()=>{
  const {scene}=setup();let confirmations=0;globalThis.Dialog={confirm:async()=>{confirmations++;return false;}};
  await shrinkModularScene(scene,'east');assert.equal(scene.width,1000);assert.equal(confirmations,0);
  assert.equal(await shrinkModularScene(scene,'north'),false);assert.equal(confirmations,1);assert.equal(scene.tiles.length,1);assert.equal(scene.height,2000);
});
test('confirmed shrinking deletes warned tiles and shifts surviving tiles and native contents',async()=>{
  const {scene}=setup();let prompt;globalThis.Dialog={confirm:async options=>{prompt=options;return true;}};
  scene.tiles.push({_id:'keep',id:'keep',x:1000,y:1000,width:1000,height:1000,rotation:0,flags:{[ID]:{modularCell:{column:1,row:1}}}});
  assert.equal(await shrinkModularScene(scene,'west'),true);assert.match(prompt.content,/delete 1 placed tile/);assert.equal(prompt.defaultYes,false);
  assert.equal(scene.tiles.length,1);assert.equal(scene.tiles[0].x,0);assert.equal(cellTile(scene,0,1).id,'keep');assert.equal(scene.tokens[0].x,-850);
});
test('changed scene during warning is rejected before deletion',async()=>{
  const {scene,tile}=setup();globalThis.Dialog={confirm:async()=>{tile.x=5;return true;}};
  await assert.rejects(shrinkModularScene(scene,'west'),/scene changed/);assert.equal(scene.tiles.length,1);assert.equal(scene.width,2000);
});
test('failed resize restores deleted tiles and original dimensions',async()=>{
  const {scene}=setup();globalThis.Dialog={confirm:async()=>true};const update=scene.update.bind(scene);let calls=0;
  scene.update=async(...args)=>{if(!calls++)throw new Error('resize failed');return update(...args);};
  await assert.rejects(shrinkModularScene(scene,'west'),/resize failed/);assert.equal(scene.tiles[0].id,'tile');assert.equal(scene.tiles[0].x,0);assert.equal(scene.width,2000);
});
test('rotation wraps repeatedly and keeps tile centered',()=>{
  for(const angle of [-810,-90,0,90,180,270,360,450,1170]) {
    const g=cellGeometry(layout,1,1,angle);assert.equal(g.x,1000);assert.equal(g.y,1000);assert.equal(g.rotation,((angle%360)+360)%360);
  }
  const g=cellGeometry({...layout,width:2000},1,1,90);
  assert.equal(g.width/g.height,2);assert.equal(g.x+g.width/2,3000);assert.equal(g.y+g.height/2,1500);assert.ok(g.width<=layout.height);
});
test('invalid cells and excessive scene sizes are rejected before edits',()=>{
  for(const value of [null,{...layout,version:2},{...layout,width:NaN},{...layout,rows:-1},{...layout,columns:50},{...layout,rows:21,columns:21}])assert.throws(()=>validateLayout(value));
  for(const [x,y] of [[-1,0],[2,0],[0,2],[0.5,0]])assert.throws(()=>cellGeometry(layout,x,y));
  assert.throws(()=>expandLayout(layout,'diagonal'));
});
test('translation preserves all native content and does not mutate source',()=>{
  const source={initial:{x:10,y:20,scale:1},walls:[{_id:'w',c:[1,2,3,4],door:1}],regions:[{_id:'r',behaviors:[{type:'trap'}],shapes:[{type:'polygon',points:[0,0,100,100],hole:true},{type:'rectangle',x:5,y:6,width:10,height:20},{type:'ellipse',x:10,y:12,radiusX:10,radiusY:10}]}]};
  for(const key of ['tokens','tiles','lights','sounds','notes','templates','drawings'])source[key]=[{_id:key,x:10,y:20,flags:{keep:true},shape:{points:[0,0,1,1]}}];
  const before=structuredClone(source), moved=translateContents(source,1000,2000);
  assert.deepEqual(source,before);
  for(const key of ['tokens','tiles','lights','sounds','notes','templates','drawings'])assert.deepEqual(moved[key][0],{...source[key][0],x:1010,y:2020});
  assert.deepEqual(moved.walls[0].c,[1001,2002,1003,2004]);assert.deepEqual(moved.regions[0].shapes[0].points,[1000,2000,1100,2100]);
  assert.equal(moved.regions[0].shapes[1].x,1005);assert.equal(moved.regions[0].shapes[2].y,2012);assert.deepEqual(moved.initial,{x:1010,y:2020,scale:1});
  assert.throws(()=>translateContents({regions:[{shapes:[{type:'future'}]}]},1,1),/Cannot safely shift/);
});
test('scene expansion saves resize, shifted contents and cell flags in one native update',async()=>{
  const {scene,tile}=setup();await expandModularScene(scene,'west');
  assert.equal(scene.updates.length,1);assert.deepEqual(scene.updates[0].options,{autoReposition:false});assert.equal(scene.width,3000);assert.equal(tile.x,1000);assert.equal(cellTile(scene,1,0),tile);
  assert.equal(scene.updates[0].data.tokens[0].x,1150);assert.deepEqual(scene.updates[0].data.walls[0].c,[1000,0,1100,200]);
  await expandModularScene(scene,'north');assert.equal(tile.y,1000);assert.equal(cellTile(scene,1,1),tile);
});
test('mixed collection placement replaces only selected tile and preserves its rotation',async()=>{
  const {scene,tile}=setup();await rotateModularTile(scene,0,0,-90);await placeModularTile(scene,0,0,'collection-two/hall.png');
  assert.equal(scene.tiles.length,1);assert.equal(tile.rotation,270);assert.equal(tile.texture.src,'collection-two/hall.png');
  await placeModularTile(scene,1,1,'collection-three/room.png');assert.equal(scene.tiles.length,2);assert.equal(cellTile(scene,1,1).x,1000);assert.equal(cellTile(scene,1,1).locked,true);
  await removeModularTile(scene,0,0);assert.equal(scene.tiles.length,1);
});
test('dimension mismatch, modified scene bounds, and non-GMs cannot mutate scene',async()=>{
  const {scene,tile}=setup();await assert.rejects(placeModularTile(scene,0,0,'wrong.png'),/500 × 1000/);assert.equal(tile.texture.src,'one.png');
  scene.width=2100;await assert.rejects(expandModularScene(scene,'east'),/outside the creator/);scene.width=2000;
  game.user.isGM=false;await assert.rejects(rotateModularTile(scene,0,0,90),/Only a GM/);game.user.isGM=true;game.users.activeGM.id='other';await assert.rejects(expandModularScene(scene,'east'),/active GM/);assert.equal(scene.updates.length,0);
});
test('create produces a blank native scene sized from a tile and correct folder',async()=>{
  setup();let created;globalThis.Scene={create:async data=>(created=data)};
  await createModularScene(' Pizza ','first.png',100);
  assert.equal(created.name,'Pizza');assert.equal(created.folder,'folder');assert.equal(created.width,1000);assert.equal(created.height,1000);assert.equal(created.padding,0.15);assert.equal(created.active,false);assert.equal(created.navigation,false);assert.equal(created.tiles.length,0);
  await assert.rejects(createModularScene('','first.png',100),/name/);await assert.rejects(createModularScene('X','first.png',0),/Grid size/);
});
test('failed native updates propagate without advancing layout',async()=>{
  const {scene}=setup();scene.update=async()=>{throw new Error('write failed');};await assert.rejects(expandModularScene(scene,'east'),/write failed/);assert.equal(scene.flags[ID].modularScene.columns,2);
});
test('silently cancelled native writes are reported as failures',async()=>{
  const {scene,tile}=setup();
  tile.update=async()=>undefined;
  await assert.rejects(rotateModularTile(scene,0,0,90),/did not save/);
  await assert.rejects(placeModularTile(scene,0,0,'other.png'),/did not save/);
  scene.createEmbeddedDocuments=async()=>[];
  await assert.rejects(placeModularTile(scene,1,1,'other.png'),/did not save/);
  tile.delete=async()=>undefined;
  await assert.rejects(removeModularTile(scene,0,0),/did not remove/);
  scene.update=async()=>undefined;
  await assert.rejects(expandModularScene(scene,'east'),/did not save/);
});




for(const direction of ['north','south','east','west']) test('padded expansion and shrink preserve playable-relative geometry: '+direction,async()=>{
 const {scene,tile}=setup();scene.padding=.15;tile.x=300;tile.y=300;
 scene.tokens=[{_id:'actor',x:450,y:550}];scene.walls=[{_id:'wall',c:[300,300,400,500]}];
 await expandModularScene(scene,direction);
 const column=direction==='west'?1:0,row=direction==='north'?1:0,origin=scene.getDimensions();
 assert.equal(tile.x,origin.sceneX+column*1000);assert.equal(tile.y,origin.sceneY+row*1000);assert.equal(cellTile(scene,column,row),tile);
 await rotateModularTile(scene,column,row,90);await placeModularTile(scene,column,row,'replacement.png');
 assert.equal(tile.x,origin.sceneX+column*1000);assert.equal(tile.y,origin.sceneY+row*1000);assert.equal(tile.width,1000);
 globalThis.Dialog={confirm:async()=>{throw new Error('Empty edge must not warn');}};
 await shrinkModularScene(scene,direction);
 assert.equal(scene.width,2000);assert.equal(scene.height,2000);assert.equal(scene.padding,.15);
 assert.equal(tile.x,300);assert.equal(tile.y,300);assert.equal(cellTile(scene,0,0),tile);
 assert.deepEqual(scene.tokens,[{_id:'actor',x:450,y:550}]);assert.deepEqual(scene.walls,[{_id:'wall',c:[300,300,400,500]}]);
});
test('padded edge warning uses playable area',async()=>{
 const {scene,tile}=setup();scene.padding=.15;tile.x=1300;tile.y=300;tile.flags[ID].modularCell.column=1;
 globalThis.Dialog={confirm:async options=>{assert.match(options.content,/delete 1 placed tile/);return false;}};
 assert.equal(await shrinkModularScene(scene,'east'),false);assert.equal(tile.x,1300);
});
test('first tile sizes playable area and shifts existing contents with origin',async()=>{
 const {scene}=setup();scene.padding=.15;scene.tiles=[];scene.flags[ID].modularScene={version:1,width:2000,height:2000,columns:1,rows:1,awaitingFirstTile:true};scene.tokens=[{_id:'actor',x:450,y:550}];
 await placeModularTile(scene,0,0,'first.png');
 assert.equal(scene.width,1000);assert.equal(scene.height,1000);assert.equal(scene.padding,.15);
 assert.equal(scene.tiles[0].x,200);assert.equal(scene.tiles[0].y,200);assert.equal(scene.tiles[0].width,1000);
 assert.deepEqual(scene.tokens,[{_id:'actor',x:350,y:450}]);
});

test('undo keeps exactly one action and restores padded expansion',async()=>{
 const {scene,tile}=setup();scene.padding=.15;tile.x=300;tile.y=300;
 await recordModularEdit(scene,()=>rotateModularTile(scene,0,0,90));
 await recordModularEdit(scene,()=>expandModularScene(scene,'west'));
 assert.equal(canUndoModular(scene),true);await undoModularEdit(scene);
 assert.equal(scene.width,2000);assert.equal(tile.x,300);assert.equal(tile.rotation,90);
 assert.equal(canUndoModular(scene),false);await assert.rejects(undoModularEdit(scene),/No undo/);
});
test('undo restores removed edge tiles and original native contents',async()=>{
 const {scene}=setup();globalThis.Dialog={confirm:async()=>true};const before=structuredClone(scene.toObject());
 await recordModularEdit(scene,()=>shrinkModularScene(scene,'west'));
 assert.equal(scene.tiles.length,0);await undoModularEdit(scene);
 assert.deepEqual(scene.toObject(),before);
});
test('undo placement restores blank first-tile sizing state',async()=>{
 const {scene}=setup();scene.tiles=[];scene.flags[ID].modularScene={version:1,width:2000,height:2000,columns:1,rows:1,awaitingFirstTile:true};
 const before=structuredClone(scene.toObject());await recordModularEdit(scene,()=>placeModularTile(scene,0,0,'first.png'));
 await undoModularEdit(scene);assert.deepEqual(scene.toObject(),before);
});
test('cancelled and failed edits retain previous undo; external changes invalidate it',async()=>{
 const {scene,tile}=setup();await recordModularEdit(scene,()=>rotateModularTile(scene,0,0,90));
 globalThis.Dialog={confirm:async()=>false};await recordModularEdit(scene,()=>shrinkModularScene(scene,'west'));
 await assert.rejects(recordModularEdit(scene,()=>placeModularTile(scene,0,0,'wrong.png')),/500/);
 assert.equal(canUndoModular(scene),true);tile.x+=10;assert.equal(canUndoModular(scene),false);
 await assert.rejects(undoModularEdit(scene),/No undo/);assert.equal(tile.x,10);
});
test('undo replacement restores previous texture and rotation',async()=>{
 const {scene,tile}=setup();await recordModularEdit(scene,()=>placeModularTile(scene,0,0,'replacement.png'));
 await undoModularEdit(scene);assert.equal(tile.texture.src,'one.png');assert.equal(tile.rotation,0);
});

test('undo preserves unrelated scene flags and rolls back a failed restore',async()=>{
 const {scene,tile}=setup();scene.flags.otherModule={keep:true};
 await recordModularEdit(scene,()=>rotateModularTile(scene,0,0,90));
 const update=scene.update.bind(scene);let fail=true;
 scene.update=async(...args)=>{if(fail){fail=false;throw new Error('save failed');}return update(...args);};
 await assert.rejects(undoModularEdit(scene),/save failed/);assert.equal(tile.rotation,90);
 assert.equal(canUndoModular(scene),true);await undoModularEdit(scene);
 assert.equal(tile.rotation,0);assert.deepEqual(scene.flags.otherModule,{keep:true});
});
