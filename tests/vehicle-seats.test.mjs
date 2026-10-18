globalThis.Token = class {_applyRenderFlags(){}};
import test from "node:test";
import assert from "node:assert/strict";
import {environment, makeScene, makeToken, applyChanges, getPath} from "./netarch/helpers.mjs";
import {snapSeatPosition, assignment, seatPosition, seatLayout, validateSeatLayout} from "../dist/scripts/vehicle-seats-model.js";
import {setPlayerVehicleControl, playersControlVehicle, allowPlayersToUse, executeSeatRequest, exitSeat, syncVehicleSeats, queueSeatWork, registerVehicleSeats, requestSeatAction} from "../dist/scripts/vehicle-seats.js";
const ID="pneuma-scenetools";
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function setup(){
  const env=environment();game.users.activeGM=env.gm;const scene=makeScene();scene.grid.type=1;
  const layout={image:"car.webp",imageWidth:200,imageHeight:300,seats:[{id:"driver",name:"Driver",x:.3,y:.3},{id:"rear",name:"Rear",x:.7,y:.7}]};
  const vehicle=makeToken(scene,"car",{hidden:false,isOwner:true,width:2,height:3,rotation:0,elevation:5,sort:10,texture:{src:"car.webp",scaleX:1,scaleY:1},flags:{[ID]:{CreatedByVehicleTools:true,vehicleFootprint:{width:2,height:3},vehicleSeats:layout}}});
  const rider=makeToken(scene,"rider",{ap:false,isOwner:true,width:1,height:1,rotation:30,elevation:0,sort:2});
  const second=makeToken(scene,"second",{ap:false,isOwner:true,width:1,height:1,rotation:0,elevation:0,sort:1});
  for(const token of [vehicle,rider,second]){
    token.object={checkCollision:()=>false};
    token.canUserModify=user=>user.isGM||user.id==="player";
    token.updateSource=function(changes){for(const [key,value] of Object.entries(changes)){if(key.includes(".-=")){const path=key.split(".-=");delete getPath(this,path[0])?.[path[1]];}else applyChanges(this,{[key]:value});}};
    token.update=async function(changes,options={}){this.updateSource(changes);await Hooks.call("updateToken",this,changes,options,game.user.id);return this;};
  }
  return {...env,scene,vehicle,rider,second,layout};
}
const board=(token,seatId="driver",userId="player")=>executeSeatRequest(token,{id:"request",state:"pending",action:"board",vehicleId:"car",seatId},userId);

test("promoted linked vehicles allow GM player-control changes on their permanent Actor",async()=>{
 const {vehicle}=setup();vehicle.actorLink=true;vehicle.actor.flags={[ID]:{promotedVehicle:true}};
 vehicle.actor.update=async changes=>{applyChanges(vehicle.actor,changes);return vehicle.actor;};
 await allowPlayersToUse(vehicle);assert.equal(vehicle.actor.ownership.default,3);
});

test("GM access grants every player owner permission and rejects player or linked-token grants",async()=>{
 const {vehicle,player}=setup();let changes;vehicle.actor.ownership={default:0,player:1};vehicle.actor.update=async value=>{changes=value;return vehicle.actor;};
 await allowPlayersToUse(vehicle);assert.equal(changes.ownership.default,3);assert.equal(changes.ownership.player,3);assert.equal(changes.ownership.offline,3);
 game.user=player;await assert.rejects(allowPlayersToUse(vehicle),/Only a GM/);game.user=game.users.get("gm");vehicle.actorLink=true;
 await assert.rejects(allowPlayersToUse(vehicle),/Unlink/);
});

test("exits use the nearest seat-side row and fall back over the vehicle when blocked",async()=>{
 let s=setup();await board(s.second,"rear");await exitSeat(s.second);assert.equal(s.second.x,200);assert.equal(s.second.y,200);
 s=setup();await board(s.rider);s.rider.object={checkCollision:point=>point.x===-50&&point.y===50};await exitSeat(s.rider);
 assert.equal(s.rider.x,0);assert.equal(s.rider.y,0);assert.equal(assignment(s.rider),undefined);assert.equal(s.rider.texture.scaleX,1);
 s=setup();await board(s.rider);Object.assign(s.vehicle,{rotation:90,width:3,height:2});await syncVehicleSeats(s.vehicle);await exitSeat(s.rider);
 assert.equal(s.rider.x,200);assert.equal(s.rider.y,-100);
});

