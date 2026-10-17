import {sweptHull, type Point} from "./patrol-model.js";
import {normalizeRotation, vehicleGridFootprintSize, vehicleFootprintSize, type VehicleSize} from "./vehicle-rotation-geometry.js";

export interface DrivePose extends Point {heading:number; reverse?:boolean}
export const headingOf=(rotation:number)=>Math.round(normalizeRotation(rotation)/45)%8;
export const artworkPose=(pose:DrivePose,frontOffset:number):DrivePose=>({...pose,heading:headingOf(pose.heading*45-frontOffset)});
export {DriveSearch,findDrivePath} from "./patrol-drive-search.js";
export const headingDelta=(a:number,b:number)=>((b-a+12)%8)-4;
export function driveFootprint(base:VehicleSize,heading:number,square:boolean):VehicleSize {
  return square?vehicleGridFootprintSize(base,heading*45):vehicleFootprintSize(base,heading*45);
}
/** Conservative swept body and native footprint, including intermediate rotation angles. */
export function driveHull(a:DrivePose,b:DrivePose,base:VehicleSize,grid:number,square:boolean):Point[] {
  const lo=Math.min(a.heading,a.heading+headingDelta(a.heading,b.heading))*Math.PI/4;
  const hi=Math.max(a.heading,a.heading+headingDelta(a.heading,b.heading))*Math.PI/4;
  const angles=[lo,hi];
  for(let k=Math.floor(lo/(Math.PI/2))-1;k<=Math.ceil(hi/(Math.PI/2))+1;k++)for(const angle of [Math.atan2(base.height,base.width),Math.atan2(base.width,base.height)]){
    for(const sign of [-1,1]){const t=k*Math.PI/2+sign*angle;if(t>lo&&t<hi)angles.push(t);}
  }
  const sizes=[driveFootprint(base,a.heading,square),driveFootprint(base,b.heading,square)];
  const width=Math.max(...sizes.map(s=>s.width),...angles.map(t=>Math.abs(Math.cos(t))*base.width+Math.abs(Math.sin(t))*base.height))*grid;
  const height=Math.max(...sizes.map(s=>s.height),...angles.map(t=>Math.abs(Math.sin(t))*base.width+Math.abs(Math.cos(t))*base.height))*grid;
  return sweptHull(a,b,width,height);
}
function convexHull(points:Point[]):Point[] {
  points.sort((a,b)=>a.x-b.x||a.y-b.y);
  const half=(list:Point[])=>{const out:Point[]=[];for(const p of list){while(out.length>=2){const a=out[out.length-2]!,b=out[out.length-1]!;if((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>1e-9)break;out.pop();}out.push(p);}return out;};
  return [...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];
}
function chassis(p:DrivePose,width:number,height:number):Point[] {
  const angle=p.heading*Math.PI/4,c=Math.cos(angle),s=Math.sin(angle);
  return [-1,1].flatMap(x=>[-1,1].map(y=>({x:p.x+c*x*width/2-s*y*height/2,y:p.y+s*x*width/2+c*y*height/2})));
}
/** Wall clipping applies to the oriented chassis, not empty corners of Foundry's square selection box. */
function chassisWallSweep(a:DrivePose,b:DrivePose,base:VehicleSize,grid:number):Point[] {
  const core=(size:number)=>Math.max(size-0.5,Math.min(size,0.5))*grid;
  const width=core(base.width),height=core(base.height);
  const angle=Math.abs(headingDelta(a.heading,b.heading))*Math.PI/4;
  // Enclose the curved corner arcs between samples; checking endpoints alone can miss a short wall.
  const margin=Math.hypot(width,height)/2*(1-Math.cos(angle/2));
  const points=[...chassis(a,width,height),...chassis(b,width,height)];
  return convexHull(margin>1e-9?points.flatMap(p=>[-1,1].flatMap(x=>[-1,1].map(y=>({x:p.x+x*margin,y:p.y+y*margin})))):points);
}
export interface DriveSweep {a:DrivePose; b:DrivePose; hull:Point[]; wallHull:Point[]}
const sweepCache=new Map<string,DriveSweep[]>();
/** Short swept intervals retain continuous coverage without expanding the whole starting area. */
export function driveSweeps(a:DrivePose,b:DrivePose,base:VehicleSize,grid:number,square:boolean):DriveSweep[] {
  const key=[b.x-a.x,b.y-a.y,a.heading,b.heading,base.width,base.height,grid,square].join(",");
  let relative=sweepCache.get(key);
  if(!relative){
    relative=relativeSweeps({...a,x:0,y:0},{...b,x:b.x-a.x,y:b.y-a.y},base,grid,square);
    if(sweepCache.size>=512)sweepCache.clear();sweepCache.set(key,relative);
  }
  const translate=(p:Point)=>({x:p.x+a.x,y:p.y+a.y});
  return relative.map(s=>({a:{...s.a,...translate(s.a)},b:{...s.b,...translate(s.b)},hull:s.hull.map(translate),wallHull:s.wallHull.map(translate)}));
}
function relativeSweeps(a:DrivePose,b:DrivePose,base:VehicleSize,grid:number,square:boolean):DriveSweep[] {
  const turn=headingDelta(a.heading,b.heading);
  const count=Math.max(1,Math.ceil(Math.abs(turn)*6)); // At most 7.5 degrees per interval.
  const pose=(t:number):DrivePose=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:a.heading+turn*t});
  const result:DriveSweep[]=[];
  for(let i=0;i<count;i++){
    const from=pose(i/count),to=pose((i+1)/count);
    result.push({a:from,b:to,hull:driveHull(from,to,base,grid,square),wallHull:chassisWallSweep(from,to,base,grid)});
  }
  return result;
}
/** Shrink only the swept body's wall clearance, never the travel segment or token collision area. */
export function vehicleWallHull(hull:Point[],a:Point,b:Point,grid:number):Point[] {
  const width=Math.max(...hull.map(p=>p.x))-Math.min(...hull.map(p=>p.x))-Math.abs(b.x-a.x);
  const height=Math.max(...hull.map(p=>p.y))-Math.min(...hull.map(p=>p.y))-Math.abs(b.y-a.y);
  // Up to a quarter grid space per side; retain a solid core for small vehicles.
  const core=(size:number)=>Math.max(size-grid/2,Math.min(size,grid/2));
  return sweptHull(a,b,core(width),core(height));
}
/** SAT for convex polygons; touching boundaries are allowed. */
export function hullsOverlap(a:Point[],b:Point[]):boolean {
  if(Math.max(...a.map(p=>p.x))<=Math.min(...b.map(p=>p.x))||Math.max(...b.map(p=>p.x))<=Math.min(...a.map(p=>p.x))
    ||Math.max(...a.map(p=>p.y))<=Math.min(...b.map(p=>p.y))||Math.max(...b.map(p=>p.y))<=Math.min(...a.map(p=>p.y)))return false;
  for(const poly of [a,b])for(let i=0;i<poly.length;i++){
    const p=poly[i]!,q=poly[(i+1)%poly.length]!,axis={x:p.y-q.y,y:q.x-p.x};
    const project=(r:Point)=>r.x*axis.x+r.y*axis.y;
    const aa=a.map(project),bb=b.map(project);
    if(Math.max(...aa)<=Math.min(...bb)+0.001||Math.max(...bb)<=Math.min(...aa)+0.001)return false;
  }
  return true;
}
