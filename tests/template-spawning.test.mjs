globalThis.ImageHelper = {hasImageExtension: path => /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(path)};
globalThis.VideoHelper = {hasVideoExtension: path => /\.(m4v|mp4|ogv|webm)$/i.test(path)};
import test from "node:test";
import assert from "node:assert/strict";
import {environment, makeScene, applyChanges} from "./netarch/helpers.mjs";
globalThis.FormApplication = class {};
const {normalizeCategories, chooseArtworkCategory} = await import("../dist/scripts/token-artwork.js");
const {ensureVehicleTemplate, registerTemplateSpawning} = await import("../dist/scripts/template-spawning.js");
const {ensureSceneToolsFolder, WORLD_FOLDERS} = await import("../dist/scripts/world-folders.js");
const scope = "pneuma-scenetools";
function setup(categories = [{name: "NCPD", folder: "tokens/ncpd", kind: "mook"}]) {
  const env = environment(); game.users.activeGM = game.user; env.values.set("tokenArtworkCategories", categories);
  let dialog;
  globalThis.Dialog = class {constructor(data) {dialog = data;} render() {return this;}};
  foundry.utils.mergeObject = (target, source) => {
    for (const [key,value] of Object.entries(source)) {
      if (value && typeof value === "object" && !Array.isArray(value)) target[key] = foundry.utils.mergeObject(target[key] ?? {}, value);
      else target[key] = value;
    }
    return target;
  };
  const scene = makeScene();const created = [];
  scene.createEmbeddedDocuments = async (_type, data) => {created.push(...data);return data;};
  const source = {_id: "old", actorId: "base", actorLink: false, x: 120, y: 240, texture: {src: "old.png", scaleX: 2}, delta: {system: {example: 12}}, flags: {other: {keep: true}}};
  const token = {...source, parent: scene, toObject: () => structuredClone(source), updateSource(data) {applyChanges(this, data);}};
  const select = () => {dialog.buttons.spawn.callback({find: () => ({val: () => "0"})});dialog.close();};
  return {...env, scene, token, created, select, dialog: () => dialog};
}
test("folder paths normalize and names are unique within each kind", () => {
  assert.deepEqual(normalizeCategories([{kind:"mook", name:" NCPD ", folder:"\\tokens\\ncpd\\*"}]), [{kind:"mook", name:"NCPD", folder:"tokens/ncpd"}]);
  assert.throws(() => normalizeCategories([{kind:"mook",name:"NCPD",folder:""}]), /needs/);
  assert.throws(() => normalizeCategories([{kind:"mook",name:"NCPD",folder:"a"},{kind:"mook",name:"ncpd",folder:"b"}]), /Duplicate/);
  assert.equal(normalizeCategories([{kind:"mook",name:"NCPD",folder:"a"},{kind:"vehicle",name:"NCPD",folder:"b"}]).length, 2);
});
test("native mook creation with categories skips prompts and synchronizes portrait, and linked/remote/already spawned tokens are ignored", async () => {
  const env = setup();const folder = await ensureSceneToolsFolder("Actor",WORLD_FOLDERS.mookTemplates);
  game.actors.set("base",{id:"base",folder});let hook;
  globalThis.Hooks = {on(_name,fn) {hook=fn;}};registerTemplateSpawning();
  assert.equal(hook(env.token,{}, {}, game.user.id),undefined);
  assert.equal(env.dialog(),undefined);assert.equal(env.created.length,0);
  assert.equal(env.token.delta.img,"old.png");assert.equal(env.token.flags[scope].CreatedByMookMaker,true);
  env.token.updateSource = () => {throw Error("unexpected mutation");};
  hook(env.token,{}, {},game.user.id);hook(env.token,{}, {},"remote");
  env.token.actorLink=true;hook(env.token,{}, {},game.user.id);
});
test("vehicle template is native mook with vehicle Item, created only once by active GM", async () => {
  setup([]);await ensureVehicleTemplate();await ensureVehicleTemplate();
  assert.equal(game.actors.size,1);const vehicle=game.actors.contents[0];
  assert.equal(vehicle.prototypeToken.texture.src,"modules/pneuma-scenetools/assets/vehicle-outline.svg");assert.equal(vehicle.type,"mook");assert.equal(vehicle.items[0].type,"vehicle");assert.equal(vehicle.prototypeToken.actorLink,false);
  assert.equal(game.folders.get(vehicle.folder).name,"Vehicle Templates");
  game.user={id:"other",isGM:true};game.actors.clear();await ensureVehicleTemplate();assert.equal(game.actors.size,0);
});
test("vehicle category uses vehicle wording and selection survives native immediate close", async () => {
  const env=setup();const category={kind:"vehicle",name:"Car",folder:"tokens/car"};
  const result=chooseArtworkCategory("vehicle",[category]);assert.equal(env.dialog().title,"What kind of vehicle is this?");
  env.select();assert.deepEqual(await result,category);
});

