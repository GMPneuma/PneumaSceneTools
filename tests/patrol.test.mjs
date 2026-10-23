import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validateConfig,findPath,footprint,overlaps,nextStop,sweptHull,segmentInsideHull,regionContainsSweep} from '../dist/scripts/patrol-model.js';
import {patrolOperations,patrolConfig,patrolStatus,destinationClear,routingWorld,savePatrol,tickPatrols,clearPatrolRuntime,registerPatrolRuntime,scenePatrolStopped,setScenePatrolStopped} from '../dist/scripts/patrol-runtime.js';
import {DriveSearch,driveSweeps,driveHull,vehicleWallHull,driveFootprint,findDrivePath,headingDelta,artworkPose,hullsOverlap} from '../dist/scripts/patrol-vehicle.js';
import {prepareVehicleRotation} from '../dist/scripts/vehicle-rotation.js';
const ID='pneuma-scenetools';
const collection=items=>({contents:items,get:id=>items.find(i=>i.id===id)});
const p=(x,y)=>({x,y});
const box=[p(0,0),p(1000,0),p(1000,1000),p(0,1000)];
function setup(){
  clearPatrolRuntime();
  globalThis.foundry={utils:{getProperty:(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o)}};
  globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},paused:false,combats:collection([])};
  const hooks=new Map();globalThis.Hooks={on:(n,fn)=>{const list=hooks.get(n)??[];list.push(fn);hooks.set(n,list);},once(){}};
  const scene={id:'scene',documentName:'Scene',grid:{size:100,type:1},tokens:collection([]),walls:collection([]),regions:collection([{id:'region',name:'Bar'}])};
  const region={bounds:{x:0,y:0,width:1000,height:1000},polygons:[{points:box.flatMap(v=>[v.x,v.y])}],testPoint:q=>q.x>=0&&q.y>=0&&q.x<=1000&&q.y<=1000};
  globalThis.canvas={ready:true,scene,dimensions:{sceneRect:{x:0,y:0,width:1000,height:1000}},regions:{get:id=>id==='region'?region:undefined}};
  registerPatrolRuntime();
  function token(id,x,y,config={}){
    const t={id,uuid:`Scene.scene.Token.${id}`,name:id,parent:scene,x,y,width:1,height:1,elevation:0,actor:{},flags:{[ID]:{patrol:{...defaults(),...config}}},writes:[]};
    t.object={getSize:()=>({width:t.width*100,height:t.height*100})};
    t.update=async(changes,options={})=>{
      if(hooks.get('preUpdateToken')?.some(fn=>fn(t,changes,options)===false))return;
      t.writes.push({changes,options});
      for(const [key,value] of Object.entries(changes)){if(key.startsWith(`flags.${ID}.`))t.flags[ID][key.slice(`flags.${ID}.`.length)]=structuredClone(value);else t[key]=value;}
      hooks.get('updateToken')?.forEach(fn=>fn(t,changes,options));return t;
    };scene.tokens.contents.push(t);return t;
  }
  return {scene,region,token,hooks};
}
test('route traversal loops and reverses without repeating endpoints',()=>{
  let index=0,direction=1;const order=[index];for(let i=0;i<6;i++){({index,direction}=nextStop(index,direction,3,'reverse'));order.push(index);}
  assert.deepEqual(order,[0,1,2,1,0,1,2]);assert.deepEqual(nextStop(2,1,3,'loop'),{index:0,direction:1});
});
test('reject malformed config, invalid pauses, and incomplete enabled routes',()=>{
  assert.throws(()=>validateConfig({...defaults(),enabled:true}));
  assert.throws(()=>validateConfig({...defaults(),speed:Infinity}));
  assert.throws(()=>validateConfig({...defaults(),pauseMin:5,pauseMax:2}));
  assert.throws(()=>validateConfig({...defaults(),mode:'roam',enabled:true}));
  assert.equal(validateConfig(defaults()).enabled,false);
});
test('footprints can touch, but partial overlap and large tokens block stops',()=>{
  assert.equal(overlaps(footprint(p(50,50),100,100),footprint(p(150,50),100,100)),false);
  assert.equal(overlaps(footprint(p(50,50),100,100),footprint(p(149,50),100,100)),true);
  const {token}=setup();const a=token('a',0,0),b=token('b',200,200);b.width=2;
  assert.equal(destinationClear(a,p(350,250)),false);
});
test('swept hull catches short walls enclosed inside token footprint',()=>{
  assert.equal(segmentInsideHull(p(45,45),p(55,55),sweptHull(p(50,50),p(150,50),100,100)),true);
  assert.equal(segmentInsideHull(p(0,0),p(200,0),sweptHull(p(50,50),p(150,50),100,100)),false);
});
test('Region sweep rejects internal holes even when every footprint corner is inside',()=>{
  const hole=[p(45,45),p(55,45),p(55,55),p(45,55)];
  assert.equal(regionContainsSweep(sweptHull(p(50,50),p(50,50),100,100),()=>true,[box,hole]),false);
});
test('A* routes a full token around a wall; closed enclosure has no route',()=>{
  const {scene,token}=setup();const a=token('a',100,100);scene.walls.contents.push({c:[400,0,400,700],move:20,door:0,ds:0});
  const world=routingWorld(a,defaults());const path=findPath(p(150,150),p(750,150),world);
  assert.ok(path);assert.ok(path.some(q=>q.y>=750));let previous=p(150,150);for(const q of path){assert.ok(world.canMove(previous,q));previous=q;}
  scene.walls.contents[0].c=[400,0,400,1000];assert.equal(findPath(p(150,150),p(750,150),routingWorld(a,defaults())),undefined);
});
test('closed doors block, open doors pass, and footprint cannot leave scene',()=>{
  const {scene,token}=setup();const a=token('a',100,100);const wall={c:[400,0,400,1000],move:20,door:1,ds:0};scene.walls.contents.push(wall);
  assert.equal(routingWorld(a,defaults()).canMove(p(150,150),p(750,150)),false);
  wall.ds=1;assert.equal(routingWorld(a,defaults()).canMove(p(150,150),p(750,150)),true);
  assert.equal(routingWorld(a,defaults()).canMove(p(150,150),p(25,150)),false);
});
test('roaming stays wholly in Region and respects elevation through native testPoint',()=>{
  const {token,region}=setup();const a=token('a',100,100);const config={...defaults(),mode:'roam',regionId:'region'};
  assert.equal(routingWorld(a,config).canMove(p(150,150),p(990,150)),false);
  region.testPoint=(point,elevation)=>elevation===10;a.elevation=0;assert.equal(routingWorld(a,config).canMove(p(150,150),p(250,150)),false);
});
test('draft edits do not mutate saved token flags',()=>{
  const {token}=setup();const a=token('a',0,0,{stops:[{x:50,y:50,wait:3}]});patrolConfig(a).stops[0].x=500;assert.equal(patrolConfig(a).stops[0].x,50);
});
const route={enabled:true,pauseMin:1,pauseMax:1,stops:[{x:350,y:150,wait:1},{x:150,y:150,wait:1}]};

test('per-square pauses begin after movement and are optional',async()=>{
  const {token}=setup();
  const a=token('a',100,100,{...route,squareSteps:true,squarePause:0.7});
  await tickPatrols(0);assert.equal(a.x,200);
  await tickPatrols(1000);assert.equal(a.x,200);
  await tickPatrols(1600);assert.equal(a.x,200);assert.equal(patrolStatus(a),'Pausing');
  await tickPatrols(1800);assert.equal(a.x,300);
  for(const squarePause of [-0.1,0.15,Infinity,3601])assert.throws(()=>validateConfig({...defaults(),squarePause}));
  assert.equal(validateConfig({...defaults(),squarePause:0.7}).squarePause,0.7);
  await savePatrol(a,{...patrolConfig(a),squarePause:0,stops:[{x:650,y:150,wait:0},{x:150,y:150,wait:0}]});
  await tickPatrols(2000);assert.equal(a.x,400);
  await tickPatrols(3000);assert.equal(a.x,500);
});

test('square-step routing favors cardinal moves and retains exact diagonals when required',()=>{
  const world={bounds:{x:0,y:0,width:1000,height:1000},step:100,squareSteps:true,canMove:()=>true};
  const start=p(150,150),goal=p(450,550),path=findPath(start,goal,world);
  let previous=start;
  for(const point of path){const dx=Math.abs(point.x-previous.x),dy=Math.abs(point.y-previous.y);assert.ok(dx+dy===100||dx+dy===0);previous=point;}
  assert.deepEqual(path.at(-1),goal);
  const diagonal=findPath(start,p(250,250),{...world,canMove:(a,b)=>a.x===a.y&&b.x===b.y});
  assert.deepEqual(diagonal[0],p(250,250));
  assert.equal(findPath(start,goal,{...world,canMove:(a,b)=>a.x===b.x&&a.y===b.y}),undefined);
});