test("exits without rendered collision data detach over the vehicle",async()=>{
 for(const offScene of [false,true]){
  const {rider}=setup();await board(rider);
  if(offScene)canvas.scene=makeScene("other");else rider.object=null;
  await exitSeat(rider);assert.equal(rider.x,0);assert.equal(rider.y,0);
  assert.equal(assignment(rider),undefined);assert.equal(rider.texture.scaleX,1);assert.equal(rider.rotation,30);assert.equal(rider.elevation,0);assert.equal(rider.sort,2);
 }
});

test("standard template seats are inherited across artwork with local and image-specific precedence",async()=>{
 const {vehicle,layout}=setup();const actor=game.actors.get(vehicle.actorId);actor.prototypeToken={flags:{}};
 actor.update=async changes=>{applyChanges(actor,changes);return actor;};
 await executeSeatRequest(vehicle,{action:"layout",layout,template:true,templateAllImages:true},"gm");
 const spawned={...vehicle,texture:{...vehicle.texture,src:"another-car.webp"},flags:structuredClone(actor.prototypeToken.flags)};
 assert.equal(seatLayout(spawned).image,"another-car.webp");assert.deepEqual(seatLayout(spawned).seats,layout.seats);
 assert.equal(seatLayout(spawned).imageWidth,200);
 spawned.flags[ID].vehicleSeatLayouts=[{...layout,image:"another-car.webp",seats:[]}];assert.equal(seatLayout(spawned).seats.length,0);
 spawned.flags[ID].vehicleSeats={...layout,image:"another-car.webp"};assert.equal(seatLayout(spawned).seats.length,2);
 assert.equal(vehicle.flags[ID].vehicleSeatDefault,undefined);
});

