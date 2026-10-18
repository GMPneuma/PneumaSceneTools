/** Geometry and bounded routing shared by patrol runtime and regression tests. */
export interface Point {x: number; y: number}
export interface Stop extends Point {wait: number}
export interface PatrolConfig {
  squareSteps: boolean;
  squarePause: number;
  mode: "route" | "roam";
  traversal: "loop" | "reverse";
  regionId: string;
  speed: number;
  pauseMin: number;
  pauseMax: number;
  waypointPauses: boolean;
  pathPauses: boolean;
  pathPauseMin: number;
  pathPauseMax: number;
  pathPauseEvery: number;
  sideTracks: boolean;
  sideTrackDistance: number;
  favorDistance: boolean;
  maxMovementTime: number;
  frontOffset: number;
  stops: Stop[];
  enabled: boolean;
}
export interface Rect extends Point {width: number; height: number}
export const defaults = (): PatrolConfig => ({squareSteps:false,squarePause:0,mode: "route", traversal: "loop", regionId: "", speed: 1, pauseMin: 2, pauseMax: 6, waypointPauses:true,pathPauses:false,pathPauseMin:2,pathPauseMax:6,pathPauseEvery:10,sideTracks:false,sideTrackDistance:1,favorDistance:true,maxMovementTime:0,frontOffset:0,stops: [], enabled: false});
export function validateConfig(value: PatrolConfig): PatrolConfig {
  if (!Number.isFinite(value.squarePause)||value.squarePause<0||value.squarePause>3600||Math.abs(value.squarePause*10-Math.round(value.squarePause*10))>1e-8)throw new Error("Square pause must be between 0 and 3600 seconds with at most one decimal place.");
  if (!["route", "roam"].includes(value.mode) || !["loop", "reverse"].includes(value.traversal)) throw new Error("Choose a valid patrol mode.");
  if (!Number.isFinite(value.speed) || value.speed < 0.1 || value.speed > 5) throw new Error("Speed must be between 0.1 and 5 grid spaces per second.");
  if (![value.pauseMin, value.pauseMax].every(n => Number.isFinite(n) && n >= 0 && n <= 3600) || value.pauseMax < value.pauseMin) throw new Error("Pause range must be between 0 and 3600 seconds, with maximum at least minimum.");
  if (![value.pathPauseMin,value.pathPauseMax].every(n=>Number.isFinite(n)&&n>=0&&n<=3600)||value.pathPauseMax<value.pathPauseMin)throw new Error("Path pause range must be between 0 and 3600 seconds, with maximum at least minimum.");
  if (!Number.isFinite(value.pathPauseEvery)||value.pathPauseEvery<1||value.pathPauseEvery>3600)throw new Error("Pause frequency must be between 1 and 3600 seconds of movement.");
  if (!Number.isFinite(value.sideTrackDistance)||value.sideTrackDistance<0||value.sideTrackDistance>20)throw new Error("Side track distance must be between 0 and 20 grid spaces.");
  if (!Number.isFinite(value.maxMovementTime)||value.maxMovementTime<0||value.maxMovementTime>3600)throw new Error("Maximum movement time must be between 0 and 3600 seconds (0 means unlimited).");
  if (![0,90,180,270].includes(value.frontOffset))throw new Error("Choose an artwork front direction in 90-degree increments.");
  if (![value.squareSteps,value.waypointPauses,value.pathPauses,value.sideTracks,value.favorDistance].every(v=>typeof v==="boolean"))throw new Error("Choose valid patrol options.");
  if (!Array.isArray(value.stops) || value.stops.length > 100 || value.stops.some(p => ![p.x, p.y, p.wait].every(Number.isFinite) || p.wait < 0 || p.wait > 3600)) throw new Error("Use at most 100 stops with valid coordinates and pauses from 0 to 3600 seconds.");
  if (value.enabled && value.mode === "roam" && !value.regionId) throw new Error("Choose a roaming Region.");
  if (value.enabled && value.mode !== "roam" && value.stops.length < 2) throw new Error("Place at least two stops.");
  return structuredClone(value);
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const footprint = (p: Point, width: number, height: number): Rect => ({x: p.x - width / 2, y: p.y - height / 2, width, height});
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width - 0.01 && a.x + a.width > b.x + 0.01 && a.y < b.y + b.height - 0.01 && a.y + a.height > b.y + 0.01;
}
const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function sweptHull(a: Point, b: Point, width: number, height: number): Point[] {
  const points = [a,b].flatMap(p => [-1,1].flatMap(x => [-1,1].map(y => ({x:p.x+x*width/2, y:p.y+y*height/2})))).sort((p,q)=>p.x-q.x||p.y-q.y);
  const half = (list: Point[]) => {const out: Point[]=[]; for (const p of list) {while(out.length>=2 && cross(out[out.length-2]!,out[out.length-1]!,p)<=0) out.pop();out.push(p);}return out;};
  return [...half(points).slice(0,-1), ...half([...points].reverse()).slice(0,-1)];
}
/** True when any positive-length portion of a segment lies inside the convex footprint sweep. */
export function segmentInsideHull(a: Point, b: Point, hull: Point[]): boolean {
  let lo=0, hi=1;
  for (let i=0;i<hull.length;i++) {
    const p=hull[i]!, q=hull[(i+1)%hull.length]!;
    const start=cross(p,q,a), delta=cross(p,q,b)-start;
    if (Math.abs(delta)<1e-9) {if(start<=0.001)return false;continue;}
    const t=(0.001-start)/delta;
    if(delta>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    if(lo>=hi)return false;
  }
  return lo<hi;
}
export function regionContainsSweep(hull: Point[], contains: (p: Point)=>boolean, boundaries: Point[][]): boolean {
  if (!hull.every(contains)) return false;
  // Also reject holes and concave notches entirely between the footprint corners.
  return !boundaries.some(poly => poly.some((p,i)=>segmentInsideHull(p,poly[(i+1)%poly.length]!,hull)));
}
export interface RoutingWorld {bounds: Rect; step: number; squareSteps?: boolean; canMove(a: Point,b: Point): boolean}
/** Bounded A* with 8 neighbours. No path means wait/retry, never teleport through an obstacle. */
export function findPath(start: Point, goal: Point, world: RoutingWorld, limit=2500, approach=false,canStop:(p:Point)=>boolean=()=>true): Point[] | undefined {
  if (!world.canMove(start,start) || (!approach&&!world.canMove(goal,goal))) return;
  if (!world.squareSteps && canStop(goal)&&world.canMove(start,goal)) return [goal];
  type Node = {p: Point; g: number; f: number; parent?: Node};
  const key=(p:Point)=>`${Math.round((p.x-start.x)/world.step)},${Math.round((p.y-start.y)/world.step)}`;
  const first:Node={p:start,g:0,f:distance(start,goal)};
  let closest:Node|undefined;
  const routeTo=(last:Node)=>{const path:Point[]=[];let node:Node|undefined=last;while(node?.parent){path.unshift(node.p);node=node.parent;}return path;};
  const open=[first], costs=new Map([[key(start),0]]);
  for(let visited=0;open.length && visited<limit;visited++) {
    let best=0;for(let i=1;i<open.length;i++)if(open[i]!.f<open[best]!.f)best=i;
    const current=open.splice(best,1)[0]!;
    if(current.g>costs.get(key(current.p))!)continue;
    if((world.squareSteps ? distance(current.p,goal)<0.01 : distance(current.p,goal)<=world.step*1.5) && canStop(goal)&&world.canMove(current.p,goal)) {
      const route=[goal];let node:Node|undefined=current;
      while(node?.parent){route.unshift(node.p);node=node.parent;}return route;
    }
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) {
      if(!dx&&!dy)continue;
      const p={x:current.p.x+dx*world.step,y:current.p.y+dy*world.step};
      if(p.x<world.bounds.x||p.y<world.bounds.y||p.x>world.bounds.x+world.bounds.width||p.y>world.bounds.y+world.bounds.height)continue;
      // Prefer cardinal steps; diagonals remain available for tighter routes.
      const cost=world.squareSteps && dx && dy ? world.step*2.05 : distance(current.p,p);
      const g=current.g+cost, k=key(p);
      if(g>=(costs.get(k)??Infinity)||!world.canMove(current.p,p))continue;
      const node={p,g,f:g+distance(p,goal),parent:current};
      if(approach&&canStop(p)&&distance(p,goal)<distance(closest?.p??start,goal)-0.01)closest=node;
      costs.set(k,g);open.push(node);
    }
  }
  if(closest)return routeTo(closest);
}
export function nextStop(index: number, direction: number, count: number, traversal: PatrolConfig["traversal"]): {index:number;direction:number} {
  if(traversal==="loop")return {index:(index+1)%count,direction:1};
  if(index+direction>=count||index+direction<0)direction=-direction;
  return {index:index+direction,direction};
}