test('square-step patrol writes full-square steps, snaps destinations, and keeps animation speed',async()=>{
  const {token,scene}=setup();
  const a=token('a',100,100,{...route,squareSteps:true,stops:[{x:462,y:548,wait:0},{x:150,y:150,wait:0}]});
  let previous={x:a.x,y:a.y};
  for(let time=0;time<=14000;time+=2000){
    await tickPatrols(time);
    for(const write of a.writes.splice(0)){
      if(!write.options.patrolMove)continue;
      const dx=Math.abs(write.changes.x-previous.x),dy=Math.abs(write.changes.y-previous.y);
      assert.ok((dx===100&&dy===0)||(dx===0&&dy===100)||(dx===100&&dy===100));
      assert.equal(write.options.animation.duration,Math.hypot(dx,dy)/100*1000);
      previous={x:write.changes.x,y:write.changes.y};
    }
    if(a.x===400&&a.y===500)break;
  }
  assert.deepEqual({x:a.x,y:a.y},{x:400,y:500});
  scene.grid.type=0;
  await assert.rejects(()=>savePatrol(a,patrolConfig(a)),/square grid/);
});
test('only active GM writes movement, with combat and pause gating',async()=>{
  const {token,scene}=setup();const a=token('a',100,100,route);
  game.user.isGM=false;await tickPatrols(0);assert.equal(a.writes.length,0);
  game.user.isGM=true;game.users.activeGM.id='other';await tickPatrols(0);assert.equal(a.writes.length,0);
  game.users.activeGM.id='gm';game.paused=true;await tickPatrols(0);assert.equal(a.writes.length,0);
  game.paused=false;game.combats.contents=[{started:true,scene}];await tickPatrols(0);assert.equal(a.writes.length,0);
  game.combats.contents=[];await tickPatrols(0);assert.ok(a.x>100);assert.equal(a.writes[0].options.animate,true);
});
test('simultaneous patrols reserve destinations and can cross other tokens',async()=>{
  // Check waypoint reservations without random sidetracks reserving intermediate stops.
  const {token}=setup();const stops=[{x:350,y:150,wait:1},{x:550,y:150,wait:1}];const a=token('a',0,100,{...route,stops,mode:'route',sideTracks:false}),b=token('b',0,300,{...route,stops,mode:'route',sideTracks:false});
  await tickPatrols(0);assert.ok(a.writes.length);assert.ok(b.writes.length,'Approach the reserved stop without entering its footprint');assert.equal(destinationClear(b,p(350,150)),false);
  await savePatrol(b,{...patrolConfig(b),stops:[stops[1],stops[0]]});await tickPatrols(250);assert.ok(b.writes.some(write=>write.options.patrolMove));
  assert.equal(destinationClear(b,p(350,150))&&destinationClear(b,p(550,150)),false);
  const c=token('c',150,100);assert.equal(routingWorld(a,defaults()).canMove(p(75,150),p(300,150)),true);assert.equal(destinationClear(a,p(200,150)),false);assert.ok(c);
});
test('route pauses at clear arrival then reverses toward next waypoint',async()=>{
  const {token}=setup();const a=token('a',100,100,{...route,traversal:'reverse'});
  for(let time=0;time<=2000;time+=250)await tickPatrols(time);
  assert.equal(a.x,300);assert.equal(patrolStatus(a),'Pausing');const count=a.writes.length;
  await tickPatrols(2500);assert.equal(a.writes.length,count);await tickPatrols(3250);assert.ok(a.x<300);
});
test('occupied arrival is approached without dwelling on a token',async()=>{
  const {token}=setup();const a=token('a',100,100,{...route,mode:'route',sideTracks:true});const old=Math.random;Math.random=()=>0.99;
  try{await tickPatrols(0);token('blocker',300,100);for(let time=250;time<=10000;time+=250){await tickPatrols(time);if(patrolStatus(a).startsWith("Waiting"))break;}
    assert.notEqual(a.x,300);assert.equal(destinationClear(a,p(a.x+50,a.y+50)),true);
  }finally{Math.random=old;}
});
test('deleted Region and changed walls stop stale paths; no off-scene writes',async()=>{
  const {token,scene}=setup();const a=token('a',100,100,route);await tickPatrols(0);const before=a.x;
  scene.walls.contents.push({c:[200,0,200,1000],move:20,door:0,ds:0});await tickPatrols(300);assert.equal(a.x,before);
  canvas.scene={id:'other',tokens:collection([])};await tickPatrols(600);assert.equal(a.x,before);
  canvas.scene=scene;await savePatrol(a,{...defaults(),mode:'roam',regionId:'region',enabled:true});canvas.regions.get=()=>undefined;
  await tickPatrols(900);assert.equal(a.x,before);assert.match(patrolStatus(a),/Region/);
});
test('manual movement invalidates routes and stop prevents more updates',async()=>{
  const {token}=setup();const a=token('a',100,100,route);await tickPatrols(0);await a.update({x:100,y:500});await tickPatrols(300);assert.ok(a.y<500);
  await savePatrol(a,{...patrolConfig(a),enabled:false});const count=a.writes.length;await tickPatrols(1000);assert.equal(a.writes.length,count);
});
test('no-GM, stale token and seated token starts are rejected or idle',async()=>{
  const {token,scene}=setup();const a=token('a',100,100,route);game.users.activeGM=undefined;await tickPatrols(0);assert.equal(a.writes.length,0);
  a.flags[ID].vehicleSeat={vehicleId:'car'};await assert.rejects(()=>savePatrol(a,{...defaults(),...route}),/Exit the vehicle/);
  scene.tokens.contents.length=0;await assert.rejects(()=>savePatrol(a,defaults()),/existing scene token/);
});
test('cancelled settings writes report failure',async()=>{
  const {token}=setup();const a=token('a',100,100);a.update=async()=>undefined;await assert.rejects(()=>savePatrol(a,{...defaults(),...route}),/not saved/);
});
test('animated document coordinates may lag a saved move without cancelling patrol',async()=>{
  const {token}=setup();const a=token('a',100,100,route);
  a._source={x:100,y:100};
  a.update=async changes=>{a.writes.push(changes);Object.assign(a._source,changes);return a;};
  await tickPatrols(0);
  assert.equal(a._source.x,125);assert.equal(a.x,100);
  assert.equal(patrolStatus(a),'Moving');
  await tickPatrols(300);
  assert.equal(a._source.x,150,'Next segment starts at the committed position, not the lagging animation');
});
test('an actually cancelled move still reports retry when committed coordinates stay unchanged',async()=>{
  const {token}=setup();const a=token('a',100,100,route);a._source={x:100,y:100};a.update=async()=>undefined;
  await tickPatrols(0);assert.equal(patrolStatus(a),'Movement cancelled; retrying');assert.equal(a._source.x,100);
});
test('random roaming selects a reachable free destination and never crosses Region bounds',async()=>{
  const {token}=setup();const a=token('a',100,100,{...defaults(),mode:'roam',regionId:'region',enabled:true,pauseMin:0,pauseMax:0});
  const old=Math.random;let n=0;Math.random=()=>[.7,.6,.3,.4][n++%4];
  try {for(let time=0;time<20000;time+=250){await tickPatrols(time);assert.ok(a.x>=0&&a.y>=0&&a.x+100<=1000&&a.y+100<=1000);}assert.ok(a.writes.length>5);}
  finally{Math.random=old;}
});

test('Region roaming prefers long trips and uses one-second segments without intermediate dwell',async()=>{
  const {token}=setup();const a=token('a',100,100,{mode:'roam',regionId:'region',enabled:true,pauseMin:3,pauseMax:3});
  const old=Math.random;let calls=0;
  // First candidate is close; the remaining candidates are on the far side of the Region.
  Math.random=()=>[.3,.15,...Array.from({length:23},()=>[.85,.15]).flat()][calls++%48];
  try{
    await tickPatrols(0);assert.equal(a.x,200);assert.equal(a.writes[0].options.animation.duration,1000);
    await tickPatrols(250);assert.equal(a.writes.length,1,'Do not restart a running animation');
    for(let time=1000;time<7000;time+=1000){await tickPatrols(time);assert.equal(patrolStatus(a),'Moving');assert.equal(calls,48);}
    assert.equal(a.x,800,'The nearby candidate must not become the stop');
    await tickPatrols(7000);assert.equal(patrolStatus(a),'Pausing');assert.equal(calls,49);
    await tickPatrols(9000);assert.equal(a.writes.length,7,'Saved arrival pause is preserved');
  }finally{Math.random=old;}
});