test("boarding preserves identity, shrinks artwork only, and exit restores original appearance",async()=>{
 const {vehicle,rider}=setup();rider.texture.scaleX=-1.2;rider.texture.scaleY=.8;const actor=rider.actor;
 await board(rider);assert.equal(rider.actor,actor);assert.equal(rider.width,1);assert.equal(rider.texture.scaleX,-.72);assert.equal(rider.elevation,5);assert.equal(rider.sort,11);
 close(rider.x,10);close(rider.y,40);await board(rider);await exitSeat(rider);
 assert.equal(assignment(rider),undefined);assert.equal(rider.texture.scaleX,-1.2);assert.equal(rider.texture.scaleY,.8);assert.equal(rider.rotation,30);assert.equal(rider.elevation,0);assert.equal(rider.sort,2);assert.equal(rider.x,-100);
});
test("serialized competing requests reserve a seat once and allow later work after failure",async()=>{
 const {rider,second}=setup();const results=await Promise.allSettled([queueSeatWork(()=>board(rider)),queueSeatWork(()=>board(second))]);
 assert.equal(results[0].status,"fulfilled");assert.equal(results[1].status,"rejected");assert.match(String(results[1].reason),/occupied/);assert.equal(assignment(second),undefined);
 await queueSeatWork(()=>board(second,"rear"));assert.equal(assignment(second).seatId,"rear");
});
test("rotating square footprints maintain artwork-relative positions including mirror and padding",()=>{
 const {vehicle,layout}=setup();for(const [angle,w,h] of [[0,2,3],[15,2,3],[30,2,3],[45,3,3],[60,3,2],[90,3,2],[180,2,3],[270,3,2]]){
 Object.assign(vehicle,{rotation:angle,width:w,height:h});const p=seatPosition(vehicle,layout,layout.seats[0]),rad=angle*Math.PI/180;
 close(p.x,w*50-40*Math.cos(rad)+60*Math.sin(rad));close(p.y,h*50-40*Math.sin(rad)-60*Math.cos(rad));}
 Object.assign(vehicle,{rotation:0,width:2,height:3});vehicle.texture.scaleX=-1;close(seatPosition(vehicle,layout,layout.seats[0]).x,140);
 const padded={...layout,imageWidth:400,imageHeight:300};close(seatPosition(vehicle,padded,padded.seats[0]).y,120);
});
test("authority, provenance, ownership, pause, hidden vehicles and stale tokens are validated",async()=>{
 let s=setup();await assert.rejects(board(s.rider,"driver","other"),/own/);game.paused=true;await assert.rejects(board(s.rider),/paused/);game.paused=false;
 s.vehicle.hidden=true;await assert.rejects(board(s.rider),/visible/);s.vehicle.hidden=false;delete s.vehicle.flags[ID].CreatedByVehicleTools;await assert.rejects(board(s.rider),/visible/);
 s=setup();game.users.activeGM=undefined;game.user=s.player;await assert.rejects(requestSeatAction(s.rider,{action:"board",vehicleId:"car",seatId:"driver"}),/active GM/);assert.equal(assignment(s.rider),undefined);
 s=setup();s.scene.tokens.delete(s.rider.id);await assert.rejects(board(s.rider),/no longer/);
});
test("vehicle sync updates movement and restores passengers on deletion even when exits blocked",async()=>{
 const {scene,vehicle,rider,second}=setup();await board(rider);await board(second,"rear");vehicle.x=400;vehicle.rotation=90;vehicle.width=3;vehicle.height=2;
 await syncVehicleSeats(vehicle);close(rider.x,560);close(rider.y,10);assert.equal(rider.rotation,30);assert.equal(second.rotation,0);
 rider.object={checkCollision:()=>true};await exitSeat(rider);assert.equal(assignment(rider),undefined);assert.equal(rider.x,600);assert.equal(rider.y,0);scene.tokens.delete(vehicle.id);await syncVehicleSeats(vehicle);
 assert.equal(assignment(rider),undefined);assert.equal(assignment(second),undefined);assert.equal(rider.texture.scaleX,1);
});
test("one failed passenger update does not prevent others from following",async()=>{
 const {vehicle,rider,second}=setup();await board(rider);await board(second,"rear");rider.update=async()=>{throw Error("write failed");};vehicle.x=300;
 await assert.rejects(syncVehicleSeats(vehicle),/write failed/);assert.equal(second.x,390);
});
test("layout validates seats, matches artwork, and protects occupied seats",async()=>{
 const {vehicle,rider,layout}=setup();assert.throws(()=>validateSeatLayout({...layout,seats:[...layout.seats,layout.seats[0]]}),/unique/);
 await board(rider);await assert.rejects(executeSeatRequest(vehicle,{action:"layout",layout:{...layout,seats:[]}},"gm"),/occupied/);
 await assert.rejects(executeSeatRequest(vehicle,{action:"layout",layout:{...layout,image:"wrong"}},"gm"),/image changed/);
 vehicle.texture.src="other.webp";assert.equal(seatLayout(vehicle),undefined);vehicle.flags[ID].vehicleSeatLayouts=[{...layout,image:"other.webp"}];assert.equal(seatLayout(vehicle).image,"other.webp");
});
test("missing vehicles require an explicit Exit; failed boarding leaves no assignment",async()=>{
 let {rider,scene,vehicle}=setup();await board(rider);scene.tokens.delete(vehicle.id);await requestSeatAction(rider,{action:"exit"});assert.equal(assignment(rider),undefined);
 ({rider}=setup());rider.update=async()=>{throw Error("write failed");};await assert.rejects(board(rider),/write failed/);assert.equal(assignment(rider),undefined);
});
test("local GM requests persist only the seat assignment",async()=>{
 const {rider}=setup();registerVehicleSeats();const writes=[];const update=rider.update;rider.update=async(data,options)=>{writes.push(data);return update.call(rider,data,options);};await requestSeatAction(rider,{action:"board",vehicleId:"car",seatId:"driver"});assert.equal(assignment(rider).seatId,"driver");
 await requestSeatAction(rider,{action:"exit"});assert.equal(assignment(rider),undefined);
});