test('chassis world armor and equipped default copy provision once; existing templates keep custom equipment',async()=>{
 setup([]);await ensureVehicleTemplate();await ensureVehicleTemplate();
 assert.equal(game.items.size,1);const world=game.items.contents[0];assert.equal(world.name,'Armored Chassis (armor)');assert.equal(world.type,'armor');assert.equal(world.system.bodyLocation.sp,13);assert.equal(game.folders.get(world.folder).type,'Item');assert.equal(game.folders.get(world.folder).name,'SceneTools');
 const actor=game.actors.contents[0];const chassis=actor.items.find(item=>item.flags?.[scope]?.armoredChassis);assert.equal(chassis.system.equipped,'equipped');assert.equal(chassis.system.bodyLocation.sp,13);
 actor.items=actor.items.filter(item=>item!==chassis);let writes=0;actor.createEmbeddedDocuments=async(type,data)=>{writes++;actor.items.push(...structuredClone(data));return data;};
 await ensureVehicleTemplate();await ensureVehicleTemplate();assert.equal(writes,0);assert.equal(actor.items.some(item=>item.flags?.[scope]?.armoredChassis),false);
});

test('vehicle drops use the selected car template without opening the Mook artwork prompt',async()=>{
 const env=setup([{kind:'vehicle',name:'SUV',folder:'cars'}]);const folder=await ensureSceneToolsFolder('Actor',WORLD_FOLDERS.vehicleTemplates);game.actors.set('base',{id:'base',folder});let hook;globalThis.Hooks={on(_name,fn){hook=fn;}};registerTemplateSpawning();
 assert.equal(hook(env.token,{}, {},game.user.id),undefined);assert.equal(env.token.flags[scope].CreatedByVehicleTools,true);assert.deepEqual(env.token.flags[scope].vehicleFootprint,{width:1,height:1});assert.equal(env.dialog(),undefined);
});
test('vehicle configuration edits native stats and armor, preserves unrelated values and validates before writing',async()=>{
 const {saveVehicleConfig,vehicleStats}=await import('../dist/scripts/vehicle-config.js');const env=setup([]);const actor={system:{derivedStats:{hp:{value:30,max:50}},stats:{move:{value:6}}},items:[],async update(changes){applyChanges(this,changes);return this;}};
 const armor={type:'armor',flags:{[scope]:{armoredChassis:true}},system:{equipped:'equipped',isBodyLocation:true,bodyLocation:{sp:13,ablation:2}},async update(changes){applyChanges(this,changes);return this;}};actor.items.push(armor);
 Object.assign(env.token,{id:'car',actor,isOwner:true,flags:{[scope]:{CreatedByVehicleTools:true,vehicleFootprint:{width:1,height:1}}}});env.scene.tokens.set('car',env.token);
 const initial=vehicleStats(actor);assert.equal(initial.sp,11);
 await assert.rejects(saveVehicleConfig(env.token,{...initial,sp:20},initial,''),/whole numbers/);assert.equal(armor.system.bodyLocation.sp,13);
 await saveVehicleConfig(env.token,{hp:25,maxHp:60,sp:8,maxSp:13,move:12,seats:0},initial,'');assert.equal(actor.system.derivedStats.hp.value,25);assert.equal(actor.system.stats.move.value,12);assert.equal(armor.system.bodyLocation.ablation,5);
 env.token.isOwner=false;await assert.rejects(saveVehicleConfig(env.token,initial,initial,''),/own/);
});