test('small Regions retain shorter roaming destinations when long trips cannot fit',async()=>{
  const {token,region}=setup();region.bounds={x:0,y:0,width:300,height:300};
  region.testPoint=q=>q.x>=0&&q.y>=0&&q.x<=300&&q.y<=300;
  const a=token('a',0,0,{mode:'roam',regionId:'region',enabled:true});
  const old=Math.random;Math.random=()=>0.75;
  try{await tickPatrols(0);assert.equal(patrolStatus(a),'Moving');assert.ok(a.writes.length);}
  finally{Math.random=old;}
});
test('Region roaming keeps a distant destination across segments and unrelated module flags',async()=>{
  const {token,hooks}=setup();const a=token('a',100,100,{mode:'roam',regionId:'region',enabled:true,pauseMin:3,pauseMax:3});
  const old=Math.random;let calls=0;Math.random=()=>[.8,.2][calls++%2];
  try{
    await tickPatrols(0);assert.equal(calls,48);
    for(let time=250;time<20000;time+=250){
      for(const change of [{flags:{'pneuma-combattools':{movement:{spent:1}}}},{flags:{[ID]:{discovery:true}}},{[`flags.${ID}.pulse`]:1}])hooks.get('updateToken').forEach(fn=>fn(a,change,{}));
      await tickPatrols(time);
      if(patrolStatus(a)==='Pausing')break;
      assert.equal(calls,48,'Walking and unrelated flags must not roll another destination');
    }
    assert.equal(a.x,750);assert.equal(a.y,150);assert.equal(patrolStatus(a),'Pausing');assert.equal(calls,49,'Only the arrival pause rolls after the initial destination');
  }finally{Math.random=old;}
});
test('a new obstruction checks adjacent routes and retains the original Region destination',async()=>{
  const {token,scene}=setup();const a=token('a',100,100,{mode:'roam',regionId:'region',enabled:true,pauseMin:2,pauseMax:2});
  const old=Math.random;let calls=0;Math.random=()=>[.8,.2][calls++%2];
  try{
    await tickPatrols(0);scene.walls.contents.push({c:[400,0,400,500],move:20,door:0,ds:0});
    let detoured=false;
    for(let time=250;time<25000;time+=250){await tickPatrols(time);if(a.y>=500)detoured=true;if(patrolStatus(a)==='Pausing')break;assert.equal(calls,48);}
    assert.ok(detoured);assert.equal(a.x,750);assert.equal(a.y,150);assert.equal(patrolStatus(a),'Pausing');
  }finally{Math.random=old;}
});
test('native movement collision is checked before writes and chooses adjacent clear directions',async()=>{
  const {token}=setup();const a=token('a',100,100,{...route,stops:[{x:750,y:150,wait:2},{x:150,y:150,wait:2}]});
  let checks=0;
  a.object.checkCollision=(b,{origin:a})=>{
    checks++;if((a.x<400&&b.x>=400)||(b.x<400&&a.x>=400)){const t=(400-a.x)/(b.x-a.x);return a.y+t*(b.y-a.y)<650;}return false;
  };
  for(let time=0;time<25000;time+=250){await tickPatrols(time);if(patrolStatus(a)==='Pausing')break;assert.notEqual(patrolStatus(a),'Movement cancelled; retrying');}
  assert.ok(checks>0);assert.equal(a.x,700);assert.equal(a.y,100);assert.equal(patrolStatus(a),'Pausing');
});
test('wandering route keeps its ordered destination without rerolling mid-journey',async()=>{
  const {token}=setup();const a=token('a',100,100,{...route,mode:'route',sideTracks:true,stops:[{x:750,y:150,wait:2},{x:150,y:750,wait:4}]});
  const old=Math.random;let calls=0;Math.random=()=>{calls++;return .99;};
  try{
    for(let time=0;time<10000;time+=250){await tickPatrols(time);if(patrolStatus(a)==='Pausing')break;assert.equal(calls,1);}
    assert.equal(a.x,700);assert.equal(a.y,100);assert.equal(calls,2);assert.equal(patrolStatus(a),'Pausing');
  }finally{Math.random=old;}
});
test('wandering route makes small clear sidetracks but visits 1 then 2 then 3 and only pauses there',async()=>{
  const {token}=setup();const stops=[{x:750,y:150,wait:1},{x:750,y:750,wait:1},{x:150,y:750,wait:1}];
  const a=token('a',100,100,{enabled:true,mode:'route',sideTracks:true,stops,traversal:'loop'});
  const old=Math.random;Math.random=()=>.2;const arrivals=[];let paused=false,detoured=false;
  try{
    for(let time=0;time<60000;time+=250){
      await tickPatrols(time);
      if(!arrivals.length&&a.y!==100)detoured=true;
      if(patrolStatus(a)==='Pausing'){
        if(!paused)arrivals.push({x:a.x+50,y:a.y+50});paused=true;
        if(arrivals.length===3)break;
      }else paused=false;
    }
    assert.ok(detoured,'There should be a sidetrack before stop 1');assert.deepEqual(arrivals,stops.map(({x,y})=>({x,y})));
  }finally{Math.random=old;}
});
test('wandering skips unsafe sidetracks instead of moving through a wall',async()=>{
  const {token,scene}=setup();const a=token('a',100,100,{enabled:true,mode:'route',sideTracks:true,stops:[{x:750,y:150,wait:1},{x:150,y:150,wait:1}]});
  scene.walls.contents.push({c:[0,100,1000,100],move:20,door:0,ds:0},{c:[0,200,1000,200],move:20,door:0,ds:0});
  const old=Math.random;Math.random=()=>.2;
  try{for(let time=0;time<15000;time+=250){await tickPatrols(time);assert.equal(a.y,100);if(patrolStatus(a)==='Pausing')break;}assert.equal(a.x,700);}
  finally{Math.random=old;}
});

 test('path pauses retain the ordered destination and resume after the configured dwell',async()=>{
  const {token}=setup();const a=token('a',100,100,{...route,pathPauses:true,pathPauseEvery:1,pathPauseMin:2,pathPauseMax:2,waypointPauses:false});
  for(let t=0;t<=1000;t+=250)await tickPatrols(t);
  assert.equal(a.x,200);assert.equal(patrolStatus(a),'Pausing');const count=a.writes.length;
  await tickPatrols(2999);assert.equal(a.writes.length,count);
  await tickPatrols(3000);assert.equal(a.x,225);
  for(let t=3250;t<=4000;t+=250)await tickPatrols(t);
  assert.equal(a.x,300);await tickPatrols(4025);assert.ok(a.x<300,'Disabled waypoint pauses continue immediately');
 });
 test('path pauses never dwell on another token',async()=>{
  const {token}=setup();const a=token('a',100,100,{...route,pathPauses:true,pathPauseEvery:1,pathPauseMin:2,pathPauseMax:2});
  token('blocker',200,100);
  for(let t=0;t<=1000;t+=250)await tickPatrols(t);
  assert.equal(patrolStatus(a),'Moving');assert.ok(a.x>200);
 });
 test('Random time limit pauses safely and chooses a new destination after dwell',async()=>{
  const {token}=setup();const a=token('a',100,100,{mode:'roam',regionId:'region',enabled:true,maxMovementTime:1.5,pauseMin:2,pauseMax:2});
  const old=Math.random;let calls=0;Math.random=()=>[.85,.15][calls++%2];
  try{
   await tickPatrols(0);await tickPatrols(1000);assert.equal(a.x,250);assert.equal(a.writes[1].options.animation.duration,500);
   await tickPatrols(1500);assert.equal(patrolStatus(a),'Pausing');assert.equal(calls,49);
   await tickPatrols(3499);assert.equal(a.writes.length,2);
   await tickPatrols(3500);assert.ok(calls>=97);assert.equal(patrolStatus(a),'Moving');
  }finally{Math.random=old;}
 });
 test('favor distant locations can be disabled',async()=>{
  const {token}=setup();const a=token('a',100,100,{mode:'roam',regionId:'region',enabled:true,favorDistance:false});
  const old=Math.random;let calls=0;Math.random=()=>[.3,.15,...Array.from({length:23},()=>[.85,.15]).flat()][calls++%48];
  try{await tickPatrols(0);await tickPatrols(1000);await tickPatrols(1500);assert.equal(a.x,250);assert.equal(patrolStatus(a),'Pausing');}
  finally{Math.random=old;}
 });
 test('new patrol settings reject invalid ranges and limits',()=>{
  for(const patch of [{pathPauseMin:5,pathPauseMax:1},{pathPauseEvery:0},{sideTrackDistance:-1},{maxMovementTime:Infinity},{favorDistance:'yes'}])assert.throws(()=>validateConfig({...defaults(),...patch}));
 });

 test('side tracks respect the configured maximum deviation',async()=>{
  const {token}=setup();const a=token('a',100,100,{...route,sideTracks:true,sideTrackDistance:0.2,stops:[{x:750,y:150,wait:0},{x:150,y:150,wait:0}]});
  const old=Math.random;Math.random=()=>0.2;let deviated=false;
  try{for(let t=0;t<12000;t+=250){await tickPatrols(t);assert.ok(Math.abs(a.y-100)<=20);if(a.y!==100)deviated=true;if(patrolStatus(a)==='Pausing')break;}assert.ok(deviated);assert.equal(a.x,700);}
  finally{Math.random=old;}
 });

