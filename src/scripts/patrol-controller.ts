import {MODULE_ID} from "./settings.js";
import {patrolConfig,patrolStatus,savePatrol,scenePatrolStopped,setScenePatrolStopped} from "./patrol-runtime.js";

let active:Dialog|undefined;
export function openPatrolController(edit:(token?:TokenDocument)=>Promise<void>):void {
  if(!game.user?.isGM||!canvas.scene)return;
  if(active){active.bringToTop();return;}
  const scene=canvas.scene;
  let timer:ReturnType<typeof setInterval>|undefined,root:HTMLElement|undefined,busy=false,signature="";
  const content='<section class="patrol-controller"><header><button type="button" data-scene-toggle></button><button type="button" data-scene-edit aria-label="Edit patrols" title="Edit patrols"><i class="fas fa-pen" aria-hidden="true"></i></button></header><div data-patrol-list></div><p role="alert"></p></section>';
  const run=async(action:()=>Promise<void>)=>{
    if(busy||!root)return;busy=true;
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
    try{root.querySelector('[role="alert"]')!.textContent="";if(!game.user?.isGM||canvas.scene?.id!==scene.id)throw new Error("Return to this scene as a GM.");await action();}
    catch(error){root.querySelector('[role="alert"]')!.textContent=error instanceof Error?error.message:String(error);}
    finally{busy=false;signature="";refresh();}
  };
  const refresh=()=>{
    if(!root||busy)return;
    if(!game.user?.isGM||canvas.scene?.id!==scene.id){void dialog.close();return;}
    const tokens=scene.tokens.contents.filter(t=>foundry.utils.getProperty(t,`flags.${MODULE_ID}.patrol`)!=null);
    const stopped=scenePatrolStopped(scene),next=JSON.stringify([stopped,tokens.map(t=>[t.id,t.name,patrolConfig(t).enabled,patrolStatus(t)])]);
    if(next===signature)return;signature=next;
    const toggle=root.querySelector<HTMLButtonElement>('[data-scene-toggle]')!;
    const icon=document.createElement('i');icon.className=stopped?'fas fa-play':'fas fa-pause';icon.setAttribute('aria-hidden','true');toggle.replaceChildren(icon);
    toggle.setAttribute('aria-label',stopped?'Play scene patrols':'Pause scene patrols');toggle.setAttribute("aria-pressed",String(!stopped));toggle.title=`${stopped?'Play':'Pause'} scene patrols. Individually stopped patrols stay stopped.`;
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);
    const list=root.querySelector('[data-patrol-list]')!;list.replaceChildren();
    if(!tokens.length){const empty=document.createElement('p');empty.textContent="No patrols configured on this scene.";list.append(empty);}
    for(const token of tokens){
      const row=document.createElement('div');row.className="patrol-controller-row";row.dataset.tokenId=token.id!;
      const enabled=patrolConfig(token).enabled;
      const toggle=document.createElement('button'),name=document.createElement('strong'),status=document.createElement('small');
      toggle.type='button';toggle.dataset.action='toggle';toggle.setAttribute('aria-label',`${enabled?'Stop':'Start'} ${token.name}`);toggle.setAttribute('aria-pressed',String(enabled));toggle.title=`${enabled?'Stop':'Start'} ${token.name}\n${patrolStatus(token)}`;
      name.textContent=token.name??"Token";status.textContent=patrolStatus(token);toggle.append(name,status);row.append(toggle);
      const editButton=document.createElement('button');editButton.type='button';editButton.dataset.action='edit';editButton.setAttribute('aria-label',`Edit ${token.name}`);editButton.title=`Edit ${token.name}`;
      const icon=document.createElement('i');icon.className='fas fa-pen';icon.setAttribute('aria-hidden','true');editButton.append(icon);row.append(editButton);
      for(const [button,action] of [[toggle,async()=>savePatrol(token,{...patrolConfig(token),enabled:!patrolConfig(token).enabled})],[editButton,async()=>edit(token)]] as const){
        button.addEventListener('click',()=>void run(async()=>{
          if(scene.tokens.get(token.id!)!==token)throw new Error("This token no longer exists.");
          await action();
        }));
      }
      list.append(row);
    }
  };
  const close=()=>{void dialog.close();};
  const dialog=new Dialog({title:"Scene Tools - Patrol",content,buttons:{},render:html=>{
    root=(html as JQuery)[0]!;
    root.querySelector('[data-scene-toggle]')!.addEventListener('click',()=>void run(()=>setScenePatrolStopped(scene,!scenePatrolStopped(scene))));
    root.querySelector('[data-scene-edit]')!.addEventListener('click',()=>void run(()=>edit()));
    signature="";refresh();if(timer)clearInterval(timer);timer=setInterval(refresh,500);
  },close:()=>{if(timer)clearInterval(timer);Hooks.off('canvasTearDown',close);active=undefined;}},{id:"pneuma-patrol-controller",width:160,height:"auto",resizable:true});
  Hooks.on('canvasTearDown',close);active=dialog;dialog.render(true);
}
