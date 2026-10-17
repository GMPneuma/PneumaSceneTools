import {MODULE_ID} from "./settings.js";
import type {SeatLayout} from "./vehicle-seats-model.js";

export interface SeatAction {
  action: "board" | "exit" | "layout";
  vehicleId?: string;
  seatId?: string;
  layout?: SeatLayout;
  template?: boolean;
  templateAllImages?: boolean;
}
interface Address {id:string; user:string; gm:string; scene:string; token:string}
interface Request extends Address {seatType:"request"; action:"board"|"exit"; vehicleId?:string; seatId?:string}
interface Reply extends Address {seatType:"reply"; error?:string}
interface Grant extends Address {seatType:"grant"}
interface Complete extends Address {seatType:"complete";error?:string}
const channel=`module.${MODULE_ID}`;
const timeout=15000;
const pending=new Map<string,Address & {action:SeatAction;stage:"waiting"|"executing"|"completed";resolve():void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>();
const handled=new Map<string,{fingerprint:string;expires:number;result:Promise<Reply>;complete:boolean}>();
const running=new Map<string,{address:Address;resolve(error?:string):void}>();
const registered=new WeakSet<object>();
type Execute=(token:TokenDocument,action:SeatAction,userId:string,mode?:"validate"|"owner")=>Promise<void>;
type Enqueue=<T>(work:()=>Promise<T>)=>Promise<T>;
const message=(error:unknown)=>error instanceof Error?error.message:String(error);

function finish(id:string,error?:string):void {
  const wait=pending.get(id);if(!wait)return;
  clearTimeout(wait.timer);pending.delete(id);
  if(error)wait.reject(Error(error));else wait.resolve();
}
export function sendSeatRequest(token:TokenDocument,action:SeatAction):Promise<void>{
  const gm=game.users?.activeGM;
  if(!gm || !game.user || !game.socket || game.socket.connected===false)throw Error("Vehicle requests require a connected active GM.");
  if(action.action==="layout")throw Error("Only a GM can configure vehicle seats locally.");
  const request:Request={seatType:"request",id:foundry.utils.randomID(),user:game.user.id!,gm:gm.id!,scene:token.parent!.id!,token:token.id!,action:action.action,
    ...(action.action==="board"?{vehicleId:action.vehicleId,seatId:action.seatId}:{})};
  return new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>finish(request.id,"Seat request timed out. Check the seat list before retrying."),timeout);
    pending.set(request.id,{...request,action:structuredClone(action),stage:"waiting",resolve,reject,timer});
    try{game.socket!.emit(channel,request);}catch(error){finish(request.id,message(error));}
  });
}