function vehicleFixture(config={}){
 const fixture=setup(),a=fixture.token('car',300,300,{...route,stops:[{x:350,y:200,wait:1},{x:650,y:400,wait:1}],...config});
 a.height=2;a.rotation=0;a.isOwner=true;a.flags[ID].CreatedByVehicleTools=true;a.flags[ID].vehicleFootprint={width:1,height:2};
 fixture.hooks.get('preUpdateToken').unshift((token,changes,options)=>prepareVehicleRotation(token,changes,options,'gm'));
 return {...fixture,a};
}
async function vehicleTick(token,now){
 for(let i=0;i<2000;i++){await tickPatrols(now);if(patrolStatus(token)!=='Planning vehicle route')return;}
 assert.fail('Vehicle planning did not finish within 2000 slices');
}

for(const traversal of ['loop','reverse'])for(const waypointPauses of [false,true])test(`vehicle ${traversal} continues at zero-pause endpoints in the same tick (${waypointPauses?'zero range':'pauses disabled'})`,async t=>{
 t.mock.method(performance,'now',()=>0);
 const {a}=vehicleFixture({frontOffset:90,traversal,waypointPauses,pauseMin:waypointPauses?0:3,pauseMax:waypointPauses?0:3,stops:[{x:450,y:400,wait:0},{x:550,y:400,wait:0}]});
 for(const [now,x]of [[0,400],[1000,500],[2000,400],[3000,500]]){
  const count=a.writes.length;await tickPatrols(now);
  assert.equal(a.writes.length,count+1,'The next leg starts without an arrival-only tick');assert.equal(a.x,x);assert.equal(a.y,300);
  assert.notEqual(patrolStatus(a),'Pausing');
 }
 assert.equal(patrolOperations(a).some(entry=>entry.message==='Pausing'),false);
});

test('vehicle movement waits only for remaining native animation time after a document update',async t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const {a}=vehicleFixture({frontOffset:90,waypointPauses:false,stops:[{x:450,y:400,wait:0},{x:550,y:400,wait:0}]});
 const contexts=new Map();a.object.animationName='movement';a.object.animationContexts=contexts;
 const update=a.update;a.update=async(...args)=>{const saved=await update(...args);clock+=600;contexts.set('movement',{duration:1000,time:600});return saved;};
 await tickPatrols(0);assert.equal(a.writes.length,1);
 await tickPatrols(999);assert.equal(a.writes.length,1,'Do not interrupt the remaining animation');
 contexts.clear();await tickPatrols(1000);assert.equal(a.writes.length,2,'Elapsed animation time is not waited a second time');
});

test('vehicle movement does not wait again when animation finishes before the update returns',async t=>{
 let clock=0;t.mock.method(performance,'now',()=>clock);
 const {a}=vehicleFixture({frontOffset:90,waypointPauses:false,stops:[{x:450,y:400,wait:0},{x:550,y:400,wait:0}]});
 a.object.animationName='movement';a.object.animationContexts=new Map();
 const update=a.update;a.update=async(...args)=>{const saved=await update(...args);clock+=1000;return saved;};
 await tickPatrols(0);await tickPatrols(1000);assert.equal(a.writes.length,2);
});

test('coincident vehicle waypoints cannot create an unbounded zero-pause transition loop',async t=>{
 t.mock.method(performance,'now',()=>0);
 const {a}=vehicleFixture({waypointPauses:false,stops:[{x:350,y:400,wait:0},{x:350,y:400,wait:0}]});
 await tickPatrols(0);assert.equal(a.writes.length,0);assert.match(patrolStatus(a),/stops share a position/);
});

test('vehicle planner prefers moving 45-degree turns when there is room',()=>{
 const start={x:300,y:300,heading:0},goal={x:600,y:600};
 const path=findDrivePath(start,goal,100,(a,b)=>b.x>=100&&b.y>=100&&b.x<=800&&b.y<=800);
 assert.ok(path?.length);let prev=start;
 for(const step of path){assert.ok(Math.abs(headingDelta(prev.heading,step.heading))<=1);assert.equal(Math.max(Math.abs(step.x-prev.x),Math.abs(step.y-prev.y)),100);assert.equal(step.reverse,false);prev=step;}
 assert.deepEqual({x:prev.x,y:prev.y},goal);
});
test('vehicle planner can use a forward-reverse-forward maneuver when forward travel cannot reach the goal',()=>{
 const steps=[{x:0,y:0,heading:0},{x:1,y:-1,heading:1},{x:0,y:-1,heading:2},{x:1,y:0,heading:3},{x:1,y:1,heading:4}];
 const equal=(a,b)=>a.x===b.x&&a.y===b.y&&a.heading===b.heading;
 const clear=(a,b)=>steps.slice(0,-1).some((p,i)=>equal(a,p)&&equal(b,steps[i+1]));
 const path=findDrivePath(steps[0],steps[4],1,clear);
 assert.ok(path);assert.deepEqual(path.map(p=>p.reverse),[false,true,false,false]);
});
test('turn clearance covers intermediate body angles and excludes touching boundaries',()=>{
 const a={x:300,y:300,heading:0},b={x:400,y:200,heading:1};const hull=driveHull(a,b,{width:1,height:3},100,true);
 assert.ok(hullsOverlap(hull,sweptHull(p(450,250),p(450,250),20,20)),'Outside the old center line but inside the turning body');
 assert.equal(hullsOverlap(sweptHull(p(50,50),p(50,50),100,100),sweptHull(p(150,50),p(150,50),100,100)),false);
 assert.deepEqual(driveFootprint({width:1,height:3},1,true),{width:3,height:3});
});
test('vehicle Patrol writes move, facing and footprint together and excludes its own passengers',async()=>{
 const {a,token}=vehicleFixture();const rider=token('rider',300,350);rider.flags[ID].vehicleSeat={vehicleId:'car',seatId:'one'};
 await tickPatrols(0);assert.equal(a.x,300);assert.equal(a.y,200);assert.equal(a.rotation,0);
 assert.deepEqual(a.flags[ID].vehicleFootprint,{width:1,height:2});
 const write=a.writes.find(w=>w.options.patrolMove);assert.equal(write.options.animation.duration,1000);assert.equal(write.changes.height,2);
 await tickPatrols(1100);assert.equal(a.y,100);await tickPatrols(2200);assert.equal(patrolStatus(a),'Pausing');
});
test('vehicle body cannot cross a pedestrian and pedestrian routes cannot cross a vehicle',()=>{
 const {a,token}=vehicleFixture();const pedestrian=token('walker',300,50);
 assert.equal(routingWorld(a,patrolConfig(a)).canMove(p(350,400),p(350,100)),false);
 assert.equal(routingWorld(pedestrian,defaults()).canMove(p(100,400),p(700,400)),false);
});
test('vehicle retries an enclosed route without spinning or writing through blockers',async()=>{
 const {a,scene}=vehicleFixture();scene.walls.contents.push({c:[0,325,1000,325],move:20,door:0,ds:0},{c:[0,475,1000,475],move:20,door:0,ds:0},{c:[300,0,300,1000],move:20,door:0,ds:0},{c:[400,0,400,1000],move:20,door:0,ds:0});
 await tickPatrols(0);assert.equal(a.writes.length,0);assert.equal(patrolStatus(a),'Waiting: no clear vehicle route');
 await tickPatrols(500);assert.equal(a.writes.length,0);
});
test('vehicle start validates grid, lock and heading',async()=>{
 const {a,scene}=vehicleFixture();a.lockRotation=true;await assert.rejects(()=>savePatrol(a,patrolConfig(a)),/Unlock/);
 a.lockRotation=false;a.rotation=15;await assert.rejects(()=>savePatrol(a,patrolConfig(a)),/45-degree/);
 a.rotation=0;scene.grid.type=2;await assert.rejects(()=>savePatrol(a,patrolConfig(a)),/square or gridless/);
});
test('in-flight vehicle passage remains blocked after Stop until its animation finishes',async()=>{
 const {a,token}=vehicleFixture();await tickPatrols(0);
 await savePatrol(a,{...patrolConfig(a),enabled:false});
 const b=token('walker',0,500);
 assert.equal(routingWorld(b,defaults()).canMove(p(100,450),p(700,450)),false,'The starting area is still reserved during animation');
 await tickPatrols(1500);
 assert.equal(routingWorld(b,defaults()).canMove(p(100,450),p(700,450)),true,'Reservation expires; the car is now farther north');
});

