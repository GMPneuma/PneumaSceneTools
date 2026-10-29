import {MODULE_ID} from "./settings.js";
import {changesSeatFields} from "./vehicle-seat-changes.js";
import {defaults, distance, findPath, nextStop, regionContainsSweep, segmentInsideHull, sweptHull, validateConfig, type PatrolConfig, type Point, type RoutingWorld} from "./patrol-model.js";

import {isVehicleToken} from "./vehicle-rotation.js";
import {getVehicleBaseSize} from "./vehicle-footprint.js";
import {driveFootprint,driveHull,driveSweeps,type DriveSweep,vehicleWallHull,DriveSearch,headingOf,headingDelta,artworkPose,hullsOverlap,type DrivePose} from "./patrol-vehicle.js";

interface State {worldRevision?:number; pauseRevision?:string; trafficUntil?:number; trafficReroute?:boolean; driveSearch?:DriveSearch; driveRevision?:number; drivePath?:DrivePose[]; reservedHull?:Point[];signature:string; path:Point[]; goal?:Point; reservedGoal?:Point; detour?:Point; index:number; direction:number; lastStop:number; waitUntil:number; moveUntil:number; travelSeconds:number; safe?:Point; status:string}
const states=new Map<string,State>();
const faults=new Map<string,string>();
interface PatrolOperation {time:number; message:string}
const operations=new Map<string,PatrolOperation[]>();
export function patrolOperations(token:TokenDocument):readonly PatrolOperation[] {return operations.get(token.uuid)??[];}
function recordOperation(token:TokenDocument,message:string):void {
  operations.set(token.uuid,[...(operations.get(token.uuid)??[]),{time:Date.now(),message}].slice(-8));
}
interface Passage {hulls:Point[][];until:number;vehicle:boolean}
const passages=new Map<string,Passage[]>();
function reservePassage(token:TokenDocument,hull:Point[],until:number,vehicle:boolean,hulls:Point[][]=[hull]):Passage {
  const passage={hulls,until,vehicle};passages.set(token.uuid,[...(passages.get(token.uuid)??[]),passage]);return passage;
}
function cancelPassage(token:TokenDocument,passage:Passage):void {
  passages.set(token.uuid,(passages.get(token.uuid)??[]).filter(p=>p!==passage));
}
function movementEnd(token:TokenDocument,now:number,duration:number,started:number):number {
  const object=token.object,contexts=object?.animationContexts;
  const animation=contexts?.get(object!.animationName);
  // Document updates may return during or after animation. Wait only for the native time still remaining.
  const remaining=contexts?(animation?Math.max(0,animation.duration-animation.time):0):duration;
  return now+(performance.now()-started)+remaining;
}
function ownPassenger(vehicle:TokenDocument,other:TokenDocument):boolean {
  return isVehicleToken(vehicle)&&foundry.utils.getProperty(other,`flags.${MODULE_ID}.vehicleSeat.vehicleId`)===vehicle.id;
}
function tokenInMotion(token:TokenDocument):boolean {
  if(passages.get(token.uuid)?.length)return true;
  return [...(token.object?.animationContexts?.values()??[])].some(animation=>animation.time<animation.duration&&
    (animation.to.x!==undefined||animation.to.y!==undefined||animation.to.rotation!==undefined));
}
function bodyHull(token:TokenDocument,displayed=false):Point[] {
  const grid=token.parent!.grid.size;
  const size=displayed&&isVehicleToken(token)?{width:(token.width??1)*grid,height:(token.height??1)*grid}:dimensions(token);
  const p=displayed?{x:token.x,y:token.y}:position(token),c={x:p.x+size.width/2,y:p.y+size.height/2};
  if(isVehicleToken(token)){
    const pose={...c,heading:(displayed?token.rotation:(token._source?.rotation??token.rotation))/45};
    return driveHull(pose,pose,getVehicleBaseSize(token),token.parent!.grid.size,token.parent!.grid.type===1);
  }
  return sweptHull(c,c,size.width,size.height);
}