test('fractional seats converge after one persisted sync even when prepared coordinates differ',async()=>{
 const {vehicle,rider,layout}=setup();layout.seats[0].x=.33333;layout.seats[0].y=.45678;vehicle.rotation=15;
 await board(rider);assert.ok(Number.isInteger(rider.x));assert.ok(Number.isInteger(rider.y));
 rider._source={x:rider.x,y:rider.y,rotation:rider.rotation,elevation:rider.elevation,sort:rider.sort,texture:{...rider.texture}};
 rider.x+=.25;rider.y+=.25;let writes=0;rider.update=async()=>{writes++;};
 for(let i=0;i<20;i++)await syncVehicleSeats(vehicle);assert.equal(writes,0);
});

test('unrelated token and user updates never scan seats; geometry scans once and deletion cleans up',async()=>{
 const {vehicle,rider,scene}=setup();registerVehicleSeats();await board(rider);await queueSeatWork(async()=>{});
 let scans=0;const filter=scene.tokens.filter.bind(scene.tokens);scene.tokens.filter=fn=>{scans++;return filter(fn);};
 for(const token of [vehicle,rider])for(const changes of [{name:'Name'},{'delta.system.derivedStats.hp.value':20},{flags:{'pneuma-combattools':{movement:{spent:4}}}},{'flags.pneuma-scenetools.vehicleSeatRequest':{state:'done'}}])await Hooks.call('updateToken',token,changes,{},'gm');
 await Hooks.call('updateUser',game.user,{color:'#fff'});await queueSeatWork(async()=>{});assert.equal(scans,0);
 await Hooks.call('updateToken',vehicle,{rotation:15},{},'gm');await queueSeatWork(async()=>{});assert.equal(scans,1);
 scans=0;await Hooks.call('updateToken',rider,{x:123},{vehicleSeats:true},'gm');await queueSeatWork(async()=>{});assert.equal(scans,0);
 scene.tokens.delete(vehicle.id);await Hooks.call('deleteToken',vehicle);await queueSeatWork(async()=>{});assert.equal(assignment(rider),undefined);
});
test('render wrapper ignores bars and effects before looking up any seat state',()=>{
 setup();registerVehicleSeats();const token=new Token();let reads=0;Object.defineProperty(token,'document',{get(){reads++;return {};}});
 for(const flags of [{refreshBars:true},{refreshEffects:true},{refreshTarget:true},{refreshNameplate:true}])token._applyRenderFlags(flags);
 assert.equal(reads,0);token._applyRenderFlags({refreshPosition:true});assert.ok(reads>0);
});
test('seat change filters accept dotted, nested and deletion updates without matching request flags',async()=>{
 const {changesSeatFields,VEHICLE_SEAT_FIELDS,PASSENGER_SEAT_FIELDS}=await import('../dist/scripts/vehicle-seat-changes.js');
 for(const changes of [{texture:{scaleX:2}},{'texture.scaleY':2},{flags:{'pneuma-scenetools':{'-=vehicleSeats':null}}},{'flags.pneuma-scenetools.vehicleSeatDefault.seats':[]}])assert.equal(changesSeatFields(changes,VEHICLE_SEAT_FIELDS),true);
 assert.equal(changesSeatFields({'flags.pneuma-scenetools.vehicleSeatRequest.state':'done'},PASSENGER_SEAT_FIELDS),false);
 assert.equal(changesSeatFields({texture:{tint:'#fff'}},VEHICLE_SEAT_FIELDS),false);
});

test('vehicle seat count limits usable markers and zero seats prevents boarding',async()=>{
 const {vehicle,rider,second}=setup();vehicle.actor.items.set('vehicle-stats',{type:'vehicle',system:{seats:1}});
 await assert.rejects(board(rider,'rear'),/capacity/);await board(rider);await assert.rejects(board(second,'rear'),/capacity/);
 await exitSeat(rider);vehicle.actor.items.get('vehicle-stats').system.seats=0;await assert.rejects(board(rider),/capacity/);
});