test('Configure persists Seats and refuses to remove occupied seat positions',async()=>{
 const {saveVehicleConfig,vehicleStats}=await import('../dist/scripts/vehicle-config.js');const env=setup([]);
 const item={type:'vehicle',system:{seats:2},async update(changes){applyChanges(this,changes);return this;}};
 const actor={items:[item],system:{derivedStats:{hp:{value:40,max:40}},stats:{move:{value:6}}}};
 Object.assign(env.token,{id:'car',actor,isOwner:true,flags:{[scope]:{CreatedByVehicleTools:true,vehicleFootprint:{width:1,height:1},vehicleSeats:{image:'old.png',imageWidth:200,imageHeight:300,seats:[{id:'driver'},{id:'rear'}]}}}});env.scene.tokens.set('car',env.token);
 env.scene.tokens.set('passenger',{flags:{[scope]:{vehicleSeat:{vehicleId:'car',seatId:'rear'}}}});
 const initial=vehicleStats(actor);await assert.rejects(saveVehicleConfig(env.token,{...initial,seats:1},initial,''),/Exit affected/);assert.equal(item.system.seats,2);
 env.scene.tokens.delete('passenger');await saveVehicleConfig(env.token,{...initial,seats:1},initial,'');assert.equal(item.system.seats,1);
});

test('vehicle categories validate and apply footprint, art scale and visual seats independently of capacity',async()=>{
 const {vehicleArtworkUpdate}=await import('../dist/scripts/vehicle-config.js');const env=setup([]);env.token.width=2;env.token.height=3;env.token.rotation=90;env.scene.grid.type=1;
 const category={kind:'vehicle',name:'SUV',folder:'cars/suv',width:2,height:4,scale:.8,seatLayout:{image:'sample.png',imageWidth:200,imageHeight:400,seats:[{id:'driver',name:'Driver',x:.3,y:.3},{id:'passenger',name:'Passenger',x:.7,y:.3}]}};
 assert.deepEqual(normalizeCategories([category]),[category]);assert.throws(()=>normalizeCategories([{...category,scale:0}]),/greater than zero/);
 globalThis.loadTexture=async()=>({width:400,height:800});const changes=await vehicleArtworkUpdate(env.token,category,'new.png',1);
 assert.equal(changes.width,4);assert.equal(changes.height,2);assert.equal(changes['texture.scaleX'],.8);assert.equal(changes['delta.img'],'new.png');assert.equal(changes['flags.'+scope+'.vehicleSeats'].imageWidth,400);assert.equal(changes['flags.'+scope+'.vehicleSeats'].seats.length,2);
 await assert.rejects(vehicleArtworkUpdate(env.token,category,'new.png',3),/needs 3/);
});

test("shared artwork classification uses native helpers after removing URL query and fragment", async () => {
 const {listCategoryArtwork}=await import('../dist/scripts/artwork-media.js');
 globalThis.FilePicker={browse:async(source,path,options)=>{
   assert.equal(source,'data');assert.equal(path,'tokens/sample/*');assert.equal(options.wildcard,true);
   return {files:['tokens/a.webp?v=2','tokens/b.webm#preview','tokens/c.txt','tokens/d.PNG']};
 }};
 assert.deepEqual(await listCategoryArtwork('tokens/sample/'),['tokens/a.webp?v=2','tokens/b.webm#preview','tokens/d.PNG']);
});