let timer:ReturnType<typeof setTimeout>|undefined;
let ticking=false;
let drivePlansRemaining=1;
let geometryRevision=0;
let occupancyRevision=0;
let patrolCursor=0;
export function patrolConfig(token:TokenDocument):PatrolConfig {
  return structuredClone({...defaults(), ...((foundry.utils.getProperty(token,`flags.${MODULE_ID}.patrol`) ?? {}) as Partial<PatrolConfig>)});
}
export const patrolAuthority=()=>!!game.user?.isGM && game.users?.activeGM?.id===game.user.id;
export const scenePatrolStopped=(scene:Scene)=>foundry.utils.getProperty(scene,`flags.${MODULE_ID}.patrolStopped`)===true;
export async function setScenePatrolStopped(scene:Scene,stopped:boolean):Promise<void> {
  if(!game.user?.isGM)throw new Error("Only a GM can control scene patrols.");
  await scene.update({[`flags.${MODULE_ID}.patrolStopped`]:stopped} as object);
  if(scenePatrolStopped(scene)!==stopped)throw new Error("Scene patrol control was not saved. Try again.");
}
export function patrolPaused(scene:Scene):boolean {
  return scenePatrolStopped(scene) || !!game.paused || !!(game.combats?.contents as Combat[]|undefined)?.some(combat=>combat.started && (!combat.scene || combat.scene.id===scene.id));
}
export function patrolStatus(token:TokenDocument):string {
  if(!patrolConfig(token).enabled)return "Stopped";
  if(faults.has(token.uuid))return "Patrol error: save or start to retry";
  if(token.parent&&scenePatrolStopped(token.parent))return "Paused: scene stopped";
  if(token.parent && patrolPaused(token.parent))return "Paused: combat or game pause";
  if(!patrolAuthority() || canvas.scene?.id!==token.parent?.id)return "Waiting for active GM to view scene";
  return states.get(token.uuid)?.status ?? "Starting";
}
function dimensions(token:TokenDocument) {
  const size=token.object?.getSize();const grid=token.parent!.grid.size;
  if(isVehicleToken(token)&&[0,1].includes(token.parent!.grid.type))return {width:(token._source?.width??token.width??1)*grid,height:(token._source?.height??token.height??1)*grid};
  return {width:size?.width ?? (token.width??1)*grid,height:size?.height ?? (token.height??1)*grid};
}
/** Prepared coordinates can follow an in-progress animation after the source has committed. */
function position(token:TokenDocument):Point {return {x:token._source?.x??token.x,y:token._source?.y??token.y};}
function center(token:TokenDocument):Point {const size=dimensions(token),p=position(token);return {x:p.x+size.width/2,y:p.y+size.height/2};}
export function destinationClear(token:TokenDocument, point:Point,artHeading?:number,ignoreMoving=false):boolean {
  const size=dimensions(token),hull=artHeading===undefined?sweptHull(point,point,size.width,size.height):driveHull({...point,heading:artHeading},{...point,heading:artHeading},getVehicleBaseSize(token),token.parent!.grid.size,token.parent!.grid.type===1);
  for(const other of token.parent!.tokens.contents){
    if(other.id===token.id||ownPassenger(token,other)||ignoreMoving&&tokenInMotion(other))continue;
    if(hullsOverlap(hull,bodyHull(other))||hullsOverlap(hull,bodyHull(other,true)))return false;
    if(!patrolConfig(other).enabled)continue;
    const state=states.get(other.uuid),reserved=state?.reservedGoal;
    if(reserved){const size=dimensions(other);if(hullsOverlap(hull,state?.reservedHull??sweptHull(reserved,reserved,size.width,size.height)))return false;}
  }
  return true;
}
/** Collision data is canvas-local. Only the active GM's viewed scene may run. */
interface PatrolWorld extends RoutingWorld {canDrive(a:DrivePose,b:DrivePose,ignoreMoving?:boolean):boolean; clearHull(hull:Point[],a:Point,b:Point,sweeps?:DriveSweep[]):boolean}
export function routingWorld(token:TokenDocument, config:PatrolConfig):PatrolWorld|undefined {
  const scene=token.parent;
  if(!scene||canvas.scene?.id!==scene.id||!canvas.ready||!token.object)return;
  const size=dimensions(token), rect=canvas.dimensions?.sceneRect;
  if(!rect)return;
  const region=config.mode==="roam"?canvas.regions?.get(config.regionId):undefined;
  if(config.mode==="roam"&&!region)return;
  const boundaries=(region?.polygons ?? []).map(poly=>{
    const out:Point[]=[];for(let i=0;i<poly.points.length;i+=2)out.push({x:poly.points[i]!,y:poly.points[i+1]!});return out;
  });
  const walls=scene.walls.contents.filter(wall=>wall.move!==0 && !(wall.door!==0 && wall.ds===1));
  const vehicle=isVehicleToken(token);
  const obstacles=scene.tokens.contents.filter(other=>other.id!==token.id&&!ownPassenger(token,other)&&(vehicle||isVehicleToken(other))).flatMap(other=>[bodyHull(other),bodyHull(other,true)].map(hull=>({hull,moving:tokenInMotion(other)})));
  const reserved=[...passages.entries()].filter(([id])=>id!==token.uuid).flatMap(([,entries])=>entries.filter(p=>vehicle||p.vehicle).flatMap(p=>p.hulls.map(hull=>({hull,moving:true}))));
  const blocked=[...obstacles,...reserved],base=getVehicleBaseSize(token);
  const clearHull=(hull:Point[],a:Point,b:Point,sweeps?:DriveSweep[],native=true,ignoreMoving=false)=>{
    if(blocked.some(other=>(!ignoreMoving||!other.moving)&&hullsOverlap(hull,other.hull)))return false;
    if(hull.some(p=>p.x<rect.x||p.y<rect.y||p.x>rect.x+rect.width||p.y>rect.y+rect.height))return false;
    if(region&&!regionContainsSweep(hull,p=>region.testPoint(p,token.elevation),boundaries))return false;
    // Vehicle edges may clip walls; bodies, reservations, Region and scene bounds remain full-sized.
    const wallHulls=vehicle?(sweeps?sweeps.map(s=>s.wallHull):[vehicleWallHull(hull,a,b,scene.grid.size)]):[hull];
    if(walls.some(wall=>wallHulls.some(wallHull=>segmentInsideHull({x:wall.c[0],y:wall.c[1]},{x:wall.c[2],y:wall.c[3]},wallHull))))return false;
    // Ask Foundry before submitting movement too (including collision wrappers from other modules).
    return !native || distance(a,b)<0.001 || !token.object?.checkCollision?.(b,{origin:a,type:"move",mode:"any"});
  };
  const canDrive=(a:DrivePose,b:DrivePose,ignoreMoving=false)=>{
    const sweeps=driveSweeps(a,b,base,scene.grid.size,scene.grid.type===1);
    return sweeps.every(s=>clearHull(s.hull,s.a,s.b,[s],false,ignoreMoving))&&(distance(a,b)<0.001||!token.object?.checkCollision?.(b,{origin:a,type:"move",mode:"any"}));
  };
  return {bounds:rect,squareSteps:config.squareSteps&&!vehicle&&scene.grid.type===1,step:config.squareSteps&&!vehicle&&scene.grid.type===1?scene.grid.size:Math.max(8,scene.grid.size/2),clearHull,canDrive,canMove:(a,b)=>clearHull(sweptHull(a,b,size.width,size.height),a,b)};
}
function canRun(token:TokenDocument):boolean {
  return patrolAuthority() && !!canvas.ready && canvas.scene?.id===token.parent?.id && token.parent?.tokens.get(token.id!)===token && !patrolPaused(token.parent) && patrolConfig(token).enabled && !foundry.utils.getProperty(token,`flags.${MODULE_ID}.vehicleSeat`);
}
export async function savePatrol(token:TokenDocument, config:PatrolConfig):Promise<void> {
  if(!game.user?.isGM || token.parent?.tokens.get(token.id!)!==token)throw new Error("Only a GM can configure an existing scene token.");
  const value=validateConfig(config);
  if(value.enabled&&value.squareSteps&&!isVehicleToken(token)&&token.parent!.grid.type!==1)throw new Error("Square-to-square patrol requires a square grid.");
  if(value.enabled&&isVehicleToken(token)){
    if(token.lockRotation)throw new Error("Unlock vehicle rotation before starting Patrol.");
    if(![0,1].includes(token.parent!.grid.type))throw new Error("Vehicle Patrol requires a square or gridless scene.");
    if(Math.abs((token._source?.rotation??token.rotation)/45-Math.round((token._source?.rotation??token.rotation)/45))>0.001)throw new Error("Set the vehicle facing to a 45-degree increment before starting Patrol.");
  }
  if(value.enabled&&foundry.utils.getProperty(token,`flags.${MODULE_ID}.vehicleSeat`))throw new Error("Exit the vehicle before starting a patrol.");
  if(value.enabled&&value.mode==="roam"&&!token.parent.regions.get(value.regionId))throw new Error("The roaming Region no longer exists.");
  await token.update({[`flags.${MODULE_ID}.patrol`]:value} as object);
  if(JSON.stringify(patrolConfig(token))!==JSON.stringify(value))throw new Error("Patrol settings were not saved. Try again.");
  states.delete(token.uuid);
  faults.delete(token.uuid);
  recordOperation(token,value.enabled?"Started":"Stopped");
}
function wanderingDetour(origin:Point,path:Point[],world:RoutingWorld,grid:number,maxOffset:number):Point|undefined {
  if(Math.random()>=0.65)return;
  const visible=[...path].reverse().find(point=>world.canMove(origin,point));
  if(!visible||distance(origin,visible)<grid*2)return;
  const length=distance(origin,visible),dx=(visible.x-origin.x)/length,dy=(visible.y-origin.y)/length;
  const along=length*(0.35+Math.random()*0.3),offset=Math.max(0,maxOffset-1)*(0.5+Math.random()*0.5),side=Math.random()<0.5?-1:1;
  for(const sign of [side,-side]){
    const point={x:Math.round(origin.x+dx*along-dy*offset*sign),y:Math.round(origin.y+dy*along+dx*offset*sign)};
    if(world.canMove(origin,point)&&world.canMove(point,visible))return point;
  }
}
function claimDestination(token:TokenDocument,state:State,end:Point|undefined):void {
  if(end&&destinationClear(token,end))state.reservedGoal=end;
}
function walkingPath(token:TokenDocument,origin:Point,goal:Point,world:RoutingWorld):Point[]|undefined {
  return findPath(origin,goal,world,2500,true,p=>destinationClear(token,p));
}
function chooseGoal(token:TokenDocument, config:PatrolConfig, state:State, world:RoutingWorld):boolean {
  const origin=center(token);
  let candidates:{point:Point;index:number}[]=[];
  if(config.mode==="roam") {
    const bounds=canvas.regions?.get(config.regionId)?.bounds;
    if(!bounds)return false;
    for(let i=0;i<24;i++)candidates.push({point:{x:Math.round(bounds.x+Math.random()*bounds.width),y:Math.round(bounds.y+Math.random()*bounds.height)},index:-1});
    // Prefer an actual journey over a nearby shuffle, retaining nearby fallbacks in small Regions.
    const minimum=Math.max(token.parent!.grid.size*4,Math.max(bounds.width,bounds.height)/2);
    if(config.favorDistance)candidates.sort((a,b)=>Number(distance(origin,a.point)<minimum)-Number(distance(origin,b.point)<minimum));
  } else if(config.stops[state.index]) candidates=[{point:config.stops[state.index]!,index:state.index}];
  if(world.squareSteps)for(const candidate of candidates)candidate.point={x:origin.x+Math.round((candidate.point.x-origin.x)/world.step)*world.step,y:origin.y+Math.round((candidate.point.y-origin.y)/world.step)*world.step};
  let searches=0;
  for(const candidate of candidates) {
    if(config.mode==="roam"&&distance(origin,candidate.point)<token.parent!.grid.size/2)continue;
    if(config.mode==="roam"&&(!destinationClear(token,candidate.point)||!world.canMove(candidate.point,candidate.point)))continue;
    const path=walkingPath(token,origin,candidate.point,world);
    if(path){
      state.goal=candidate.point;state.index=candidate.index;claimDestination(token,state,path[path.length-1]??origin);
      state.detour=!world.squareSteps&&config.mode!=="roam"&&config.sideTracks&&config.sideTrackDistance>0?wanderingDetour(origin,path,world,token.parent!.grid.size,config.sideTrackDistance*token.parent!.grid.size):undefined;
      state.path=state.detour?[state.detour]:path;return true;
    }
    if(++searches>=3)break;
  }
  return false;
}
async function advanceVehicle(token:TokenDocument,config:PatrolConfig,state:State,world:PatrolWorld,now:number):Promise<void> {
  const grid=token.parent!.grid.size,square=token.parent!.grid.type===1,base=getVehicleBaseSize(token);
  if(token.lockRotation||![0,1].includes(token.parent!.grid.type)){
    state.status="Waiting: unlock rotation and use square or gridless scene";state.waitUntil=now+2000;return;
  }
  const angle=token._source?.rotation??token.rotation;
  if(Math.abs(angle/45-Math.round(angle/45))>0.001){state.status="Waiting: set facing to a 45-degree increment";state.waitUntil=now+2000;return;}
  const origin:DrivePose={...center(token),heading:headingOf(angle+config.frontOffset)};
  const art=(p:DrivePose)=>artworkPose(p,config.frontOffset);
  const clear=(a:DrivePose,b:DrivePose)=>world.canDrive(art(a),art(b));
  const canStop=(p:DrivePose)=>destinationClear(token,p,art(p).heading)&&clear(p,p);
  // Planning may look past traffic, but every submitted step still checks all occupied areas.
  const planClear=(a:DrivePose,b:DrivePose)=>world.canDrive(art(a),art(b),!state.trafficReroute);
  const planStop=(p:DrivePose)=>destinationClear(token,p,art(p).heading,!state.trafficReroute)&&planClear(p,p);
  const waitForTraffic=(next:DrivePose)=>{
    if(state.trafficUntil===undefined&&!state.trafficReroute&&world.canDrive(art(origin),art(next),true))state.trafficUntil=now+5000;
    if(state.trafficUntil===undefined)return false;
    if(now<state.trafficUntil){state.status="Waiting for moving token";return true;}
    state.trafficUntil=undefined;state.trafficReroute=true;return false;
  };
  const snap=(point:Point)=>({x:origin.x+Math.round((point.x-origin.x)/(grid/2))*grid/2,y:origin.y+Math.round((point.y-origin.y)/(grid/2))*grid/2});
  if(state.driveRevision!==geometryRevision){state.driveSearch=undefined;state.drivePath=[];state.driveRevision=geometryRevision;}
  for(let transitions=0;;transitions++){
    if(!state.goal){
      state.trafficUntil=undefined;state.trafficReroute=false;
      state.reservedGoal=undefined;state.reservedHull=undefined;state.drivePath=[];state.driveSearch=undefined;
      if(config.mode==="roam"){
        const bounds=canvas.regions?.get(config.regionId)?.bounds,candidates:Point[]=[];
        if(bounds)for(let i=0;i<12;i++)candidates.push(snap({x:bounds.x+Math.random()*bounds.width,y:bounds.y+Math.random()*bounds.height}));
        if(config.favorDistance)candidates.sort((a,b)=>distance(origin,b)-distance(origin,a));
        state.goal=candidates.find(p=>distance(origin,p)>=grid&&[0,1,2,3,4,5,6,7].some(heading=>planStop({...p,heading})));
      }else if(config.stops[state.index])state.goal=snap(config.stops[state.index]!);
      if(!state.goal){state.status="Waiting for vehicle clearance";state.waitUntil=now+2000;return;}
    }
    const limit=config.mode==="roam"?config.maxMovementTime:(config.pathPauses?config.pathPauseEvery:0);
    const arrived=distance(origin,state.goal)<0.01&&canStop(origin);
    if(arrived||(limit>0&&state.travelSeconds>=limit&&canStop(origin))){
      const low=arrived||config.mode==="roam"?config.pauseMin:config.pathPauseMin;
      const high=arrived||config.mode==="roam"?config.pauseMax:config.pathPauseMax;
      const wait=arrived&&config.mode!=="roam"&&!config.waypointPauses?0:low+Math.random()*(high-low);
      state.waitUntil=now+wait*1000;state.travelSeconds=0;state.status="Pausing";
      if(arrived||config.mode==="roam"){
        if(arrived&&config.mode!=="roam")Object.assign(state,nextStop(state.index,state.direction,config.stops.length,config.traversal));
        state.goal=undefined;state.reservedGoal=undefined;state.reservedHull=undefined;state.drivePath=[];state.driveSearch=undefined;
      }
      if(wait>0)return;
      // Zero-duration waits must not consume an extra tick before choosing the next leg.
      if(transitions>=config.stops.length&&config.mode!=="roam"){
        state.status="Waiting: patrol stops share a position";state.waitUntil=now+2000;return;
      }
      continue;
    }
    break;
  }
  while(state.drivePath?.length&&distance(origin,state.drivePath[0]!)<0.01&&origin.heading===state.drivePath[0]!.heading)state.drivePath.shift();
  if(state.drivePath?.length&&!clear(origin,state.drivePath[0]!)){
    if(waitForTraffic(state.drivePath[0]!))return;
    state.drivePath=[];state.driveSearch=undefined;state.reservedGoal=undefined;state.reservedHull=undefined;
  }else if(state.drivePath?.length)state.trafficUntil=undefined;
  if(!state.drivePath?.length){
    if(drivePlansRemaining<=0){state.status="Planning vehicle route";return;}
    drivePlansRemaining--;
    state.driveSearch??=new DriveSearch(origin,state.goal,grid/2,{approach:true,lengths:[2,1],costUnit:grid});
    const result=state.driveSearch.advance(planClear,planStop,8,256);
    if(result.status==="pending"){state.status="Planning vehicle route";return;}
    state.driveSearch=undefined;state.drivePath=result.path;
    const end=result.path?.at(-1);
    if(end&&planStop(end)){state.reservedGoal=end;state.reservedHull=driveHull(art(end),art(end),base,grid,square);}
    else{state.drivePath=[];state.reservedGoal=undefined;state.reservedHull=undefined;}
    if(!state.drivePath?.length){
      state.status=result.status==="limit"?"Waiting: vehicle route search limit reached":"Waiting: no clear vehicle route";
      state.waitUntil=now+2000;
      if(config.mode==="roam")state.goal=undefined;
      return;
    }
    recordOperation(token,result.status==="found"?`Route planned: ${state.drivePath.length} steps`:"Approaching closest reachable position");
  }
  // Preserve the found route, including detours away from the waypoint. Recheck each live step.
  const next=state.drivePath[0]!;
  const nextArt=art(next);
  const size=driveFootprint(base,nextArt.heading,square),x=next.x-size.width*grid/2,y=next.y-size.height*grid/2;
  const stationary=distance(origin,next)<1;
  const rotation=nextArt.heading*45,duration=stationary?250:distance(origin,next)/(config.speed*grid)*1000;
  if(!canRun(token))return;
  if(!clear(origin,next)){
    if(!waitForTraffic(next)){state.drivePath=[];state.driveSearch=undefined;}
    return;
  }
  state.trafficUntil=undefined;state.trafficReroute=false;
  // Reserve the complete step before submitting a document update. Pedestrians reserve their steps too.
  const sweeps=driveSweeps(art(origin),art(next),base,grid,square);
  const passage=reservePassage(token,sweeps[0]!.hull,now+duration,true,sweeps.map(s=>s.hull));
  state.status=stationary?"Turning in place":next.reverse?"Reversing":"Moving";state.moveUntil=now+duration;
  const started=performance.now();
  await token.update({x,y,rotation,width:size.width,height:size.height,[`flags.${MODULE_ID}.vehicleFootprint`]:base} as object,
    {patrolMove:true,animate:true,animation:{duration}} as object);
  const saved=position(token);
  if(saved.x!==x||saved.y!==y||(token._source?.rotation??token.rotation)!==rotation||(token._source?.width??token.width)!==size.width||(token._source?.height??token.height)!==size.height){
    cancelPassage(token,passage);state.drivePath=[];state.status="Movement cancelled; retrying";state.waitUntil=now+2000;
  }else{
    recordOperation(token,`${stationary?"Turning in place":next.reverse?"Reversing":origin.heading!==next.heading?"Turning and moving":"Moving"} to ${Math.round(next.x)}, ${Math.round(next.y)}; facing ${next.heading*45}°`);
    state.travelSeconds+=duration/1000;
    const until=movementEnd(token,now,duration,started);
    state.moveUntil=until;passage.until=until;
  }
}
async function advance(token:TokenDocument, now:number):Promise<void> {
  if(!canRun(token))return;
  const config=patrolConfig(token);validateConfig(config);
  const signature=JSON.stringify(config);
  let state=states.get(token.uuid);
  if(!state||state.signature!==signature){state={signature,path:[],index:0,direction:1,lastStop:-1,waitUntil:0,moveUntil:0,travelSeconds:0,status:"Starting"};states.set(token.uuid,state);}
  if(now<state.moveUntil||(isVehicleToken(token)&&now<state.waitUntil))return;
  if(config.squareSteps&&!isVehicleToken(token)&&token.parent!.grid.type!==1){state.status="Waiting: square-to-square patrol requires a square grid";return;}
  const pauseRevision=geometryRevision+":"+occupancyRevision;
  if(now<state.waitUntil&&state.pauseRevision===pauseRevision)return;
  const origin=center(token);
  const clearHere=destinationClear(token,origin);
  if(clearHere)state.safe=origin;
  if(now<state.waitUntil&&clearHere&&state.worldRevision===geometryRevision){state.pauseRevision=pauseRevision;state.status="Pausing";return;}
  state.pauseRevision=undefined;
  const world=routingWorld(token,config);
  if(!world){state.status="Waiting: Region or canvas unavailable";state.goal=undefined;state.reservedGoal=undefined;state.path=[];return;}
  state.worldRevision=geometryRevision;
  if(now<state.waitUntil&&clearHere){state.pauseRevision=pauseRevision;state.status="Pausing";return;}
  // Occupied pauses are cancelled; select somewhere else instead of dwelling on a token.
  state.waitUntil=0;

  if(isVehicleToken(token)){await advanceVehicle(token,config,state,world,now);return;}
  if(!state.goal) {
    if(!chooseGoal(token,config,state,world)) {
      if(!clearHere&&state.safe&&destinationClear(token,state.safe)) {
        const path=findPath(origin,state.safe,world);if(path){state.goal=state.safe;state.path=path;}
      }
      if(!state.goal){state.status="Waiting for a reachable, unoccupied stop";state.waitUntil=now+2000;return;}
    }
  }
  const travelLimit=config.mode==="roam"?config.maxMovementTime:(config.pathPauses?config.pathPauseEvery:0);
  if(travelLimit>0&&state.travelSeconds>=travelLimit-0.01&&clearHere&&state.goal&&distance(origin,state.goal)>=1){
    const low=config.mode==="roam"?config.pauseMin:config.pathPauseMin;
    const high=config.mode==="roam"?config.pauseMax:config.pathPauseMax;
    state.waitUntil=now+(low+Math.random()*(high-low))*1000;
    state.travelSeconds=0;state.status="Pausing";
    if(config.mode==="roam"){state.goal=undefined;state.reservedGoal=undefined;state.detour=undefined;state.path=[];}
    return;
  }
  while(state.path.length&&distance(origin,state.path[0]!)<1)state.path.shift();
  if(state.detour&&distance(origin,state.detour)<1)state.detour=undefined;
  // Keep the destination when geometry changes. A* tests adjacent directions before any write.
  if(state.goal&&distance(origin,state.goal)>=1&&(!state.path.length||!world.canMove(origin,state.path[0]!)||!destinationClear(token,state.path[state.path.length-1]!))) {
    let path=walkingPath(token,origin,state.detour??state.goal,world);
    if(!path&&state.detour){state.detour=undefined;path=walkingPath(token,origin,state.goal,world);}
    if(path){state.path=path;claimDestination(token,state,path[path.length-1]);}
    else {
      state.path=[];
      state.status="Waiting for a clear route to the stop";state.waitUntil=now+2000;return;
    }
  }
  if(!state.path.length) {
    if(!destinationClear(token,origin)){state.goal=undefined;state.reservedGoal=undefined;return;}
    const wait=config.mode==="roam"||config.waypointPauses?config.pauseMin+Math.random()*(config.pauseMax-config.pauseMin):0;
    state.travelSeconds=0;
    state.lastStop=state.index;
    if(config.mode!=="roam")Object.assign(state,nextStop(state.index,state.direction,config.stops.length,config.traversal));
    state.goal=undefined;state.reservedGoal=undefined;state.waitUntil=now+wait*1000;state.status="Pausing";return;
  }
  // Skip redundant search-grid corners wherever the full footprint has a clear straight segment.
  if(!world.squareSteps)for(let i=state.path.length-1;i>0;i--)if(world.canMove(origin,state.path[i]!)){state.path.splice(0,i);break;}
  const target=state.path[0]!, length=distance(origin,target), pixelsPerSecond=config.speed*token.parent!.grid.size;
  // Region trips use longer linear animations instead of restarting every quarter second.
  const remaining=travelLimit>0&&state.travelSeconds<travelLimit?travelLimit-state.travelSeconds:Infinity;
  const segmentSeconds=Math.min(config.mode==="roam"?1:0.25,remaining);
  const stride=config.mode==="roam"?pixelsPerSecond*segmentSeconds:Math.min(pixelsPerSecond*segmentSeconds,token.parent!.grid.size/2);
  const portion=world.squareSteps?1:Math.min(1,stride/length);
  const next={x:origin.x+(target.x-origin.x)*portion,y:origin.y+(target.y-origin.y)*portion};
  // Revalidate every segment for edited walls, doors, Regions and token dimensions.
  if(!world.canMove(origin,next)){state.path=[];state.status="Replanning around obstacles";return;}
  if(!canRun(token))return;
  const size=dimensions(token);
  let x=world.squareSteps?next.x-size.width/2:Math.round(next.x-size.width/2), y=world.squareSteps?next.y-size.height/2:Math.round(next.y-size.height/2);
  let actual={x:x+size.width/2,y:y+size.height/2};
  if(!world.canMove(origin,actual)) {
    if(world.squareSteps){state.path=[];state.status="Replanning around obstacles";return;}
    // Pixel rounding can push a tangent path into a wall. Check neighbouring headings first.
    const angle=Math.atan2(target.y-origin.y,target.x-origin.x), stride=distance(origin,next);
    let alternative=false;
    for(const offset of [Math.PI/8,-Math.PI/8,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2]){
      const candidate={x:Math.round(origin.x+Math.cos(angle+offset)*stride-size.width/2),y:Math.round(origin.y+Math.sin(angle+offset)*stride-size.height/2)};
      const point={x:candidate.x+size.width/2,y:candidate.y+size.height/2};
      if(distance(origin,point)<1||!world.canMove(origin,point))continue;
      const onward=walkingPath(token,point,state.detour??state.goal!,world);if(!onward)continue;
      x=candidate.x;y=candidate.y;actual=point;state.path=onward;alternative=true;break;
    }
    if(!alternative){state.path=[];state.status="Replanning around obstacles";return;}
  }
  const duration=Math.max(20,distance(origin,actual)/pixelsPerSecond*1000);
  state.status="Moving";state.moveUntil=now+duration;
  const passage=reservePassage(token,sweptHull(origin,actual,size.width,size.height),now+duration,false);
  const started=performance.now();
  await token.update({x,y},{patrolMove:true,animate:true,animation:{duration}} as object);
  const saved=position(token);
  if(saved.x!==x||saved.y!==y){cancelPassage(token,passage);state.path=[];state.status="Movement cancelled; retrying";state.waitUntil=now+2000;}
  else {recordOperation(token,`Moving to ${Math.round(actual.x)}, ${Math.round(actual.y)}`);state.travelSeconds+=duration/1000;passage.until=now+duration+(performance.now()-started);
    if(world.squareSteps&&config.squarePause>0){
      state.moveUntil=movementEnd(token,now,duration,started);
      passage.until=state.moveUntil;
      state.waitUntil=state.moveUntil+config.squarePause*1000;
    }
  }
}
let activePatrols: Map<string,TokenDocument>|undefined;
function rebuildPatrols(){activePatrols=new Map((canvas.scene?.tokens.contents??[]).filter(token=>patrolConfig(token).enabled).map(token=>[token.uuid,token]));}
export async function tickPatrols(now=Date.now()):Promise<void> {
  if(ticking)return;
  ticking=true;
  drivePlansRemaining=1;
  try {
    for(const [id,entries] of passages){const live=entries.filter(p=>p.until>now);if(live.length)passages.set(id,live);else passages.delete(id);}
    if(!patrolAuthority()||!canvas.ready||!canvas.scene){states.clear();return;}
    const tokens=activePatrols ? [...activePatrols.values()] : canvas.scene.tokens.contents.filter(token=>patrolConfig(token).enabled);
    const enabled=new Set(tokens.map(token=>token.uuid));
    for(const key of states.keys())if(!enabled.has(key))states.delete(key);
    if(patrolPaused(canvas.scene))return;
    const offset=patrolCursor++%Math.max(1,tokens.length);
    for(const token of [...tokens.slice(offset),...tokens.slice(0,offset)]) {
      if(!patrolConfig(token).enabled)continue;
      if(faults.get(token.uuid)===JSON.stringify(patrolConfig(token)))continue;
      const previous=states.get(token.uuid)?.status;
      const priorReservation=states.get(token.uuid)?.reservedGoal;
      try {await advance(token,now);
        if(states.get(token.uuid)?.reservedGoal!==priorReservation)occupancyRevision++;
        const status=states.get(token.uuid)?.status;
        if(status&&status!==previous&&!["Moving","Reversing","Turning in place"].includes(status))recordOperation(token,status);
      }catch(error){
        console.error(`${MODULE_ID} | Patrol ${token.name}`,error);
        faults.set(token.uuid,JSON.stringify(patrolConfig(token)));
        const state=states.get(token.uuid);if(state){state.status="Patrol error; stopped";state.goal=undefined;state.reservedGoal=undefined;}
        // Avoid repeated writes/errors every timer tick after a malformed configuration or rejected write.
        await savePatrol(token,{...defaults(),...patrolConfig(token),enabled:false}).catch(()=>undefined);
        recordOperation(token,"Patrol error; stopped");
      }
    }
  } finally {ticking=false;}
}
export function clearPatrolRuntime():void {activePatrols=undefined;states.clear();faults.clear();passages.clear();operations.clear();patrolCursor=0;geometryRevision++;}
export function registerPatrolRuntime():void {
  let generation=0,initialized=false;
  const stop=()=>{generation++;if(timer)clearTimeout(timer);timer=undefined;clearPatrolRuntime();};
  const runnable=()=>!!activePatrols?.size&&!!canvas.scene&&!patrolPaused(canvas.scene);
  const start=()=>{
    if(!initialized)return;
    if(!activePatrols)rebuildPatrols();
    if(!patrolAuthority()||!canvas.ready){stop();return;}
    if(!runnable()){generation++;if(timer)clearTimeout(timer);timer=undefined;return;}
    if(timer)return;
    const epoch=generation;
    const loop=async()=>{
      try{await tickPatrols();}finally{
        if(epoch===generation&&patrolAuthority()&&canvas.ready&&runnable())timer=setTimeout(()=>void loop(),25);
        else if(epoch===generation)timer=undefined;
      }
    };
    timer=setTimeout(()=>void loop(),25);
  };
  const ready=()=>{initialized=true;rebuildPatrols();start();};
  Hooks.on("ready",ready);Hooks.on("canvasReady",ready);Hooks.on("updateUser",start);Hooks.on("userConnected",start);
  Hooks.on("canvasTearDown",()=>{initialized=false;stop();});
  for(const hook of ["pauseGame","createCombat","updateCombat","deleteCombat"])Hooks.on(hook,start);
  const invalidate=(doc?:{parent?:{id?:string|null}|null})=>{if(!doc||doc.parent?.id===canvas.scene?.id)geometryRevision++;};
  for(const event of ["createWall","deleteWall","createRegion","deleteRegion"] as const)Hooks.on(event,invalidate);
  Hooks.on("updateWall",(doc:WallDocument,changes:object)=>{if(changesSeatFields(changes,['c','ds','door','dir','move','flags']))invalidate(doc);});
  Hooks.on("updateRegion",(doc:RegionDocument,changes:object)=>{if(changesSeatFields(changes,['shapes','elevation']))invalidate(doc);});
  Hooks.on("createToken",(token:TokenDocument)=>{if(token.parent?.id!==canvas.scene?.id)return;if(initialized)rebuildPatrols();invalidate(token);start();});
  Hooks.on("updateScene",(scene:Scene,changes:object)=>{if(scene.id!==canvas.scene?.id)return;if(changesSeatFields(changes,['grid','width','height','padding']))geometryRevision++;start();});
  Hooks.on("deleteToken",(token:TokenDocument)=>{states.delete(token.uuid);operations.delete(token.uuid);activePatrols?.delete(token.uuid);invalidate(token);start();});
  Hooks.on("updateToken",(token:TokenDocument,changes:Record<string,unknown>,options:{patrolMove?:boolean;vehicleSeats?:boolean})=>{
    if(token.parent?.id!==canvas.scene?.id)return;
    if(changesSeatFields(changes,[`flags.${MODULE_ID}.patrol`,`flags.${MODULE_ID}.vehicleSeat`])){if(initialized)rebuildPatrols();start();}
    if(changesSeatFields(changes,["x","y","width","height","rotation",`flags.${MODULE_ID}.patrol`,`flags.${MODULE_ID}.vehicleSeat`]))occupancyRevision++;
    // Seat placement follows its vehicle; it is dynamic movement, not a scene geometry edit.
    // Boarding/exiting and patrol configuration changes must still invalidate existing plans.
    if(options.vehicleSeats&&!changesSeatFields(changes,[`flags.${MODULE_ID}.vehicleSeat`,`flags.${MODULE_ID}.patrol`]))return;
    if(!options.patrolMove&&changesSeatFields(changes,["x","y","width","height","elevation","rotation",`flags.${MODULE_ID}.patrol`,`flags.${MODULE_ID}.vehicleSeat`])){states.delete(token.uuid);faults.delete(token.uuid);invalidate();}
  });
  Hooks.on("refreshToken",(_token:Token,flags:Record<string,unknown>={})=>{
    if(flags.refreshPosition||flags.refreshSize||flags.refreshRotation)occupancyRevision++;
  });
  Hooks.on("preUpdateToken",(token:TokenDocument,changes:{x?:number;y?:number;rotation?:number;width?:number;height?:number},options:{patrolMove?:boolean})=>{
    if(!options.patrolMove)return;
    if(!canRun(token))return false;
    if(isVehicleToken(token)){
      const base=getVehicleBaseSize(token),grid=token.parent!.grid.size,square=token.parent!.grid.type===1;
      const origin={...center(token),heading:headingOf(token._source?.rotation??token.rotation)};
      const heading=headingOf(changes.rotation??token.rotation),size=driveFootprint(base,heading,square);
      const target={x:(changes.x??position(token).x)+size.width*grid/2,y:(changes.y??position(token).y)+size.height*grid/2,heading};
      if((changes.width!==undefined&&changes.width!==size.width)||(changes.height!==undefined&&changes.height!==size.height))return false;
      if(token.lockRotation||Math.abs(headingDelta(origin.heading,heading))>(distance(origin,target)<1?1:2)||!routingWorld(token,patrolConfig(token))?.canDrive(origin,target))return false;
      return;
    }
    const size=dimensions(token),p=position(token), target={x:(changes.x??p.x)+size.width/2,y:(changes.y??p.y)+size.height/2};
    if(!routingWorld(token,patrolConfig(token))?.canMove(center(token),target))return false;
    const state=states.get(token.uuid),stop=state?.path[state.path.length-1]??state?.goal;
    if(stop&&distance(stop,target)<1&&!destinationClear(token,target))return false;
  });
}