/** Requests and replies live only in memory; only completed seat assignments are saved. */
export function registerSeatRequests(execute:Execute,enqueue:Enqueue):void {
  const connect=()=>{
    const socket=game.socket;if(!socket || registered.has(socket))return;
    registered.add(socket);
    socket.on(channel,(value:unknown)=>{
      if(!value || typeof value!=="object")return;
      const wire=value as Request|Reply|Grant|Complete;
      if(![wire.id,wire.user,wire.gm,wire.scene,wire.token].every(v=>typeof v==="string" && v.length>0 && v.length<=64))return;
      if(wire.seatType==="grant"){
        const wait=pending.get(wire.id);
        if(!wait || wait.stage!=="waiting" || wire.user!==game.user?.id || wire.gm!==wait.gm || wire.scene!==wait.scene || wire.token!==wait.token || game.users?.activeGM?.id!==wait.gm)return;
        wait.stage="executing";
        const token=game.scenes?.get(wait.scene)?.tokens.get(wait.token);
        // The owner makes native writes. A forged requester/GM ID cannot authorize GM writes.
        const work=token?execute(token,wait.action,wait.user,"owner"):Promise.reject(Error("This token no longer exists."));
        const complete=(error?:string)=>{wait.stage="completed";socket.emit(channel,{seatType:"complete",id:wait.id,user:wait.user,gm:wait.gm,scene:wait.scene,token:wait.token,...(error?{error}:{})} satisfies Complete);};
        void work.then(()=>complete(),error=>complete(message(error)));return;
      }
      if(wire.seatType==="complete"){
        if(!game.user?.isGM || game.user.id!==wire.gm || game.users?.activeGM?.id!==wire.gm || wire.error!==undefined && typeof wire.error!=="string")return;
        const key=`${wire.user}:${wire.id}`,work=running.get(key);
        if(work && work.address.scene===wire.scene && work.address.token===wire.token && work.address.gm===wire.gm)work.resolve(wire.error);
        else {
          const previous=handled.get(key);
          if(previous?.complete)void previous.result.then(reply=>socket.emit(channel,reply));
        }
        return;
      }
      if(wire.seatType==="reply"){
        const wait=pending.get(wire.id);
        if(!wait || wire.user!==game.user?.id || wire.gm!==wait.gm || wire.scene!==wait.scene || wire.token!==wait.token)return;
        if(game.users?.activeGM?.id!==wait.gm)return finish(wire.id,"The active GM changed. Check the seat list before retrying.");
        if(wire.error!==undefined && typeof wire.error!=="string")return;
        if(!wire.error && wait.stage!=="completed")return;
        finish(wire.id,wire.error);return;
      }
      if(wire.seatType!=="request" || !game.user?.isGM || wire.gm!==game.user.id || game.users?.activeGM?.id!==game.user.id)return;
      // Remote commands never configure layouts or edit templates.
      if(!["board","exit"].includes(wire.action))return;
      if(wire.action==="board" && ![wire.vehicleId,wire.seatId].every(v=>typeof v==="string" && v.length>0 && v.length<=64))return;
      const request:Request={seatType:"request",id:wire.id,user:wire.user,gm:wire.gm,scene:wire.scene,token:wire.token,action:wire.action,
        ...(wire.action==="board"?{vehicleId:wire.vehicleId,seatId:wire.seatId}:{})};
      const key=`${request.user}:${request.id}`,fingerprint=JSON.stringify(request),now=Date.now();
      for(const [id,entry]of handled)if(entry.complete && entry.expires<=now)handled.delete(id);
      let entry=handled.get(key);
      if(entry && entry.fingerprint!==fingerprint)return;
      if(!entry){
        if(handled.size>=256){socket.emit(channel,{...request,seatType:"reply",error:"Vehicle requests are busy. Try again shortly."} satisfies Reply);return;}
        const result=enqueue(async()=>{
          try{
            if(Date.now()-now>=timeout)throw Error("The seat request expired before it could be processed.");
            if(game.users?.activeGM?.id!==request.gm || game.user?.id!==request.gm)throw Error("The active GM changed.");
            const user=game.users.get(request.user),token=game.scenes?.get(request.scene)?.tokens.get(request.token);
            if(!user?.active)throw Error("The requesting user is no longer connected.");
            if(!token)throw Error("This token no longer exists.");
            await execute(token,request,request.user,"validate");
            const error=await new Promise<string|undefined>(resolve=>{
              const timer=setTimeout(()=>{running.delete(key);resolve("Seat confirmation timed out. Check the seat list before retrying.");},timeout);
              running.set(key,{address:request,resolve(error){clearTimeout(timer);running.delete(key);resolve(error);}});
              try{socket.emit(channel,{seatType:"grant",id:request.id,user:request.user,gm:request.gm,scene:request.scene,token:request.token} satisfies Grant);}
              catch(error){running.get(key)?.resolve(message(error));}
            });
            return {...request,seatType:"reply",...(error?{error}:{})} satisfies Reply;
          }catch(error){return {...request,seatType:"reply",error:message(error)} satisfies Reply;}
        });
        entry={fingerprint,expires:now+60000,result,complete:false};handled.set(key,entry);
        const saved=entry;void result.then(()=>{saved.complete=true;saved.expires=Date.now()+60000;});
      }
      void entry.result.then(reply=>{if(socket.connected!==false)socket.emit(channel,reply);});
    });
    socket.on("disconnect",()=>{
      for(const id of pending.keys())finish(id,"Disconnected from Foundry. Check the seat list after reconnecting.");
      for(const work of running.values())work.resolve("Disconnected from Foundry. Check the seat list after reconnecting.");
      handled.clear();
    });
  };
  Hooks.on("ready",connect);connect();
  const checkGM=()=>{
    for(const [id,wait]of pending)if(game.users?.activeGM?.id!==wait.gm)finish(id,"The active GM changed. Check the seat list before retrying.");
    for(const work of running.values())if(game.users?.activeGM?.id!==work.address.gm)work.resolve("The active GM changed. Check the seat list before retrying.");
  };
  Hooks.on("userConnected",checkGM);Hooks.on("updateUser",checkGM);
}