test('an in-flight pedestrian passage blocks a vehicle even after pedestrian source coordinates advance',async()=>{
 const fixture=setup();const b=fixture.token('walker',100,400,{...route,speed:5,stops:[{x:850,y:450,wait:0},{x:150,y:450,wait:0}]});
 await tickPatrols(0);await savePatrol(b,{...patrolConfig(b),enabled:false});
 const a=fixture.token('car',0,0);a.rotation=0;a.flags[ID].CreatedByVehicleTools=true;a.flags[ID].vehicleFootprint={width:1,height:1};
 assert.equal(routingWorld(a,defaults()).canMove(p(75,350),p(75,550)),false,'The pedestrian swept area stays reserved');
});
test('two vehicle patrols cannot reserve intersecting movements',async()=>{
 const {a,token}=vehicleFixture();
 const b=token('car2',0,250,{...route,stops:[{x:750,y:300,wait:1},{x:50,y:300,wait:1}]});b.rotation=90;b.flags[ID].CreatedByVehicleTools=true;b.flags[ID].vehicleFootprint={width:1,height:1};b.isOwner=true;
 await tickPatrols(0);assert.ok(a.writes.length);assert.equal(b.writes.length,0,'Only one new vehicle route is searched per tick');
 await tickPatrols(25);
 const firstHull=driveHull({x:350,y:400,heading:0},{x:350,y:300,heading:0},{width:1,height:2},100,true);
 const move=b.writes.find(w=>w.options.patrolMove);
 if(move){const end={x:b.x+50,y:b.y+50,heading:b.rotation/45};assert.equal(hullsOverlap(firstHull,driveHull({x:50,y:300,heading:2},end,{width:1,height:1},100,true)),false);}
});
test('vehicle Random respects Region boundary and movement-time pauses at step boundaries',async()=>{
 const {a}=vehicleFixture({mode:'roam',regionId:'region',maxMovementTime:0.5,pauseMin:1,pauseMax:1});
 const old=Math.random;let n=0;Math.random=()=>[.35,.1][n++%2];
 try{await tickPatrols(0);assert.equal(a.y,200);assert.equal(patrolStatus(a),'Moving');await tickPatrols(1100);assert.equal(patrolStatus(a),'Pausing');assert.equal(a.writes.length,1);}
 finally{Math.random=old;}
});
test('a newly blocked next vehicle step is replanned or held, never submitted through the obstacle',async()=>{
 const {a,scene}=vehicleFixture();await tickPatrols(0);const count=a.writes.length;
 scene.walls.contents.push({c:[0,250,1000,250],move:20,door:0,ds:0});
 await tickPatrols(1100);assert.equal(a.writes.length,count);assert.match(patrolStatus(a),/Waiting|Planning/);
});

function trafficFixture(){
 const f=vehicleFixture({frontOffset:90,waypointPauses:false,stops:[{x:750,y:400,wait:0},{x:350,y:400,wait:0}]});
 const blocker=f.token('crossing',400,350);
 blocker.object.animationContexts=new Map([['movement',{duration:10000,time:0,to:{x:400,y:0}}]]);
 return {...f,blocker};
}
test('vehicles stop for a native moving token and resume as soon as it clears',async t=>{
 t.mock.method(performance,'now',()=>0);const {a,blocker}=trafficFixture();
 await vehicleTick(a,0);assert.equal(a.writes.length,0);assert.equal(patrolStatus(a),'Waiting for moving token');
 await tickPatrols(750);assert.equal(a.writes.length,0);
 blocker.y=0;blocker.object.animationContexts.clear();await vehicleTick(a,1000);
 assert.equal(a.writes.length,1);assert.equal(a.x,400);assert.equal(a.y,300);
});
test('vehicles retain their existing route while a moving token crosses the next step',async t=>{
 t.mock.method(performance,'now',()=>0);
 const {a,token}=vehicleFixture({frontOffset:90,waypointPauses:false,stops:[{x:750,y:400,wait:0},{x:350,y:400,wait:0}]});
 await vehicleTick(a,0);assert.equal(a.x,400);
 const blocker=token('crossing',500,350);blocker.object.animationContexts=new Map([['movement',{duration:5000,time:0,to:{y:0}}]]);
 await vehicleTick(a,1000);assert.equal(a.writes.length,1);assert.equal(patrolStatus(a),'Waiting for moving token');
 blocker.y=0;blocker.object.animationContexts.clear();await vehicleTick(a,1500);
 assert.equal(a.writes.length,2);assert.equal(a.x,500);assert.equal(a.y,300);
});
test('vehicles wait at most five seconds for traffic before routing around it',async t=>{
 t.mock.method(performance,'now',()=>0);const {a}=trafficFixture();
 await vehicleTick(a,0);await tickPatrols(1000);await tickPatrols(4999);assert.equal(a.writes.length,0);
 await vehicleTick(a,5000);assert.equal(a.writes.length,1);assert.ok(a.x!==400||a.y!==300||a.rotation!==0,'Reroute instead of entering the blocked straight step');
 assert.notEqual(patrolStatus(a),'Waiting for moving token');
});
test('stationary tokens and non-movement animations do not trigger the traffic wait',async t=>{
 t.mock.method(performance,'now',()=>0);
 for(const animation of [undefined,{duration:10000,time:0,to:{alpha:0.5}}]){
  const {a,blocker}=trafficFixture();blocker.object.animationContexts.clear();
  if(animation)blocker.object.animationContexts.set('fade',animation);
  await vehicleTick(a,0);assert.equal(a.writes.length,1);assert.ok(a.x!==400||a.y!==300||a.rotation!==0);assert.notEqual(patrolStatus(a),'Waiting for moving token');
 }
});
test('new movement updates cannot restart a vehicle traffic deadline',async t=>{
 t.mock.method(performance,'now',()=>0);const {a,blocker}=trafficFixture();
 await vehicleTick(a,0);await blocker.update({x:400,y:350});await vehicleTick(a,2000);
 assert.equal(a.writes.length,0);await blocker.update({x:400,y:350});await vehicleTick(a,4999);
 assert.equal(a.writes.length,0);await vehicleTick(a,5000);assert.equal(a.writes.length,1);
});
test('vehicles recognize patrol movement reservations even without a native animation context',async t=>{
 t.mock.method(performance,'now',()=>0);
 const {a,token}=vehicleFixture({frontOffset:90,waypointPauses:false,stops:[{x:750,y:400,wait:0},{x:350,y:400,wait:0}]});
 await savePatrol(a,{...patrolConfig(a),enabled:false});
 const walker=token('crossing',400,350,{...route,stops:[{x:750,y:400,wait:0},{x:450,y:400,wait:0}]});
 await tickPatrols(0);assert.equal(walker.writes.length,1);await savePatrol(walker,{...patrolConfig(walker),enabled:false});
 await savePatrol(a,{...patrolConfig(a),enabled:true});a.writes=[];await vehicleTick(a,50);
 assert.equal(a.writes.length,0);assert.equal(patrolStatus(a),'Waiting for moving token');
 walker.y=0;await vehicleTick(a,500);assert.equal(a.writes.length,1);
});

