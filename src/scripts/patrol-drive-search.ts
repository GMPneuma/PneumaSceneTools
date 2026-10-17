import {distance, type Point} from "./patrol-model.js";
import {type DrivePose} from "./patrol-vehicle.js";

const directions=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]] as const;
interface Node {pose:DrivePose; cost:number; score:number; remaining:number; parent?:Node}
export type DriveSearchResult={status:"pending"|"limit"|"unreachable"|"found"; path?:DrivePose[]};
export interface DriveSearchOptions {
  limit?:number;
  approach?:boolean;
  /** Runtime uses half-grid positioning, with both half- and whole-grid driving steps. */
  lengths?:number[];
  costUnit?:number;
}

/** Retained heading-aware A*. Yielding never discards the frontier or returns a greedy partial route. */
export class DriveSearch {
  private readonly open:Node[]=[];
  private readonly costs=new Map<string,number>();
  private closest:Node|undefined;
  private visited=0;
  private result:DriveSearchResult|undefined;
  constructor(readonly start:DrivePose,readonly goal:Point,readonly step:number,private readonly options:DriveSearchOptions={}) {
    const remaining=distance(start,goal)/(options.costUnit??step);
    this.push({pose:start,cost:0,score:remaining,remaining});this.costs.set(this.key(start),0);
  }
  private key(p:DrivePose):string {
    return `${Math.round((p.x-this.start.x)/this.step)},${Math.round((p.y-this.start.y)/this.step)},${p.heading},${!!p.reverse}`;
  }
  private before(a:Node,b:Node):boolean {return a.score<b.score || (a.score===b.score&&a.remaining<b.remaining);}
  private push(node:Node):void {
    let i=this.open.length;this.open.push(node);
    while(i){const parent=(i-1)>>1;if(!this.before(node,this.open[parent]!))break;this.open[i]=this.open[parent]!;i=parent;}
    this.open[i]=node;
  }
  private pop():Node {
    const first=this.open[0]!,last=this.open.pop()!;
    if(this.open.length){let i=0;while(i*2+1<this.open.length){let child=i*2+1;if(child+1<this.open.length&&this.before(this.open[child+1]!,this.open[child]!))child++;
      if(!this.before(this.open[child]!,last))break;this.open[i]=this.open[child]!;i=child;
    }this.open[i]=last;}return first;
  }
  private route(last:Node):DrivePose[] {const path:DrivePose[]=[];for(let n:Node|undefined=last;n?.parent;n=n.parent)path.push(n.pose);return path.reverse();}
  /** One bounded slice. The caller must invalidate the search when static geometry changes. */
  advance(clear:(a:DrivePose,b:DrivePose)=>boolean,canStop:(p:DrivePose)=>boolean=()=>true,milliseconds=8,nodes=256):DriveSearchResult {
    if(this.result)return this.result;
    const deadline=performance.now()+milliseconds,unit=this.options.costUnit??this.step;
    for(let slice=0;this.open.length&&slice<nodes&&performance.now()<deadline;slice++){
      if(this.visited>=(this.options.limit??40000))return this.result={status:"limit"};
      const node=this.pop();if(node.cost>this.costs.get(this.key(node.pose))!)continue;this.visited++;
      if(distance(node.pose,this.goal)<0.01&&canStop(node.pose))return this.result={status:"found",path:this.route(node)};
      // Partial approaches are only considered after the reachable graph is exhausted.
      if(this.options.approach&&node.parent&&distance(node.pose,this.goal)<distance(this.closest?.pose??this.start,this.goal)-0.01&&canStop(node.pose))this.closest=node;
      const consider=(pose:DrivePose,extra:number)=>{
        const cost=node.cost+extra,key=this.key(pose);
        if(cost>=(this.costs.get(key)??Infinity)||!clear(node.pose,pose))return;
        const remaining=distance(pose,this.goal)/unit;
        this.costs.set(key,cost);this.push({pose,cost,score:cost+remaining,remaining,parent:node});
      };
      for(const reverse of [false,true])for(const turn of [0,-1,1,-2,2])for(const length of this.options.lengths??[1]){
        const heading=(node.pose.heading+turn+8)%8,[dx,dy]=directions[heading]!,sign=reverse?-1:1;
        const travel=this.step*length;
        const pose={x:node.pose.x+dx*travel*sign,y:node.pose.y+dy*travel*sign,heading,reverse};
        consider(pose,Math.hypot(dx,dy)*travel/unit*(reverse?1.8:1)+Math.abs(turn)*0.15+(Math.abs(turn)===2?3:0)+(!!node.pose.reverse!==reverse?0.5:0));
      }
      // Expensive but available throughout the search: no failed k-turn loop is required first.
      for(const turn of [-1,1])consider({...node.pose,heading:(node.pose.heading+turn+8)%8,reverse:false},8);
    }
    if(this.open.length)return {status:"pending"};
    return this.result={status:"unreachable",path:this.closest?this.route(this.closest):undefined};
  }
}

/** Synchronous geometry/test convenience. Runtime retains DriveSearch across timer ticks. */
export function findDrivePath(start:DrivePose,goal:Point,grid:number,clear:(a:DrivePose,b:DrivePose)=>boolean,limit=1200,milliseconds=Infinity,approach=false):DrivePose[]|undefined {
  return new DriveSearch(start,goal,grid,{limit,approach}).advance(clear,()=>true,milliseconds,limit+1).path;
}
