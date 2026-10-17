import test from "node:test";
import assert from "node:assert/strict";
import {environment, makeScene, applyChanges} from "./netarch/helpers.mjs";
import {DEFAULT_VEHICLE_PIVOT, vehiclePivot, vehiclePivotPosition, pivotedVehicleRotation} from "../dist/scripts/vehicle-rotation-geometry.js";
import {getVehiclePose, isVehicleToken, prepareVehicleRotation, turnVehicle} from "../dist/scripts/vehicle-rotation.js";

const ID = "pneuma-scenetools";
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
function setup() {
  environment();const scene = makeScene();scene.grid.type=0;
  const token={id:"vehicle",uuid:"Scene.scene.Token.vehicle",parent:scene,isOwner:true,lockRotation:false,
    x:100,y:200,width:2,height:3,rotation:0,flags:{[ID]:{CreatedByVehicleTools:true,vehicleFootprint:{width:2,height:3}}},
    object:{getSize:()=>({width:token.width*scene.grid.size,height:token.height*scene.grid.size}),checkCollision:()=>false},writes:[],
    async update(change,options={}) {
      if(prepareVehicleRotation(this,change,options,game.user.id)===false)return;
      this.writes.push(structuredClone(change));applyChanges(this,change);return this;
    },
  };
  scene.tokens.set(token.id,token);return token;
}

test("2x3 padded footprint turns around rear axle without swapping or stretching dimensions",()=>{
  const pose={x:100,y:200,width:200,height:300,rotation:0};
  const result=pivotedVehicleRotation(pose,DEFAULT_VEHICLE_PIVOT,90);
  assert.deepEqual(result,{x:175,y:275,rotation:90});
  assert.deepEqual(vehiclePivotPosition(pose,DEFAULT_VEHICLE_PIVOT),vehiclePivotPosition({...pose,...result},DEFAULT_VEHICLE_PIVOT));
});

test("clockwise, counterclockwise, wraparound, and repeated revolutions keep custom artwork pivot stationary",()=>{
  for(const pivot of [{x:0.5,y:0.75},{x:0.25,y:0.5},{x:0.5,y:0.5},{x:0.12,y:0.81}]) {
    let pose={x:123.25,y:456.75,width:200,height:300,rotation:355};
    const anchor=vehiclePivotPosition(pose,pivot),start={...pose};
    for(let i=0;i<144;i++) {
      pose={...pose,...pivotedVehicleRotation(pose,pivot,pose.rotation+5)};
      const current=vehiclePivotPosition(pose,pivot);close(current.x,anchor.x);close(current.y,anchor.y);
    }
    close(pose.x,start.x);close(pose.y,start.y);close(pose.rotation,start.rotation);
    for(let i=0;i<48;i++)pose={...pose,...pivotedVehicleRotation(pose,pivot,pose.rotation-15)};
    close(pose.x,start.x);close(pose.y,start.y);close(pose.rotation,start.rotation);
  }
});

test("invalid stored pivots use safe defaults and invalid geometry is rejected",()=>{
  for(const pivot of [undefined,null,{}, {x:NaN,y:0.4},{x:-1,y:2},{x:"0.5",y:0.5}]) assert.deepEqual(vehiclePivot(pivot),DEFAULT_VEHICLE_PIVOT);
  assert.deepEqual(vehiclePivot({x:0,y:1}),{x:0,y:1});
  assert.throws(()=>pivotedVehicleRotation({x:0,y:0,width:0,height:100,rotation:0},DEFAULT_VEHICLE_PIVOT,90));
});

test("only scene tokens carrying vehicle template provenance receive pivot rotation",()=>{
  const token=setup();assert.equal(isVehicleToken(token),true);
  const rotation={rotation:90};prepareVehicleRotation(token,rotation,{},game.user.id);
  assert.deepEqual(rotation,{rotation:90,x:125,y:325,width:3,height:2,[`flags.${ID}.vehicleFootprint`]:{width:2,height:3}});assert.equal(token.x,100);
  for(const flags of [{},{[ID]:{CreatedByMookMaker:true}},{[ID]:{CreatedByVehicleTools:"true"}}]) {
    token.flags=flags;const change={rotation:90};prepareVehicleRotation(token,change,{},game.user.id);assert.deepEqual(change,{rotation:90});
  }
  token.flags={[ID]:{CreatedByVehicleTools:true,vehicleFootprint:{width:2,height:3}}};token.parent={documentName:"Actor"};assert.equal(isVehicleToken(token),false);
});