test("seat alignment snaps each axis within five percentage points",()=>{
 const seats=[{id:'a',x:.45,y:.65},{id:'moving',x:.9,y:.9}];
 for (const x of [.40,.43,.50]) assert.deepEqual(snapSeatPosition({x,y:.2},seats,'moving'),{x:.45,y:.2});
 for (const y of [.60,.63,.70]) assert.deepEqual(snapSeatPosition({x:.1,y},seats,'moving'),{x:.1,y:.65});
 assert.deepEqual(snapSeatPosition({x:.40,y:.70},seats,'moving'),{x:.45,y:.65});
 assert.deepEqual(snapSeatPosition({x:.399,y:.701},seats,'moving'),{x:.399,y:.701});
 assert.deepEqual(snapSeatPosition({x:.89,y:.89},seats,'moving'),{x:.89,y:.89});
 assert.deepEqual(snapSeatPosition({x:.465,y:.2},[...seats,{id:'b',x:.47,y:.3}],undefined),{x:.47,y:.2});
});

test('GM control toggle removes player access while preserving GM ownership',async()=>{
 const {vehicle,player}=setup();vehicle.actor.ownership={default:0,player:1,gm:3};
 CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE=0;
 vehicle.actor.update=async changes=>{Object.assign(vehicle.actor,changes);return vehicle.actor;};
 assert.equal(playersControlVehicle(vehicle),false);
 await setPlayerVehicleControl(vehicle,true);assert.equal(playersControlVehicle(vehicle),true);
 await setPlayerVehicleControl(vehicle,false);assert.equal(playersControlVehicle(vehicle),false);
 assert.deepEqual(vehicle.actor.ownership,{default:0,player:0,gm:3,other:0,offline:0});
 game.user=player;await assert.rejects(setPlayerVehicleControl(vehicle,false),/Only a GM/);
 game.user=game.users.get('gm');vehicle.actor.update=async()=>undefined;
 await assert.rejects(setPlayerVehicleControl(vehicle,true),/cancelled/);
});

test('switching seats preserves original appearance and rejects occupied destinations',async()=>{
 const {rider,second}=setup();await board(rider);const original=structuredClone(assignment(rider).original);
 await board(second,'rear');await assert.rejects(board(rider,'rear'),/already occupied/);
 assert.equal(assignment(rider).seatId,'driver');await exitSeat(second);
 await board(rider,'rear');assert.equal(assignment(rider).seatId,'rear');
 assert.deepEqual(assignment(rider).original,original);assert.equal(rider.texture.scaleX,.6);
 await exitSeat(rider);assert.equal(rider.texture.scaleX,original.scaleX);assert.equal(rider.rotation,original.rotation);
});

test('players must be adjacent to enter; GMs and seated riders can operate from anywhere',async()=>{
 let s=setup();s.rider.x=300;s.rider.y=0;
 await assert.rejects(board(s.rider),/adjacent/);assert.equal(assignment(s.rider),undefined);
 s.rider.x=200;await board(s.rider);assert.equal(assignment(s.rider).seatId,'driver');
 s.rider.x=2000;await board(s.rider,'rear');assert.equal(assignment(s.rider).seatId,'rear');
 await executeSeatRequest(s.rider,{action:'exit'},'player');assert.equal(assignment(s.rider),undefined);
 s=setup();s.rider.x=200;s.rider.y=300;await board(s.rider);assert.ok(assignment(s.rider),'Diagonal adjacency qualifies');
 s=setup();s.rider.x=2000;await board(s.rider,'driver','gm');assert.ok(assignment(s.rider),'GM can board remotely');
});

