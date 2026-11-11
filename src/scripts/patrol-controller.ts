import {MODULE_ID} from "./settings.js";
import {patrolAvailable,patrolConfig,patrolStatus,savePatrol,scenePatrolStopped,setScenePatrolStopped} from "./patrol-runtime.js";

function patrolIcon(status:string):string {
  if(status==="Stopped")return "fa-stop";
  if(status.startsWith("Patrol error"))return "fa-triangle-exclamation";
  if(["Moving","Turning in place","Reversing"].includes(status))return "fa-person-walking";
  return "fa-hourglass-half";
}

let active:Dialog|undefined;
const positions=new Map<string,{left:number;top:number}>();
export function openPatrolController(edit:(token?:TokenDocument)=>Promise<void>):void {
  if(!game.user?.isGM||!canvas.scene)return;
  if(active){active.bringToTop();return;}
  const positionKey=`${MODULE_ID}:patrol-position:${game.world?.id??"world"}:${game.user.id}`;
  const layoutKey=positionKey+":layout";
  let narrow=false;
  try {narrow=localStorage.getItem(layoutKey)==="narrow";} catch { /* Use the default wide view. */ }
  const width=()=>narrow?136:240;
  let saved=positions.get(positionKey);
  if(!saved)try {
    const value=JSON.parse(localStorage.getItem(positionKey)??"null");
    if(value && Number.isFinite(value.left) && Number.isFinite(value.top))saved={left:value.left,top:value.top};
  } catch { /* Retain normal placement when browser storage is unavailable. */ }
  const restored=saved?{left:Math.max(0,Math.min(saved.left,innerWidth-width())),top:Math.max(0,Math.min(saved.top,innerHeight-40))}:{};
  class PatrolDialog extends Dialog {
    override setPosition(position?:Partial<Omit<Application.Position,"zIndex">>) {
      const result=super.setPosition(position);
      if(result && typeof result.left==="number" && typeof result.top==="number" && Number.isFinite(result.left) && Number.isFinite(result.top)){
        const value={left:result.left,top:result.top};positions.set(positionKey,value);
        try {localStorage.setItem(positionKey,JSON.stringify(value));}catch { /* Session memory remains available. */ }
      }
      return result;
    }
  }
  const scene=canvas.scene;
  let timer:ReturnType<typeof setInterval>|undefined,root:HTMLElement|undefined,busy=false,signature="";
  const content='<section class="patrol-controller"><header><button type="button" data-scene-toggle></button><button type="button" data-scene-add aria-label="Add patrol" title="Add patrol"><i class="fas fa-plus" aria-hidden="true"></i></button><button type="button" data-layout><i aria-hidden="true"></i></button></header><div data-patrol-list></div><p role="alert"></p></section>';
  const run=async(action:()=>Promise<void>)=>{
    if(busy||!root)return;busy=true;
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
    try{root.querySelector('[role="alert"]')!.textContent="";if(!game.user?.isGM||canvas.scene?.id!==scene.id)throw new Error("Return to this scene as a GM.");await action();}
    catch(error){root.querySelector('[role="alert"]')!.textContent=error instanceof Error?error.message:String(error);}
    finally{busy=false;signature="";refresh();}
  };
  const rows=new Map<TokenDocument,HTMLElement>();
  let outline:PIXI.Graphics|undefined;
  function clearOutline() {
    if(outline && !outline.destroyed)outline.destroy();
    outline=undefined;
  }
  function highlight(token:TokenDocument) {
    const object=token.object;
    if(!object || object.destroyed)return;
    if(outline && !outline.destroyed && outline.parent===object)return;
    clearOutline();
    outline=new PIXI.Graphics();
    outline.eventMode="none";
    const padding=12;
    const span=Math.min(32,Math.min(object.w,object.h)/3);
    const left=-padding, right=object.w+padding, top=-padding, bottom=object.h+padding;
    for(const [width,color] of [[16,0x101820],[10,0x00ffea]] as const){
      outline.lineStyle(width,color,1);
      for(const [x,y,dx,dy] of [[left,top,1,1],[right,top,-1,1],[left,bottom,1,-1],[right,bottom,-1,-1]] as const){
        outline.moveTo(x+dx*span,y).lineTo(x,y).lineTo(x,y+dy*span);
      }
    }
    object.addChild(outline);
  }
  function createRow(token:TokenDocument) {
    const row=document.createElement("div");
    row.className="patrol-controller-row";
    row.dataset.tokenId=token.id!;
    row.innerHTML='<button type="button" data-action="toggle"><i aria-hidden="true"></i><img alt=""><span class="patrol-token-name"></span></button><button type="button" data-action="edit"><i class="fas fa-pen" aria-hidden="true"></i></button><span class="patrol-tooltip" aria-hidden="true"></span>';
    const toggle=row.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
    const editButton=row.querySelector<HTMLButtonElement>('[data-action="edit"]')!;
    const togglePatrol=()=>{
      const config=patrolConfig(token);
      return savePatrol(token,{...config,enabled:!config.enabled});
    };
    for(const [button,action] of [[toggle,togglePatrol],[editButton,async()=>edit(token)]] as const){
      button.addEventListener("click",()=>void run(async()=>{
        if(scene.tokens.get(token.id!)!==token)throw new Error("This token no longer exists.");
        await action();
      }));
    }
    row.addEventListener("pointerenter",()=>highlight(token));
    row.addEventListener("pointerleave",clearOutline);
    row.addEventListener("focusin",()=>highlight(token));
    row.addEventListener("focusout",clearOutline);
    return row;
  }
  const refresh=()=>{
    if(!root||busy)return;
    if(!game.user?.isGM||canvas.scene?.id!==scene.id){void dialog.close();return;}
    const tokens=scene.tokens.contents.filter(patrolAvailable);
    const stopped=scenePatrolStopped(scene),next=JSON.stringify([stopped,tokens.map(t=>[t.id,t.name,t.texture?.src,t.actor?.img,patrolConfig(t).enabled,patrolStatus(t)])]);
    if(next===signature)return;signature=next;
    const toggle=root.querySelector<HTMLButtonElement>('[data-scene-toggle]')!;
    const icon=document.createElement('i');icon.className=stopped?'fas fa-play':'fas fa-pause';icon.setAttribute('aria-hidden','true');toggle.replaceChildren(icon,' Scene');
    toggle.setAttribute('aria-label',stopped?'Play scene patrols':'Pause scene patrols');toggle.setAttribute("aria-pressed",String(!stopped));toggle.title=`${stopped?'Play':'Pause'} scene patrols. Individually stopped patrols stay stopped.`;
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);
    const list=root.querySelector('[data-patrol-list]')!;
    for(const [token,row] of rows){
      if(tokens.includes(token))continue;
      if(outline?.parent===token.object)clearOutline();
      row.remove();
      rows.delete(token);
    }
    list.querySelector("p")?.remove();
    if(!tokens.length){const empty=document.createElement('p');empty.textContent="No patrols configured on this scene.";list.append(empty);}
    for(const token of tokens){
      let row=rows.get(token);
      if(!row){row=createRow(token);rows.set(token,row);list.append(row);}
      const enabled=patrolConfig(token).enabled,status=patrolStatus(token),name=token.name??"Token";
      const toggle=row.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
      toggle.querySelector("i")!.className="fas "+patrolIcon(status);
      toggle.setAttribute("aria-label",`${enabled?'Stop':'Start'} ${name}. ${status}`);
      toggle.setAttribute("aria-pressed",String(enabled));
      toggle.querySelector(".patrol-token-name")!.textContent=name;
      const art=token.texture?.src;
      const portrait=art && !/\.(webm|mp4|m4v|ogv)(?:[?#]|$)/i.test(art)?art:token.actor?.img;
      const image=row.querySelector("img")!;
      const src=portrait || "icons/svg/mystery-man.svg";
      if(image.getAttribute("src")!==src)image.src=src;
      row.querySelector('[data-action="edit"]')!.setAttribute("aria-label",`Edit ${name}`);
      row.querySelector(".patrol-tooltip")!.textContent=`${name} · ${status}`;
    }
  };
  const close=()=>{void dialog.close();};
  const dialog=new PatrolDialog({title:"Scene Tools - Patrol",content,buttons:{},render:html=>{
    root=(html as JQuery)[0]!;
    root.querySelector('[data-scene-toggle]')!.addEventListener('click',()=>void run(()=>setScenePatrolStopped(scene,!scenePatrolStopped(scene))));
    root.querySelector('[data-scene-add]')!.addEventListener('click',()=>void run(()=>edit()));
    const panel=root.querySelector<HTMLElement>(".patrol-controller")!;
    const layout=panel.querySelector<HTMLButtonElement>("[data-layout]")!;
    const showLayout=()=>{
      panel.classList.toggle("is-narrow",narrow);
      layout.title=narrow?"Switch to wide view":"Switch to narrow view";
      layout.setAttribute("aria-label",layout.title);
      layout.querySelector("i")!.className=narrow?"fas fa-expand":"fas fa-compress";
    };
    layout.addEventListener("click",()=>{
      narrow=!narrow;
      showLayout();
      const left=dialog.element[0]!.getBoundingClientRect().left;
      dialog.setPosition({width:width(),left:Math.max(0,Math.min(left,innerWidth-width()))});
      try {localStorage.setItem(layoutKey,narrow?"narrow":"wide");} catch { /* Keep the current view. */ }
    });
    showLayout();
    signature="";refresh();if(timer)clearInterval(timer);timer=setInterval(refresh,500);
  },close:()=>{clearOutline();if(timer)clearInterval(timer);Hooks.off('canvasTearDown',close);active=undefined;}},{id:"pneuma-patrol-controller",width:width(),height:"auto",resizable:false,...restored});
  Hooks.on('canvasTearDown',close);active=dialog;dialog.render(true);
}