test("explicit moves, Undo, locked rotations, remote calls, and non-owners are untouched; resizing saves artwork size",()=>{
  const token=setup();
  for(const change of [{rotation:90,width:3},{rotation:90,height:2},{x:500},{rotation:90,lockRotation:true}]) {
    const original={...change};prepareVehicleRotation(token,change,{},game.user.id);
    if(change.width!==undefined||change.height!==undefined)original[`flags.${ID}.vehicleFootprint`]={width:change.height??token.height,height:change.width??token.width};
    assert.deepEqual(change,original);
  }
  for(const [key,value,options,userId] of [["lockRotation",true,{},game.user.id],["isOwner",false,{},game.user.id],["lockRotation",false,{isUndo:true},game.user.id],["lockRotation",false,{},"remote"]]) {
    const original=token[key];token[key]=value;const change={rotation:90};prepareVehicleRotation(token,change,options,userId);assert.deepEqual(change,{rotation:90});token[key]=original;
  }
});

test("normal player wall collision blocks the turn without changing the document; GM can place freely",()=>{
  const token=setup();game.user.isGM=false;let destination;
  token.object.checkCollision=(point)=>{destination=point;return true;};
  const change={rotation:90};assert.equal(prepareVehicleRotation(token,change,{},game.user.id),false);
  assert.deepEqual(change,{rotation:90});assert.deepEqual(destination,{x:275,y:425});
  game.user.isGM=true;prepareVehicleRotation(token,change,{},game.user.id);assert.equal(change.x,125);
});

test("rapid HUD clicks accumulate from persisted state, and a failed write does not poison the queue",async()=>{
  const token=setup();await Promise.all([turnVehicle(token,15),turnVehicle(token,15),turnVehicle(token,-5)]);
  assert.equal(token.rotation,25);assert.equal(token.writes.length,3);
  const anchor=vehiclePivotPosition(getVehiclePose(token),DEFAULT_VEHICLE_PIVOT);close(anchor.x,200);close(anchor.y,425);
  const update=token.update;let fail=true;
  token.update=async function(...args) {if(fail){fail=false;throw Error("write failed");}return update.apply(this,args);};
  const failed=turnVehicle(token,15),retry=turnVehicle(token,15);
  await assert.rejects(failed,/write failed/);await retry;assert.equal(token.rotation,40);
});

test("HUD respects rotation lock, pause, deletion, and ownership",async()=>{
  const token=setup();token.lockRotation=true;await assert.rejects(turnVehicle(token,15),/Unlock/);
  token.lockRotation=false;game.user.isGM=false;game.paused=true;await assert.rejects(turnVehicle(token,15),/paused/);
  game.paused=false;token.isOwner=false;await assert.rejects(turnVehicle(token,15),/own/);
  token.isOwner=true;token.parent.tokens.delete(token.id);await assert.rejects(turnVehicle(token,15),/available/);
  assert.equal(token.writes.length,0);
});

test("inactive square/gridless scenes use their own grid size, not the viewed scene",()=>{
  const token=setup();token.object=null;token.parent.grid.size=80;canvas.scene={grid:{size:250}};
  assert.equal(getVehiclePose(token).width,160);assert.equal(getVehiclePose(token).height,240);
  token.parent.grid.type=0;assert.equal(getVehiclePose(token).height,240);
  token.parent.grid.type=2;assert.throws(()=>getVehiclePose(token),/hex grid/);
});

test('category footprint keeps explicit base dimensions at a diagonal angle',()=>{
 const token=setup();token.parent.grid.type=1;token.rotation=45;token.flags[ID].vehicleFootprint={width:2,height:3};
 const changes={width:4,height:4,['flags.'+ID+'.vehicleFootprint']:{width:2,height:4}};prepareVehicleRotation(token,changes,{},game.user.id);
 assert.deepEqual(changes['flags.'+ID+'.vehicleFootprint'],{width:2,height:4});
});