function socketSetup(){
 const f=setup(),packets=[],listeners=new Map();foundry.utils.randomID=()=>crypto.randomUUID();
 game.socket={connected:true,on(name,fn){const list=listeners.get(name)??[];list.push(fn);listeners.set(name,list);},emit(name,packet){packets.push({name,packet:structuredClone(packet)});}};
 registerVehicleSeats();
 const deliver=(packet,user=f.gm)=>{game.user=user;for(const fn of listeners.get('module.'+ID)??[])fn(packet);};
 const until=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await Promise.resolve();}};
 const receive=async(packet,user=f.gm)=>{
   const before=packets.length;deliver(packet,user);
   if(packet.seatType==='request'){
     await until(()=>packets.slice(before).some(p=>p.packet.id===packet.id && ['grant','reply'].includes(p.packet.seatType)));
     const grant=packets.slice(before).find(p=>p.packet.id===packet.id && p.packet.seatType==='grant')?.packet;
     if(grant){
       const ownerStart=packets.length;deliver(grant,f.player);
       await until(()=>packets.slice(ownerStart).some(p=>p.packet.id===packet.id && p.packet.seatType==='complete'));
       const complete=packets.slice(ownerStart).find(p=>p.packet.id===packet.id && p.packet.seatType==='complete')?.packet;
       assert.ok(complete,'The owner must acknowledge its native write');deliver(complete,f.gm);
     }
   }
   await queueSeatWork(async()=>{});await Promise.resolve();
 };
 const requests=()=>packets.filter(p=>p.packet.seatType==='request').map(p=>p.packet);
 const replies=()=>packets.filter(p=>p.packet.seatType==='reply').map(p=>p.packet);
 return {...f,packets,listeners,receive,deliver,requests,replies,until};
}

test('player seat requests round-trip through the GM without request flags',async()=>{
 const f=socketSetup(),writes=[],writers=[];const update=f.rider.update;
 f.rider.update=async(data,options)=>{writes.push(data);writers.push(game.user.id);return update.call(f.rider,data,options);};
 game.user=f.player;const boarding=requestSeatAction(f.rider,{action:'board',vehicleId:f.vehicle.id,seatId:'driver'});
 assert.equal(assignment(f.rider),undefined);assert.equal(writes.length,0);
 await f.receive(f.requests()[0]);assert.equal(assignment(f.rider).seatId,'driver');
 await f.receive(f.replies()[0],f.player);await boarding;
 const exiting=requestSeatAction(f.rider,{action:'exit'});await f.receive(f.requests()[1]);await f.receive(f.replies().at(-1),f.player);await exiting;
 assert.equal(assignment(f.rider),undefined);assert.equal(writes.some(data=>JSON.stringify(data).includes('vehicleSeatRequest')),false);assert.ok(writers.every(user=>user===f.player.id),'Only the owner makes native writes');
});

test('duplicate vehicle messages execute once and cannot replay a completed boarding',async()=>{
 const f=socketSetup();game.user=f.player;const boarding=requestSeatAction(f.rider,{action:'board',vehicleId:'car',seatId:'driver'}),request=f.requests()[0];
 await f.receive(request);await f.receive(request);await f.receive(f.replies()[0],f.player);await boarding;
 game.user=f.gm;await executeSeatRequest(f.rider,{action:'exit'},f.player.id);assert.equal(assignment(f.rider),undefined);
 await f.receive(request);assert.equal(assignment(f.rider),undefined);
 await f.receive({...request,seatId:'rear'});assert.equal(assignment(f.rider),undefined);
});

test('competing socket requests recheck seat availability and reject lost permissions',async()=>{
 const f=socketSetup();game.user=f.player;
 const first=requestSeatAction(f.rider,{action:'board',vehicleId:'car',seatId:'driver'}),second=requestSeatAction(f.second,{action:'board',vehicleId:'car',seatId:'driver'});
 const settled=Promise.allSettled([first,second]);
 for(const request of f.requests())await f.receive(request);
 for(const reply of f.replies())await f.receive(reply,f.player);
 assert.deepEqual((await settled).map(r=>r.status),['fulfilled','rejected']);assert.equal(assignment(f.second),undefined);
 const third=requestSeatAction(f.second,{action:'board',vehicleId:'car',seatId:'rear'});const rejected=assert.rejects(third,/own this token/);
 f.second.canUserModify=()=>false;await f.receive(f.requests().at(-1));await f.receive(f.replies().at(-1),f.player);await rejected;
});

