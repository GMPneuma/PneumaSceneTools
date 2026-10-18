import test from "node:test";
import assert from "node:assert/strict";
import {environment, makeScene, applyChanges} from "./netarch/helpers.mjs";
import {promoteVehicle} from "../dist/scripts/vehicle-promotion.js";
import {isVehicleToken} from "../dist/scripts/vehicle-rotation.js";
import {templateKind} from "../dist/scripts/template-spawning.js";

const ID = "pneuma-scenetools";
function setup() {
  environment();
  const scene = makeScene();
  const source = {_id:"template",name:"Template",type:"mook",flags:{[ID]:{defaultVehicleTemplate:true}},
    system:{derivedStats:{hp:{value:30,max:50}}},items:[{name:"Vehicle",type:"vehicle",system:{seats:2}}]};
  const data = {_id:"car",actorId:"template",actorLink:false,name:"Crew Car",x:100,y:200,hidden:true,rotation:90,width:3,height:2,
    texture:{src:"car.webp",scaleX:1.5,scaleY:1.5},delta:{system:{}},flags:{[ID]:{
      CreatedByVehicleTools:true,vehicleFootprint:{width:2,height:3},vehiclePivot:{x:.5,y:.75},vehicleArtworkCategory:"cars",
      vehicleSeats:{image:"car.webp",imageWidth:200,imageHeight:300,seats:[{id:"driver",name:"Driver",x:.4,y:.3}]},
      vehicleSeatDefault:{image:"car.webp",imageWidth:200,imageHeight:300,seats:[]},
      patrol:{running:true},vehicleSeat:{vehicleId:"other"}}}};
  const token = {...structuredClone(data),id:"car",parent:scene,isOwner:true,actor:{toObject:()=>structuredClone(source)},
    toObject:()=>structuredClone(data),update:async changes=>{applyChanges(token,changes);return token;}};
  scene.tokens.set(token.id,token);
  const created = [];
  Actor.create = async data => {
    const actor = {...structuredClone(data),id:"permanent",delete:async()=>{actor.deleted=true;}};
    created.push(actor);return actor;
  };
  return {token,source,created,scene};
}

test("promotion retains a functioning vehicle prototype and current actor data without template or scene state", async () => {
  const {token,source,created,scene} = setup();
  await promoteVehicle(token);
  const actor = created[0], prototype = actor.prototypeToken;
  assert.equal(actor.name,"Crew Car");assert.equal(actor.img,"car.webp");
  assert.deepEqual(actor.system,source.system);assert.deepEqual(actor.items,source.items);
  assert.equal(actor.flags[ID].defaultVehicleTemplate,undefined);
  assert.equal(actor.flags[ID].promotedVehicle,true);
  assert.equal(game.folders.get(actor.folder).name,"Promoted Vehicles");
  assert.equal(templateKind(actor),undefined);
  assert.equal(token.actorLink,true);assert.equal(token.actorId,actor.id);
  assert.equal(prototype.actorLink,true);assert.equal(prototype.rotation,90);
  assert.deepEqual(prototype.texture,token.texture);
  for (const key of ["vehicleFootprint","vehiclePivot","vehicleSeats","vehicleSeatDefault","vehicleArtworkCategory"])
    assert.deepEqual(prototype.flags[ID][key],token.flags[ID][key]);
  assert.equal(isVehicleToken({...prototype,parent:scene}),true);
  for (const key of ["_id","delta","actorId","x","y","hidden"]) assert.equal(prototype[key],undefined);
  assert.equal(prototype.flags[ID].patrol,undefined);assert.equal(prototype.flags[ID].vehicleSeat,undefined);
  assert.equal(source.flags[ID].defaultVehicleTemplate,true);
});

test("cancelled linking rolls back the unused Actor", async () => {
  const {token,created} = setup();token.update=async()=>undefined;
  await assert.rejects(promoteVehicle(token),/did not confirm/);
  assert.equal(created[0].deleted,true);assert.equal(token.actorId,"template");
});

test("permission, linked-token, stale-token and duplicate promotion guards", async () => {
  for (const change of [t=>{game.user.isGM=false;},t=>{t.actorLink=true;},t=>{t.parent.tokens.clear();}]) {
    const {token,created}=setup();change(token);
    await assert.rejects(promoteVehicle(token),/owned, unlinked/);assert.equal(created.length,0);
  }
  const {token,created}=setup();
  const first=promoteVehicle(token);
  await assert.rejects(promoteVehicle(token),/already being promoted/);
  await first;assert.equal(created.length,1);
});