test('vehicle artwork front supports each 90-degree direction without rotating the image to go forward',async()=>{
 const cases=[[0,350,200,300,200],[90,550,400,400,300],[180,350,600,300,400],[270,150,400,200,300]];
 for(const [frontOffset,gx,gy,x,y] of cases){
  const {a}=vehicleFixture({frontOffset,stops:[{x:gx,y:gy,wait:1},{x:350,y:400,wait:1}]});
  await tickPatrols(0);assert.equal(a.x,x);assert.equal(a.y,y);assert.equal(a.rotation,0);
  assert.equal(a.width,1);assert.equal(a.height,2);
 }
});
test('physical facing and artwork orientation stay distinct for turning geometry',()=>{
 const nose={x:500,y:500,heading:3};
 assert.equal(artworkPose(nose,90).heading,1);
 assert.equal(artworkPose(nose,180).heading,7);
 assert.deepEqual(driveFootprint({width:1,height:3},artworkPose({...nose,heading:2},90).heading,true),{width:1,height:3});
 assert.throws(()=>validateConfig({...defaults(),frontOffset:45}),/90-degree/);
});
test('vehicle approaches an occupied waypoint, waits without advancing, then arrives after clearance',async()=>{
 const {a,token,scene}=vehicleFixture({stops:[{x:750,y:400,wait:3},{x:350,y:400,wait:3}],frontOffset:90,pauseMin:3,pauseMax:3});
 const blocker=token('destination',700,350);
 await vehicleTick(a,0);assert.ok(a.x>300,'A blocked endpoint must not prevent initial travel');
 for(let t=1100;t<=15000;t+=1100){await vehicleTick(a,t);if(patrolStatus(a).startsWith('Waiting'))break;}
 assert.match(patrolStatus(a),/Waiting/);assert.ok(a.x<700);assert.equal(destinationClear(a,p(a.x+50,a.y+100)),true);
 scene.tokens.contents.splice(scene.tokens.contents.indexOf(blocker),1);
 for(let t=18000;t<=35000;t+=1100){await tickPatrols(t);if(patrolStatus(a)==='Pausing')break;}
 assert.equal(a.x,700);assert.equal(a.y,300);assert.equal(patrolStatus(a),'Pausing');
});
test('vehicle approaches a destination behind a closed wall and resumes when it opens',async()=>{
 const {a,scene}=vehicleFixture({frontOffset:90,stops:[{x:750,y:400,wait:3},{x:350,y:400,wait:3}],pauseMin:3,pauseMax:3});
 const door={c:[600,0,600,1000],move:20,door:1,ds:0};scene.walls.contents.push(door);
 await vehicleTick(a,0);assert.ok(a.x>300);
 for(let t=1100;t<18000;t+=1100){await vehicleTick(a,t);if(patrolStatus(a).startsWith('Waiting'))break;}
 assert.match(patrolStatus(a),/Waiting/);assert.ok(a.x+a.width*100<=600);
 door.ds=1;
 for(let t=20000;t<35000;t+=1100){await tickPatrols(t);if(patrolStatus(a)==='Pausing')break;}
 assert.equal(a.x,700);assert.equal(a.y,300);
});
test('pedestrian approaches a blocked waypoint and keeps that waypoint until it becomes reachable',async()=>{
 const {token,scene}=setup();const a=token('walker',100,100,{...route,stops:[{x:750,y:150,wait:3},{x:150,y:750,wait:3}],pauseMin:3,pauseMax:3});
 const wall={c:[500,0,500,1000],move:20,door:1,ds:0};scene.walls.contents.push(wall);
 await tickPatrols(0);assert.ok(a.x>100);
 for(let t=250;t<12000;t+=250){await tickPatrols(t);if(patrolStatus(a).startsWith('Waiting'))break;}
 assert.match(patrolStatus(a),/Waiting/);assert.ok(a.x+100<=500);assert.equal(a.y,100);
 wall.ds=1;
 for(let t=15000;t<25000;t+=250){await tickPatrols(t);if(patrolStatus(a)==='Pausing')break;}
 assert.equal(a.x,700);assert.equal(a.y,100);assert.equal(patrolStatus(a),'Pausing');
});

test('approaching another patrol destination does not steal its final reservation',async()=>{
 const {token}=setup(),config={...route,stops:[{x:550,y:150,wait:5},{x:150,y:150,wait:5}],pauseMin:5,pauseMax:5};
 const a=token('first',100,100,config),b=token('second',100,300,config);
 for(let t=0;t<=10000;t+=250){await tickPatrols(t);if(patrolStatus(a)==='Pausing')break;}
 assert.equal(a.x,500);assert.equal(a.y,100);assert.equal(patrolStatus(a),'Pausing');
 assert.equal(destinationClear(b,p(550,150)),false);
});

test('stuck maneuver can turn in place only when it unlocks a safe route',()=>{
 const start={x:0,y:0,heading:0},goal={x:1,y:0};
 const clear=(a,b)=> (a.x===0&&a.y===0&&b.x===0&&b.y===0&&b.heading===a.heading+1&&b.heading<=2)
   ||(a.heading===2&&b.heading===2&&a.x===0&&b.x===1&&a.y===0&&b.y===0);
 const path=findDrivePath(start,goal,1,clear);
 assert.ok(path);assert.deepEqual(path.map(p=>[p.x,p.y,p.heading]),[[0,0,1],[0,0,2],[1,0,2]]);
 assert.equal(findDrivePath(start,goal,1,(a,b)=>a.x!==b.x&&clear(a,b)),undefined,'Blocked turn clearance must not be bypassed');
 assert.equal(findDrivePath(start,{x:2,y:0},1,(a,b)=>a.x===b.x&&a.y===b.y),undefined,'Do not rotate endlessly when no translation is possible');
});
test('stationary fallback is not preferred over a safe partial driving approach',()=>{
 const start={x:0,y:0,heading:0},goal={x:0,y:-3};
 const path=findDrivePath(start,goal,1,(a,b)=>b.x===0&&b.y>=-1&&b.y<=0,1200,Infinity,true);
 assert.ok(path);assert.ok(path.every((p,i)=>p.x!==(i?path[i-1].x:start.x)||p.y!==(i?path[i-1].y:start.y)));
});
test('runtime uses a moving 90-degree turn when diagonal turns are blocked',async()=>{
 const {a,scene}=vehicleFixture({stops:[{x:800,y:450,wait:3},{x:400,y:450,wait:3}],pauseMin:3,pauseMax:3});
 a.x=350;a.y=400;a.width=1;a.height=1;a.flags[ID].vehicleFootprint={width:1,height:1};
 // Native collision constraints remain authoritative even with wall-edge tolerance.
 a.object.checkCollision=(b,{origin})=>Math.abs(b.x-origin.x)>1&&Math.abs(b.y-origin.y)>1;
 const segments=[[300,300,500,300],[300,300,300,600],[300,600,500,600],[500,300,500,400],[500,500,500,600],[500,400,900,400],[500,500,900,500]];
 scene.walls.contents.push(...segments.map(c=>({c,move:20,door:0,ds:0})));
 await vehicleTick(a,0);assert.equal(patrolStatus(a),'Moving');assert.equal(a.x+a.width*50,500);assert.equal(a.y+a.height*50,450);assert.equal(a.rotation,90);
 assert.equal(a.writes[0].options.animation.duration,1000);
 assert.match(patrolOperations(a).at(-1).message,/Turning and moving/);
});

test('vehicle wall tolerance fits a three-square body into a two-and-a-half-square gap',()=>{
 const {a,scene}=vehicleFixture();a.width=3;a.height=3;a.flags[ID].vehicleFootprint={width:3,height:3};
 scene.walls.contents.push({c:[325,0,325,1000],move:20,door:0,ds:0},{c:[575,0,575,1000],move:20,door:0,ds:0});
 const world=routingWorld(a,patrolConfig(a));assert.equal(world.canMove(p(450,600),p(450,300)),true);
 scene.walls.contents[1].c=[565,0,565,1000];assert.equal(routingWorld(a,patrolConfig(a)).canMove(p(450,600),p(450,300)),false,'More than quarter-square clipping on either side is blocked');
});
test('wall tolerance never allows the vehicle center through a wall or closed door',()=>{
 const {a,scene}=vehicleFixture();const wall={c:[0,250,1000,250],move:20,door:1,ds:0};scene.walls.contents.push(wall);
 assert.equal(routingWorld(a,patrolConfig(a)).canMove(p(350,400),p(350,100)),false);
 wall.ds=1;assert.equal(routingWorld(a,patrolConfig(a)).canMove(p(350,400),p(350,100)),true);
});
test('wall tolerance keeps token collisions, Region boundaries and native collision checks full-strength',()=>{
 const {a,token,region}=vehicleFixture();a.width=3;a.height=3;a.flags[ID].vehicleFootprint={width:3,height:3};
 const blocker=token('edge-pedestrian',550,400);
 assert.equal(routingWorld(a,patrolConfig(a)).canMove(p(450,600),p(450,300)),false,'Token in the clipped edge still blocks');
 a.parent.tokens.contents.splice(a.parent.tokens.contents.indexOf(blocker),1);
 a.object.checkCollision=()=>true;assert.equal(routingWorld(a,patrolConfig(a)).canMove(p(450,600),p(450,300)),false);
 a.object.checkCollision=()=>false;region.testPoint=q=>q.x>=350&&q.x<=550&&q.y>=0&&q.y<=1000;
 assert.equal(routingWorld(a,{...patrolConfig(a),mode:'roam',regionId:'region'}).canMove(p(450,600),p(450,300)),false,'Region boundaries do not receive wall tolerance');
});
test('wall core retains the entire movement sweep and a nonzero small-vehicle footprint',()=>{
 const a=p(200,200),b=p(800,200),hull=sweptHull(a,b,100,100),core=vehicleWallHull(hull,a,b,100);
 assert.ok(segmentInsideHull(p(500,0),p(500,1000),core));
 assert.equal(Math.max(...core.map(p=>p.y))-Math.min(...core.map(p=>p.y)),50);
});
test('vehicle runtime travels through a narrow passage without shrinking its saved footprint',async()=>{
 const {a,scene}=vehicleFixture({stops:[{x:450,y:250,wait:2},{x:450,y:650,wait:2}]});
 a.x=300;a.y=500;a.width=3;a.height=3;a.flags[ID].vehicleFootprint={width:3,height:3};
 scene.walls.contents.push({c:[325,0,325,1000],move:20,door:0,ds:0},{c:[575,0,575,1000],move:20,door:0,ds:0});
 await tickPatrols(0);assert.equal(a.y,400);assert.equal(a.width,3);assert.equal(a.height,3);assert.equal(patrolStatus(a),'Moving');
});