test('vehicle response timeout ignores wrong recipients, tokens and GM replies',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=socketSetup();game.user=f.player;
 const result=requestSeatAction(f.rider,{action:'board',vehicleId:'car',seatId:'driver'}),request=f.requests()[0];
 const rejected=assert.rejects(result,/timed out/);
 for(const change of [{},{user:'other'},{token:'other'},{gm:'other'},{scene:'other'}])await f.receive({...request,seatType:'reply',...change},f.player);
 t.mock.timers.tick(15001);await rejected;assert.equal(assignment(f.rider),undefined);
});

test('GM handoff and disconnect reject transient requests without token writes',async()=>{
 let f=socketSetup();game.user=f.player;const result=requestSeatAction(f.rider,{action:'exit'}),failed=assert.rejects(result,/active GM changed/);
 game.users.activeGM=f.other;await Hooks.call('userConnected',f.other,true);await failed;
 f=socketSetup();game.user=f.player;const next=requestSeatAction(f.rider,{action:'exit'}),disconnected=assert.rejects(next,/Disconnected/);
 for(const fn of f.listeners.get('disconnect')??[])fn();await disconnected;
 assert.equal(assignment(f.rider),undefined);
});


test('another GM can edit vehicle layouts locally while players cannot request layouts',async()=>{
 const f=socketSetup(),gm={id:'second-gm',isGM:true,active:true};game.users.set(gm.id,gm);game.user=gm;
 const layout={...f.layout,seats:f.layout.seats.map(seat=>({...seat,name:'Edited '+seat.name}))};
 await requestSeatAction(f.vehicle,{action:'layout',layout});assert.equal(seatLayout(f.vehicle).seats[0].name,'Edited Driver');assert.equal(f.requests().length,0);
 game.user=f.player;await assert.rejects(requestSeatAction(f.vehicle,{action:'layout',layout}),/Only a GM/);assert.equal(f.requests().length,0);
 game.socket.connected=false;await assert.rejects(requestSeatAction(f.rider,{action:'exit'}),/connected active GM/);assert.equal(f.requests().length,0);
});


test('socket-supplied GM identities cannot make the GM write another token',async()=>{
 const f=socketSetup();f.rider.canUserModify=user=>user.isGM;let writes=0;const update=f.rider.update;
 f.rider.update=async(...args)=>{writes++;return update.apply(f.rider,args);};
 const request={seatType:'request',id:crypto.randomUUID(),user:f.gm.id,gm:f.gm.id,scene:f.scene.id,token:f.rider.id,action:'board',vehicleId:'car',seatId:'driver'};
 f.deliver(request,f.gm);await f.until(()=>f.packets.some(p=>p.packet.seatType==='grant'));
 const grant=f.packets.find(p=>p.packet.seatType==='grant').packet;f.deliver(grant,f.gm);
 assert.equal(writes,0);assert.equal(assignment(f.rider),undefined);
 f.deliver({...grant,seatType:'complete',error:'No local owner request'},f.gm);await queueSeatWork(async()=>{});
 assert.equal(writes,0);
});

test('owner rechecks permission after the GM grants a seat',async()=>{
 const f=socketSetup();game.user=f.player;const boarding=requestSeatAction(f.rider,{action:'board',vehicleId:'car',seatId:'driver'}),failed=assert.rejects(boarding,/own this token/);
 const request=f.requests()[0];f.deliver(request,f.gm);await f.until(()=>f.packets.some(p=>p.packet.seatType==='grant'));
 f.rider.canUserModify=()=>false;f.deliver(f.packets.find(p=>p.packet.seatType==='grant').packet,f.player);
 await f.until(()=>f.packets.some(p=>p.packet.seatType==='complete'));
 f.deliver(f.packets.find(p=>p.packet.seatType==='complete').packet,f.gm);await queueSeatWork(async()=>{});await Promise.resolve();
 await f.receive(f.replies().at(-1),f.player);await failed;assert.equal(assignment(f.rider),undefined);
});
