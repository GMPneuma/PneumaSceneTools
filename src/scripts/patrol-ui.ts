import {openPatrolController} from "./patrol-controller.js";
import {registerPatrolHud} from "./patrol-hud.js";
import {isVehicleToken} from "./vehicle-rotation.js";
import {MODULE_ID} from "./settings.js";
import {patrolConfig, patrolOperations, savePatrol, setScenePatrolStopped} from "./patrol-runtime.js";
import {validateConfig, type PatrolConfig} from "./patrol-model.js";

let active:Dialog|undefined;
export async function openPatrols(selected?:TokenDocument):Promise<void> {
  if(!game.user?.isGM||!canvas.scene)return;
  if(active){active.bringToTop();const select=active.element?.[0]?.querySelector<HTMLSelectElement>('[name="token"]');if(selected&&select&&select.value!==selected.id){select.value=selected.id!;select.dispatchEvent(new Event("change",{bubbles:true}));}return;}
  const scene=canvas.scene;
  let token=selected??canvas.tokens?.controlled[0]?.document??scene.tokens.contents.find(t=>!!t.actor);
  if(!token){ui.notifications?.warn("Place a token on this scene first.");return;}
  let draft=patrolConfig(token), dirty=false, busy=false, picking=false;
  let marker:PIXI.Graphics|undefined;
  let logTimer:ReturnType<typeof setInterval>|undefined;
  let root:HTMLElement|undefined;
  const board=document.getElementById("board");
  const clearMarker=()=>{if(marker&&!marker.destroyed)marker.destroy({children:true});marker=undefined;};
  const preview=()=>{
    clearMarker();if(!canvas.ready||canvas.scene?.id!==scene.id||!canvas.tokens||draft.mode==="roam")return;
    marker=new PIXI.Graphics();marker.eventMode="none";marker.lineStyle(2,0x48c5d8,0.9);
    draft.stops.forEach((stop,i)=>{
      if(i)marker!.lineTo(stop.x,stop.y);else marker!.moveTo(stop.x,stop.y);
    });
    if(draft.traversal==="loop"&&draft.stops.length>1)marker.lineTo(draft.stops[0]!.x,draft.stops[0]!.y);
    draft.stops.forEach((stop,i)=>{
      marker!.drawCircle(stop.x,stop.y,7);
      const label=new PIXI.Text(String(i+1),{fontSize:18,fill:0xffffff,stroke:0x000000,strokeThickness:3});label.position.set(stop.x+10,stop.y-10);marker!.addChild(label);
    });canvas.tokens.addChild(marker);
  };
  const stopPicking=()=>{
    picking=false;board?.removeEventListener("pointerdown",onPick,true);window.removeEventListener("keydown",onKey,true);
    if(root){root.querySelector('[data-action="pick"]')!.textContent="Place Waypoints";}
  };
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&picking){event.preventDefault();event.stopImmediatePropagation();stopPicking();}};
  const onPick=(event:PointerEvent)=>{
    if(!picking||event.button!==0||!canvas.stage||!board||busy)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(draft.stops.length>=100){ui.notifications?.warn("A patrol can have at most 100 stops.");return;}
    const bounds=board.getBoundingClientRect();
    const point=canvas.stage.toLocal(new PIXI.Point(event.clientX-bounds.left,event.clientY-bounds.top));
    draft.stops.push({x:Math.round(point.x),y:Math.round(point.y),wait:3});dirty=true;renderStops();preview();
  };
  function renderStops(){
    const body=root?.querySelector('tbody[data-stops]');if(!body)return;body.replaceChildren();
    draft.stops.forEach((stop,index)=>{
      const row=document.createElement("tr"), label=document.createElement("td");label.textContent=String(index+1);row.append(label);
      for(const field of ["x","y"] as const){
        const cell=document.createElement("td"),input=document.createElement("input");input.type="number";input.value=String(stop[field]);input.step="1";input.setAttribute("aria-label",`Stop ${index+1} ${field}`);
        input.addEventListener("change",()=>{if(Number.isFinite(input.valueAsNumber)){stop[field]=input.valueAsNumber;dirty=true;preview();}});cell.append(input);row.append(cell);
      }
      const controls=document.createElement("td");controls.style.whiteSpace="nowrap";
      for(const [action,title] of [["up","Move stop up"],["remove","Remove stop"]] as const){
        const button=document.createElement("button");button.type="button";button.title=title;button.setAttribute("aria-label",`${title} ${index+1}`);button.textContent=action==="up"?"↑":"×";button.style.width="26px";button.disabled=action==="up"&&index===0;
        button.addEventListener("click",()=>{if(action==="remove")draft.stops.splice(index,1);else [draft.stops[index-1],draft.stops[index]]=[draft.stops[index]!,draft.stops[index-1]!];dirty=true;renderStops();preview();});controls.append(button);
      }row.append(controls);body.append(row);
    });
  }
  const content=await renderTemplate(`modules/${MODULE_ID}/templates/patrol.hbs`,{
    tokens:scene.tokens.contents.filter(t=>t.actor).map(t=>({id:t.id,name:t.name,selected:t.id===token!.id})),config:draft,
    modes:{loop:"Loop",reverse:"Back & Forth",roam:"Random"},regions:Object.fromEntries(scene.regions.contents.map(r=>[r.id,r.name])),
  });
  if(active||canvas.scene?.id!==scene.id||!game.user?.isGM)return;
  const dialog=new Dialog({title:"Patrol",content,buttons:{},render:html=>{
    root=(html as JQuery)[0]!;
    const form=root.querySelector("form")!;
    const read=()=>{
      const data=new FormData(form);
      return validateConfig({...draft,mode:data.get("mode")==="roam"?"roam":"route",traversal:data.get("mode")==="reverse"?"reverse":"loop",regionId:String(data.get("regionId")),speed:Number(data.get("speed")),pauseMin:Number(data.get("pauseMin")),pauseMax:Number(data.get("pauseMax")),squareSteps:!isVehicleToken(token!)&&data.has("squareSteps"),squarePause:Number(data.get("squarePause")),waypointPauses:data.has("waypointPauses"),pathPauses:data.has("pathPauses"),sideTracks:data.has("sideTracks"),favorDistance:data.has("favorDistance"),pathPauseMin:Number(data.get("pathPauseMin")),pathPauseMax:Number(data.get("pathPauseMax")),pathPauseEvery:Number(data.get("pathPauseEvery")),sideTrackDistance:Number(data.get("sideTrackDistance")),maxMovementTime:Number(data.get("maxMovementTime")),frontOffset:Number(data.get("frontOffset")??draft.frontOffset),enabled:false});
    };
    const visibility=()=>{
      const vehicle=isVehicleToken(token!);
      root!.querySelector("[data-vehicle-status]")!.textContent=vehicle?"Yes":"No";
      const front=root!.querySelector<HTMLElement>("[data-vehicle-front]")!;
      front.classList.toggle("is-disabled",!vehicle);
      front.querySelector<HTMLSelectElement>("select")!.disabled=!vehicle;
      root!.querySelector<HTMLElement>("[data-square-steps]")!.hidden=vehicle;
      root!.querySelector<HTMLElement>("[data-square-pause]")!.hidden=vehicle||!draft.squareSteps;
      root!.querySelector<HTMLElement>("[data-side-tracks]")!.hidden=vehicle||draft.squareSteps;
      root!.querySelectorAll<HTMLElement>('[data-mode]').forEach(el=>{const visible=el.dataset.mode!.split(" ").includes(draft.mode);el.hidden=!visible;el.style.display=visible?"":"none";});
      root!.querySelectorAll<HTMLElement>("[data-option]").forEach(el=>{el.hidden=!draft[el.dataset.option as "pathPauses"|"sideTracks"];});
      root!.querySelector<HTMLElement>("[data-arrival-pause]")!.hidden=draft.mode!=="roam"&&!draft.waypointPauses;
    };
    let logSignature="";
    const renderOperations=()=>{
      const entries=patrolOperations(token!),signature=token!.uuid+JSON.stringify(entries);
      if(signature===logSignature)return;logSignature=signature;
      const list=root!.querySelector<HTMLOListElement>("[data-operations]")!;
      list.replaceChildren();
      for(const entry of entries){const row=document.createElement("li");row.textContent=entry.message;list.append(row);}
      if(!entries.length){const row=document.createElement("li");row.textContent="No operations recorded yet.";list.append(row);}
    };
    const populate=()=>{
      for(const key of ["squarePause","regionId","speed","pauseMin","pauseMax","pathPauseMin","pathPauseMax","pathPauseEvery","sideTrackDistance","maxMovementTime","frontOffset"] as const)(form.elements.namedItem(key) as HTMLInputElement|HTMLSelectElement).value=String(draft[key]);
      (form.elements.namedItem("mode") as HTMLSelectElement).value=draft.mode==="roam"?"roam":draft.traversal;
      for(const key of ["squareSteps","waypointPauses","pathPauses","sideTracks","favorDistance"] as const)(form.elements.namedItem(key) as HTMLInputElement).checked=draft[key];
      visibility();renderStops();preview();renderOperations();
    };
    const error=root.querySelector<HTMLElement>('[role="alert"]')!;
    const run=async(action:()=>Promise<void>)=>{
      if(busy)return;busy=true;stopPicking();form.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select').forEach(el=>el.disabled=true);
      try{error.textContent="";if(!game.user?.isGM||canvas.scene?.id!==scene.id)throw new Error("Return to the original scene as a GM.");await action();}
      catch(e){error.textContent=e instanceof Error?e.message:String(e);}
      finally{busy=false;form.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,button,select').forEach(el=>el.disabled=false);visibility();renderStops();}
    };
    form.addEventListener("submit",event=>event.preventDefault());
    form.addEventListener("input",event=>{
      const input=event.target as HTMLInputElement;
      if(!input.name||input.name==="token")return;
      dirty=true;try{draft=read();visibility();if(draft.mode==="roam")stopPicking();preview();error.textContent="";}catch(e){error.textContent=String(e);}
    });
    form.querySelector('[name="token"]')!.addEventListener("change",event=>void run(async()=>{
      const select=event.target as HTMLSelectElement, next=scene.tokens.get(select.value);
      if(!next){select.value=token!.id!;throw new Error("That token no longer exists.");}
      if(dirty&&!await Dialog.confirm({title:"Discard patrol edits?",content:"<p>Discard unsaved edits and select another token?</p>",defaultYes:false})){select.value=token!.id!;return;}
      token=next;draft=patrolConfig(token);dirty=false;populate();
    }));
    root.querySelector('[data-action="pick"]')!.addEventListener("click",()=>{
      if(picking){stopPicking();return;}picking=true;
      board?.addEventListener("pointerdown",onPick,true);window.addEventListener("keydown",onKey,true);
      root!.querySelector('[data-action="pick"]')!.textContent="Done placing stops";
    });
    for(const action of ["save","start"]){root.querySelector(`[data-action="${action}"]`)!.addEventListener("click",()=>{
      let value:PatrolConfig;try{value=read();}catch(e){error.textContent=String(e);return;}
      void run(async()=>{await savePatrol(token!,{...value,enabled:action==="start"});draft=patrolConfig(token!);dirty=false;});
    });}
    root.querySelector('[data-action="stop"]')!.addEventListener("click",()=>void run(async()=>{await savePatrol(token!,{...patrolConfig(token!),enabled:false});}));
    root.querySelector('[data-action="stop-all"]')!.addEventListener("click",()=>void run(async()=>{await setScenePatrolStopped(scene,true);}));
    populate();
    if(logTimer)clearInterval(logTimer);
    logTimer=setInterval(renderOperations,500);
  },close:()=>{stopPicking();clearMarker();if(logTimer)clearInterval(logTimer);active=undefined;Hooks.off("canvasTearDown",close);Hooks.off("deleteToken",deleted);}}, {id:"pneuma-patrol-editor",width:760,height:"auto",resizable:true});
  const close=()=>{void dialog.close();};
  const deleted=(deletedToken:TokenDocument)=>{if(deletedToken.uuid===token?.uuid)close();};
  Hooks.on("canvasTearDown",close);Hooks.on("deleteToken",deleted);active=dialog;dialog.render(true);
}
export function registerPatrolUI():void {
  registerPatrolHud(openPatrols);
  Hooks.on("getSceneControlButtons",(controls:SceneControl[])=>{
    if(game.user?.isGM)controls.find(c=>c.name==="token")?.tools.push({name:"patrol",title:"Scene Tools - Patrol",icon:"fas fa-route",button:true,onClick:()=>openPatrolController(openPatrols)});
  });
}