test('scene stop and start preserve individual patrol enablement across runtime reset',async()=>{
 const {token,scene}=setup();scene.flags={};scene.update=async changes=>{scene.flags[ID]={patrolStopped:changes['flags.'+ID+'.patrolStopped']};};
 const a=token('running',100,100,route),b=token('individual-stop',100,500,{...route,enabled:false});
 await tickPatrols(0);const count=a.writes.length;
 await setScenePatrolStopped(scene,true);await tickPatrols(1000);assert.equal(a.writes.length,count);assert.equal(patrolConfig(a).enabled,true);assert.equal(patrolConfig(b).enabled,false);assert.equal(patrolStatus(a),'Paused: scene stopped');
 clearPatrolRuntime();assert.equal(scenePatrolStopped(scene),true);await tickPatrols(2000);assert.equal(a.writes.length,count);
 await setScenePatrolStopped(scene,false);await tickPatrols(3000);assert.ok(a.writes.length>count);assert.equal(b.writes.length,0);
 game.user.isGM=false;await assert.rejects(()=>setScenePatrolStopped(scene,true),/Only a GM/);
});
test('cancelled scene pause writes report failure',async()=>{
 const {scene}=setup();scene.update=async()=>undefined;await assert.rejects(()=>setScenePatrolStopped(scene,true),/not saved/);
});

test('operation history records repeated successful movement, caps eight, and isolates tokens',async()=>{
  const {token}=setup();const a=token('a',100,100,{enabled:true,waypointPauses:false,stops:[{x:850,y:150,wait:0},{x:150,y:150,wait:0}]}),b=token('b',100,800);
  for(let i=0;i<12;i++)await tickPatrols(100000+i*1000);
  assert.equal(patrolOperations(a).length,8);assert.ok(patrolOperations(a).every(e=>e.message.startsWith('Moving to')));
  assert.equal(patrolOperations(b).length,0);
  await savePatrol(a,{...patrolConfig(a),enabled:false});assert.equal(patrolOperations(a).at(-1).message,'Stopped');
  clearPatrolRuntime();assert.equal(patrolOperations(a).length,0);
});

test('tight turns are allowed in both directions but longer gentle routes are preferred',()=>{
 for(const sign of [-1,1]){
  const start={x:0,y:0,heading:0},goal={x:2*sign,y:-1};
  const clear=(a,b)=>b.x*sign>=0&&b.x*sign<=2&&b.y>=-1&&b.y<=0;
  const path=findDrivePath(start,goal,1,clear);assert.ok(path);
  let previous=start;for(const next of path){assert.ok(Math.abs(headingDelta(previous.heading,next.heading))<=1);previous=next;}
  const tight=findDrivePath(start,{x:sign,y:0},1,(a,b)=>b.x===sign&&b.y===0);
  assert.equal(tight.length,1);assert.equal(Math.abs(headingDelta(0,tight[0].heading)),2);
 }
});
test('90-degree sweep includes intermediate turning-body clearance',()=>{
 const start={x:300,y:300,heading:0},end={x:400,y:300,heading:2};
 const hull=driveHull(start,end,{width:3,height:3},100,false);
 assert.ok(hullsOverlap(hull,sweptHull(p(300,100),p(300,100),10,10)), 'Intermediate diagonal body extends beyond either endpoint footprint');
});

test('progressive turn clears a wall on the opposite side and passes the runtime write guard',async()=>{
 const {a,scene}=vehicleFixture({stops:[{x:450,y:350,wait:3},{x:350,y:450,wait:3}]});
 a.x=300;a.y=300;a.width=1;a.height=3;a.flags[ID].vehicleFootprint={width:1,height:3};
 scene.walls.contents.push({c:[300,0,300,1000],move:20,door:0,ds:0});
 const from={x:350,y:450,heading:0},to={x:450,y:350,heading:1},base={width:1,height:3};
 const world=routingWorld(a,patrolConfig(a)),hull=driveHull(from,to,base,100,true),sweeps=driveSweeps(from,to,base,100,true);
 assert.equal(world.clearHull(hull,from,to),false,'Old whole-move expansion falsely blocks the turn');
 assert.equal(world.clearHull(hull,from,to,sweeps),true);
 await tickPatrols(0);assert.equal(a.rotation,45);assert.equal(a.x+a.width*50,450);assert.equal(a.y+a.height*50,350);
});
test('progressive turn still blocks walls inside the sweep and full-size token obstacles',()=>{
 const {a,scene,token}=vehicleFixture();a.width=1;a.height=3;a.flags[ID].vehicleFootprint={width:1,height:3};
 const from={x:350,y:450,heading:0},to={x:450,y:350,heading:1},base={width:1,height:3};
 const hull=driveHull(from,to,base,100,true),sweeps=driveSweeps(from,to,base,100,true);
 scene.walls.contents.push({c:[410,300,410,500],move:20,door:0,ds:0});
 assert.equal(routingWorld(a,patrolConfig(a)).clearHull(hull,from,to,sweeps),false);
 scene.walls.contents=[];token('blocker',440,300);
 assert.equal(routingWorld(a,patrolConfig(a)).clearHull(hull,from,to,sweeps),false);
});
test('progressive sweeps cover wrapped and stationary turns without gaps',()=>{
 for(const [a,b] of [[{x:0,y:0,heading:7},{x:100,y:-100,heading:1}],[{x:0,y:0,heading:0},{x:0,y:0,heading:7}]]){
  const sweeps=driveSweeps(a,b,{width:1,height:3},100,true);assert.ok(sweeps.length<=12);
  let previous=a;for(const sweep of sweeps){assert.deepEqual(sweep.a,previous);assert.ok(Math.abs(headingDelta(sweep.a.heading,sweep.b.heading))<=1/6+1e-9);previous=sweep.b;}
  assert.equal(previous.x,b.x);assert.equal(previous.y,b.y);assert.equal(headingDelta(previous.heading,b.heading),0);
 }
});

test('retained search yields without taking a partial path and finds a detour away from the goal',()=>{
 const start={x:2,y:3,heading:2},goal={x:6,y:3};
 const clear=(a,b)=>b.x>=0&&b.x<=8&&b.y>=0&&b.y<=8&&!(Math.min(a.x,b.x)<4&&Math.max(a.x,b.x)>=4&&Math.min(a.y,b.y)<6);
 const search=new DriveSearch(start,goal,1,{approach:true});let result=search.advance(clear,()=>true,Infinity,1);
 assert.equal(result.status,'pending');assert.equal(result.path,undefined);
 let slices=1;while(result.status==='pending'&&slices++<10000)result=search.advance(clear,()=>true,Infinity,1);
 assert.equal(result.status,'found');assert.ok(slices>1);assert.ok(result.path.some(p=>p.y>=6));assert.deepEqual([result.path.at(-1).x,result.path.at(-1).y],[6,3]);
 let prev=start;for(const pose of result.path){assert.ok(clear(prev,pose));prev=pose;}
 const limited=new DriveSearch(start,goal,1,{approach:true,limit:1}).advance(clear,()=>true,Infinity,10);
 assert.equal(limited.status,'limit');assert.equal(limited.path,undefined,'A budget limit must not send the car toward the wall');
});
test('reversing can exceed three steps to escape a narrow dead end',()=>{
 const start={x:0,y:0,heading:0},goal={x:0,y:5};
 const path=findDrivePath(start,goal,1,(a,b)=>b.x===0&&b.y>=0&&b.y<=5&&a.heading===0&&b.heading===0);
 assert.equal(path.length,5);assert.ok(path.every(p=>p.reverse));
});
async function completeVehicleTrip(a,maxTicks=2500){
 let now=0;const poses=[];let planning=0;
 for(let i=0;i<maxTicks;i++){
  const count=a.writes.length;await tickPatrols(now);
  if(a.writes.length>count){const write=a.writes.at(-1);poses.push({x:a.x+a.width*50,y:a.y+a.height*50,heading:a.rotation/45,width:a.width,height:a.height});now+=write.options.animation.duration+10;}
  else {now+=25;if(patrolStatus(a)==='Planning vehicle route')planning++;}
  if(patrolStatus(a)==='Pausing')return {poses,planning};
  if(patrolStatus(a).startsWith('Waiting'))assert.fail(patrolStatus(a));
 }
 assert.fail('Trip failed to arrive within tick budget');
}
test('2x3 vehicle finds and executes an offset passage instead of approaching the blocking wall',async()=>{
 const {a,scene}=vehicleFixture({stops:[{x:800,y:400,wait:3},{x:300,y:400,wait:3}]});
 a.x=150;a.y=300;a.width=3;a.height=2;a.rotation=90;a.flags[ID].vehicleFootprint={width:2,height:3};
 scene.walls.contents.push({c:[500,0,500,650],move:20,door:0,ds:0});
 const {poses,planning}=await completeVehicleTrip(a);
 assert.ok(planning>0);assert.ok(poses.some(p=>p.y>=700));assert.ok(poses.some(p=>p.width===p.height&&p.width===3),'The route must handle an expanded diagonal footprint');
 assert.deepEqual([poses.at(-1).x,poses.at(-1).y],[800,400]);
 let previous={x:300,y:400};for(const p of poses){if(Math.min(previous.x,p.x)<500&&Math.max(previous.x,p.x)>=500)assert.ok(Math.min(previous.y,p.y)>=650);previous=p;}
});
test('half-grid positioning reaches a narrow opening unavailable on the old whole-grid lattice',async()=>{
 const {a,scene}=vehicleFixture({stops:[{x:750,y:400,wait:3},{x:250,y:400,wait:3}]});
 a.x=200;a.y=350;a.width=1;a.height=1;a.rotation=90;a.flags[ID].vehicleFootprint={width:1,height:1};
 scene.walls.contents.push({c:[500,0,500,425],move:20,door:0,ds:0},{c:[500,475,500,1000],move:20,door:0,ds:0});
 const {poses}=await completeVehicleTrip(a);assert.ok(poses.some(p=>p.y===450));assert.deepEqual([poses.at(-1).x,poses.at(-1).y],[750,400]);
});

