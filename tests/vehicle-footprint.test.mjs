import test from "node:test";
import assert from "node:assert/strict";
import {environment, makeScene, applyChanges} from "./netarch/helpers.mjs";
import {getVehiclePose, prepareVehicleRotation} from "../dist/scripts/vehicle-rotation.js";
import {getVehicleBaseSize, resizeVehicleArtwork, registerVehicleArtworkSizing} from "../dist/scripts/vehicle-footprint.js";
import {vehicleFootprintSize, vehicleGridFootprintSize, vehiclePivotPosition} from "../dist/scripts/vehicle-rotation-geometry.js";
const ID="pneuma-scenetools",key=`flags.${ID}.vehicleFootprint`,pivot={x:0.5,y:0.75};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
function setup() {
  environment();const scene=makeScene();scene.grid.type=0;
  const token={id:"vehicle",parent:scene,isOwner:true,x:100,y:200,width:2,height:3,rotation:0,flags:{[ID]:{CreatedByVehicleTools:true,vehicleFootprint:{width:2,height:3}}},texture:{scaleX:1,scaleY:1}};
  token.object={document:token,getSize:()=>({width:token.width*scene.grid.size,height:token.height*scene.grid.size})};
  const mesh={object:token.object};token.object.mesh=mesh;
  const turn=rotation=>{const update={rotation};assert.notEqual(prepareVehicleRotation(token,update,{},game.user.id),false);applyChanges(token,update);return update;};
  const fit=(mode="contain",tw=200,th=300,scaleX=1,scaleY=1)=>{
    let size;
    resizeVehicleArtwork.call(mesh,(w,h,options)=>{
      // Foundry PrimarySpriteMesh.resize's documented fit contract; include non-uniform and mirrored scales.
      let x=w/tw,y=h/th;
      if(mode==="contain")x=y=Math.min(x,y);
      if(mode==="cover")x=y=Math.max(x,y);
      if(mode==="width")y=x;
      if(mode==="height")x=y;
      size={width:tw*x*options.scaleX,height:th*y*options.scaleY};
    },token.width*scene.grid.size,token.height*scene.grid.size,{fit:mode,scaleX,scaleY});
    return size;
  };
  return {token,mesh,turn,fit};
}

test("footprint changes only at the four cardinal cutoffs, including negative and wrapped angles",()=>{
  for(const angle of [0,44.999,135,180,224.999,315,359.999,360,-1])assert.deepEqual(vehicleFootprintSize({width:2,height:3},angle),{width:2,height:3});
  for(const angle of [45,90,134.999,225,270,314.999,-90,450])assert.deepEqual(vehicleFootprintSize({width:2,height:3},angle),{width:3,height:2});
});

test("square-grid sequence stays anchored: 2x3 at 0/15/30, 3x3 at 45, 3x2 at 60/75/90",()=>{
  const {token,turn,fit}=setup();token.parent.grid.type=1;const art=fit();
  for (const [angle,width,height] of [[15,2,3],[30,2,3],[45,3,3],[60,3,2],[75,3,2],[90,3,2],[120,3,2],[135,3,3],[150,2,3],[180,2,3],[225,3,3],[240,3,2],[270,3,2],[315,3,3],[330,2,3],[360,2,3]]) {
    turn(angle);assert.deepEqual({x:token.x,y:token.y,width:token.width,height:token.height},{x:100,y:200,width,height});assert.deepEqual(fit(),art);
  }
});

test("fine turns and reversals have diagonal bands centered on 45 degrees without positional drift",()=>{
  const {token,turn,fit}=setup();token.parent.grid.type=1;const art=fit();
  for(const angle of [30,35,37.49])assert.deepEqual(vehicleGridFootprintSize({width:2,height:3},angle),{width:2,height:3});
  for(const angle of [37.5,40,45,50,52.49,-45])assert.deepEqual(vehicleGridFootprintSize({width:2,height:3},angle),{width:3,height:3});
  for(const angle of [52.5,55,60,90])assert.deepEqual(vehicleGridFootprintSize({width:2,height:3},angle),{width:3,height:2});
  for(let i=0;i<288;i++) {turn(i*5);assert.equal(token.x,100);assert.equal(token.y,200);assert.deepEqual(fit(),art);}
  for(const angle of [60,45,30,45,60,45,30]) {turn(angle);assert.equal(token.x,100);assert.equal(token.y,200);assert.deepEqual(fit(),art);}
});

test("off-grid vehicles snap once; stored artwork size survives a diagonal reload",()=>{
  const {token,turn,fit}=setup();token.parent.grid.type=1;token.x=123.5;token.y=178.7;const art=fit();
  turn(15);assert.equal(token.x,100);assert.equal(token.y,200);turn(45);
  token.flags=JSON.parse(JSON.stringify(token.flags));turn(60);
  assert.equal(token.width,3);assert.equal(token.height,2);assert.equal(token.x,100);assert.equal(token.y,200);assert.deepEqual(fit(),art);
});

test("square-grid collision uses the final snapped footprint center and cancels atomically",()=>{
  const {token,turn}=setup();token.parent.grid.type=1;game.user.isGM=false;
  token.object.checkCollision=()=>{throw Error("small turns should not move the footprint");};turn(15);turn(30);
  let checked;token.object.checkCollision=destination=>{checked=destination;return true;};
  const change={rotation:45};assert.equal(prepareVehicleRotation(token,change,{},game.user.id),false);
  assert.deepEqual(change,{rotation:45});assert.deepEqual(checked,{x:250,y:350});assert.equal(token.rotation,30);
});

