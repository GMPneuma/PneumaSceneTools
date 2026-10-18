import {MODULE_ID} from "./settings.js";
import {patrolConfig,savePatrol} from "./patrol-runtime.js";
import {styleVehicleHud} from "./vehicle-hud-style.js";

export function registerPatrolHud(edit:(token:TokenDocument)=>Promise<void>):void {
  let refresh:((token:TokenDocument)=>void)|undefined;
  const mount=(hud:TokenHUD,html:JQuery)=>{
    const token=hud.object?.document,root=html[0];
    if(!root||!token)return;
    root.querySelectorAll('[data-patrol-hud]').forEach(button=>button.remove());
    refresh=changed=>{if(changed.uuid===token.uuid&&root.isConnected)mount(hud,html);};
    if(!game.user?.isGM||!foundry.utils.getProperty(token,`flags.${MODULE_ID}.patrol`))return;
    let controls=root.querySelector<HTMLElement>('.pneuma-vehicle-controls');
    if(!controls){
      controls=document.createElement('div');controls.className='pneuma-vehicle-controls';
      controls.setAttribute('role','group');controls.setAttribute('aria-label','Scene Tools controls');
      (root.querySelector(':scope > .col.left')??root).append(controls);
    }
    let busy=false;
    const add=(action:string,label:string,icon:string,run:()=>Promise<void>)=>{
      const button=document.createElement('div');button.className='control-icon';
      button.dataset.patrolHud=action;button.dataset.tooltip=label;
      button.setAttribute('role','button');button.tabIndex=0;button.setAttribute('aria-label',label);
      button.innerHTML=`<i class="fas ${icon}" aria-hidden="true"></i>`;
      const activate=(event:Event)=>{
        if(event instanceof KeyboardEvent&&event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();event.stopPropagation();
        if(busy||!game.user?.isGM)return;
        busy=true;button.setAttribute('aria-disabled','true');
        void run().catch(error=>ui.notifications?.error(String(error))).finally(()=>{busy=false;if(root.isConnected)mount(hud,html);});
      };
      button.addEventListener('click',activate);button.addEventListener('keydown',activate);controls!.append(button);
    };
    add('edit','Edit Patrol','fa-route',()=>edit(token));
    const enabled=patrolConfig(token).enabled;
    add('toggle',enabled?'Stop Patrol':'Start Patrol',enabled?'fa-stop':'fa-play',async()=>{
      const config=patrolConfig(token);await savePatrol(token,{...config,enabled:!config.enabled});
    });
    requestAnimationFrame(()=>styleVehicleHud(root));
  };
  Hooks.on('renderTokenHUD',mount);
  Hooks.on('updateToken',(token:TokenDocument,changes:Record<string,unknown>)=>{
    const flags=foundry.utils.getProperty(changes,`flags.${MODULE_ID}`) as Record<string,unknown>|undefined;
    if(flags&&('patrol' in flags||'-=patrol' in flags)||Object.keys(changes).some(key=>key.startsWith(`flags.${MODULE_ID}.patrol`)||key===`flags.${MODULE_ID}.-=patrol`))refresh?.(token);
  });
  Hooks.on('canvasTearDown',()=>{refresh=undefined;});
}