test('corner escape works with the wall on each side of a changing 2x3 footprint',async()=>{
 const turn=(p,q)=>{let x=p.x-500,y=p.y-500;for(let i=0;i<q;i++)[x,y]=[-y,x];return {x:x+500,y:y+500};};
 for(let q=0;q<4;q++){
  const start=turn({x:350,y:600},q),goal=turn({x:750,y:300},q),rotation=(270+q*90)%360;
  const {a,scene}=vehicleFixture({stops:[{...goal,wait:3},{...start,wait:3}]});
  const size=driveFootprint({width:2,height:3},rotation/45,true);Object.assign(a,{x:start.x-size.width*50,y:start.y-size.height*50,width:size.width,height:size.height,rotation});a.flags[ID].vehicleFootprint={width:2,height:3};
  for(const segment of [[{x:200,y:0},{x:200,y:700}],[{x:200,y:700},{x:1000,y:700}]]){const [a,b]=segment.map(p=>turn(p,q));scene.walls.contents.push({c:[a.x,a.y,b.x,b.y],move:20,door:0,ds:0});}
  const {poses}=await completeVehicleTrip(a);assert.deepEqual([poses.at(-1).x,poses.at(-1).y],[goal.x,goal.y]);
 }
});
test('wall editing invalidates a pending search before it can execute its old frontier',async()=>{
 const {a,scene,hooks}=vehicleFixture({stops:[{x:850,y:400,wait:3},{x:350,y:400,wait:3}],frontOffset:90});
 scene.walls.contents.push({c:[600,0,600,1000],move:20,door:0,ds:0});
 await tickPatrols(0);assert.equal(patrolStatus(a),'Planning vehicle route');assert.equal(a.writes.length,0);
 const added={c:[400,0,400,1000],move:20,door:0,ds:0};scene.walls.contents.push(added);hooks.get('createWall').forEach(fn=>fn(added));
 await vehicleTick(a,25);
 assert.ok(a.x+a.width*50<400,'No movement may cross the newly placed wall');
});
test('planner slices are shared between vehicles instead of starving the later token',async()=>{
 const {a,scene,token}=vehicleFixture({frontOffset:90,stops:[{x:850,y:400,wait:3},{x:350,y:400,wait:3}]});
 scene.walls.contents.push({c:[600,0,600,1000],move:20,door:0,ds:0});
 const b=token('second',700,700,{...route,stops:[{x:750,y:550,wait:3},{x:750,y:750,wait:3}]});b.rotation=0;b.flags[ID].CreatedByVehicleTools=true;b.flags[ID].vehicleFootprint={width:1,height:1};b.isOwner=true;
 await tickPatrols(0);assert.equal(a.writes.length,0);await tickPatrols(25);assert.ok(b.writes.length>0);assert.equal(a.writes.length,0);
});
test('destination checks use the arrival heading instead of the original vehicle dimensions',()=>{
 const {a,token}=vehicleFixture();a.width=1;a.height=3;a.flags[ID].vehicleFootprint={width:1,height:3};token('obstacle',600,450);
 assert.equal(destinationClear(a,{x:500,y:500},0),true);assert.equal(destinationClear(a,{x:500,y:500},2),false);
});

test('swept wall polygons enclose intermediate chassis corners, including wrapped turns',()=>{
 const inside=(p,hull)=>hull.every((a,i)=>{const b=hull[(i+1)%hull.length];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-6;});
 for(const base of [{width:1,height:3},{width:2,height:3},{width:0.25,height:0.5}])for(const heading of [0,2,4,7])for(const turn of [-2,-1,1,2]){
  const a={x:350,y:450,heading},b={x:450,y:350,heading:(heading+turn+8)%8};
  const width=Math.max(base.width-0.5,Math.min(base.width,0.5))*100,height=Math.max(base.height-0.5,Math.min(base.height,0.5))*100;
  for(const sweep of driveSweeps(a,b,base,100,true))for(let i=0;i<=20;i++){
   const t=i/20,angle=(sweep.a.heading+headingDelta(sweep.a.heading,sweep.b.heading)*t)*Math.PI/4,c=Math.cos(angle),sin=Math.sin(angle);
   const center={x:sweep.a.x+(sweep.b.x-sweep.a.x)*t,y:sweep.a.y+(sweep.b.y-sweep.a.y)*t};
   for(const x of [-1,1])for(const y of [-1,1])assert.ok(inside({x:center.x+c*x*width/2-sin*y*height/2,y:center.y+sin*x*width/2+c*y*height/2},sweep.wallHull));
  }
 }
});
test('actual driving checks reject solid-wall crossings even for a one-square vehicle',()=>{
 const {a,scene}=vehicleFixture();a.height=1;a.flags[ID].vehicleFootprint={width:1,height:1};
 scene.walls.contents.push({c:[400,0,400,1000],move:20,door:1,ds:0});
 const from={x:350,y:350,heading:2},to={x:450,y:350,heading:2};
 assert.equal(routingWorld(a,patrolConfig(a)).canDrive(from,to),false);
 scene.walls.contents[0].ds=1;assert.equal(routingWorld(a,patrolConfig(a)).canDrive(from,to),true);
});


test('seat synchronization retains a vehicle route through moving turns; boarding still replans',async t=>{
 t.mock.method(performance,'now',()=>0);
 const {a,token}=vehicleFixture({waypointPauses:false,stops:[{x:750,y:200,wait:0},{x:350,y:400,wait:0}]});
 const rider=token('rider',300,350);rider.flags[ID].vehicleSeat={vehicleId:'car',seatId:'one'};
 const advance=DriveSearch.prototype.advance;let searches=0;
 t.mock.method(DriveSearch.prototype,'advance',function(...args){searches++;return advance.apply(this,args);});
 let turns=0,previous=a.rotation;
 for(let step=0;step<3;step++){
  const count=a.writes.length;await vehicleTick(a,step*5000);
  assert.equal(a.writes.length,count+1);
  if(a.rotation!==previous)turns++;previous=a.rotation;
  await rider.update({x:a.x,y:a.y,width:0.5,height:0.5},{vehicleSeats:true,animate:false});
 }
 assert.ok(turns>0,'Exercise moving turns with changing footprints');
 assert.equal(searches,1,'Rider placement must not discard the planned route');
 await rider.update({['flags.'+ID+'.vehicleSeat']:{vehicleId:'car',seatId:'two'}},{vehicleSeats:true});
 await vehicleTick(a,15000);
 assert.ok(searches>1,'Seat assignment changes must still invalidate plans');
});


test('idle patrols schedule no timer and pause/resume/start/stop wake correctly',()=>{
 const f=setup(),scheduled=new Map();let serial=0;
 const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
 globalThis.setTimeout=fn=>{scheduled.set(++serial,fn);return serial;};globalThis.clearTimeout=id=>scheduled.delete(id);
 const emit=(name,...args)=>f.hooks.get(name)?.forEach(fn=>fn(...args));
 try{
  emit('ready');assert.equal(scheduled.size,0);
  const t=f.token('moving',0,0,{enabled:true,route:[p(50,50),p(250,50)]});emit('createToken',t);assert.equal(scheduled.size,1);
  game.paused=true;emit('pauseGame');assert.equal(scheduled.size,0);
  game.paused=false;emit('pauseGame');assert.equal(scheduled.size,1);
  t.flags[ID].patrol.enabled=false;emit('updateToken',t,{['flags.'+ID+'.patrol.enabled']:false},{});assert.equal(scheduled.size,0);
 }finally{emit('canvasTearDown');globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
});