test("ticks preserve the axle, physical artwork size, scales and dimensions over repeated full rotations",()=>{
  const {token,turn,fit}=setup();const anchor=vehiclePivotPosition(getVehiclePose(token),pivot),art=fit();
  const start={x:token.x,y:token.y};
  for(let i=1;i<=288;i++) {
    turn(i*5);const next=vehiclePivotPosition(getVehiclePose(token),pivot);
    close(next.x,anchor.x);close(next.y,anchor.y);assert.deepEqual(fit(),art);
    assert.deepEqual({width:token.width,height:token.height},vehicleFootprintSize({width:2,height:3},i*5));
  }
  close(token.x,start.x);close(token.y,start.y);assert.deepEqual(token.texture,{scaleX:1,scaleY:1});
  assert.deepEqual(getVehicleBaseSize(token),{width:2,height:3});
});

test("non-square, square/padded, wide, and mirrored textures retain native fit without size drift",()=>{
  for(const mode of ["contain","cover","fill","width","height"])for(const [w,h] of [[200,300],[512,512],[800,200]]) {
    const {turn,fit}=setup();const original=fit(mode,w,h,-1.25,0.8);
    for(const angle of [44,45,90,135,225,315,0]) {turn(angle);assert.deepEqual(fit(mode,w,h,-1.25,0.8),original);}
  }
});

test("saved base survives reload/copy and grid changes; intentional horizontal resize establishes a new size",()=>{
  const {token,turn,fit}=setup();turn(90);
  const saved=JSON.parse(JSON.stringify({width:token.width,height:token.height,rotation:token.rotation,flags:token.flags}));
  Object.assign(token,saved);assert.deepEqual(getVehicleBaseSize(token),{width:2,height:3});assert.deepEqual(fit(),{width:200,height:300});
  token.parent.grid.size=80;assert.deepEqual(fit(),{width:160,height:240});
  const update={width:6,height:4};prepareVehicleRotation(token,update,{},game.user.id);applyChanges(token,update);
  assert.deepEqual(getVehicleBaseSize(token),{width:4,height:6});assert.deepEqual(fit(),{width:320,height:480});
  turn(180);assert.equal(token.width,4);assert.equal(token.height,6);assert.deepEqual(fit(),{width:320,height:480});
});

test("rotated vehicles use their explicitly saved artwork sizing reference",()=>{
  const {token,turn,fit}=setup();token.rotation=90;const art=fit();const anchor=vehiclePivotPosition(getVehiclePose(token),pivot);
  turn(95);assert.equal(token.width,3);assert.equal(token.height,2);assert.deepEqual(fit(),art);
  const after=vehiclePivotPosition(getVehiclePose(token),pivot);close(after.x,anchor.x);close(after.y,anchor.y);
});

test("vehicles with missing or invalid saved artwork sizes fail instead of guessing",()=>{
  const {token}=setup();
  for(const size of [undefined,{width:0,height:3},{width:2,height:NaN}]) {
    token.flags[ID].vehicleFootprint=size;assert.throws(()=>getVehicleBaseSize(token),/no valid artwork footprint/);
  }
  token.flags={};assert.deepEqual(getVehicleBaseSize(token),{width:2,height:3});
});

test("Undo restores footprint and position without a second swap; explicit move+rotate preserves requested position",()=>{
  const {token,turn}=setup();turn(45);
  const undo={rotation:0,x:100,y:200,width:2,height:3,[key]:{width:2,height:3}},original=structuredClone(undo);
  prepareVehicleRotation(token,undo,{isUndo:true},game.user.id);assert.deepEqual(undo,original);applyChanges(token,undo);
  const change={rotation:90,x:700,y:800};prepareVehicleRotation(token,change,{},game.user.id);
  assert.equal(change.x,700);assert.equal(change.y,800);assert.equal(change.width,3);assert.equal(change.height,2);
});

test("mesh wrapper passes through unrelated tokens, tiles, secondary meshes and hex grids",()=>{
  for(const kind of ["ordinary","mook","tile","secondary","hex"]) {
    const {token,mesh}=setup();
    if(kind==="ordinary")token.flags={};
    if(kind==="mook")token.flags={[ID]:{CreatedByMookMaker:true}};
    if(kind==="tile")mesh.object={};
    if(kind==="secondary")token.object.mesh={};
    if(kind==="hex")token.parent.grid.type=2;
    let received;const options={fit:"contain",scaleX:-0.75,scaleY:1};
    resizeVehicleArtwork.call(mesh,(...args)=>{received=args;},345,678,options);
    assert.deepEqual(received,[345,678,options]);assert.equal(received[2],options);
  }
});

test("registered native resize wrapper retains this, options and the actual saved footprint dimensions",()=>{
  const {token}=setup();globalThis.PrimarySpriteMesh=class {resize(...args){this.received=args;}};
  registerVehicleArtworkSizing();const mesh=new PrimarySpriteMesh();mesh.object=token.object;token.object.mesh=mesh;
  token.flags[ID].vehicleFootprint={width:2,height:3};token.width=3;token.height=2;
  const options={fit:"contain",scaleX:-1,scaleY:1};mesh.resize(300,200,options);
  assert.deepEqual(mesh.received,[200,300,options]);assert.equal(mesh.received[2],options);
});
