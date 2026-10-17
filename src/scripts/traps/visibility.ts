import {MODULE_ID} from "../settings.js";

export const HAZARD_VISIBILITY_OPTION="pneumaSceneToolsHazardVisibility";
export const hazardVisibilityOptions={ [HAZARD_VISIBILITY_OPTION]:true,animate:false,pan:false };
const visibilityUpdates=new WeakSet<Token>();
let installed=false;

/** Native v12 auto-controls a revealed token with pan:true when nothing is selected. */
export function registerHazardVisibility():void{
  if(installed||typeof globalThis.libWrapper?.register!=="function")return;
  installed=true;
  libWrapper.register(MODULE_ID,"CONFIG.Token.objectClass.prototype._onUpdate",function(this:Token,wrapped:(...args:unknown[])=>unknown,changed:Record<string,unknown>,options:Record<string,unknown>,...args:unknown[]){
    if(!options?.[HAZARD_VISIBILITY_OPTION]||!("hidden" in changed)||!foundry.utils.getProperty(this.document,`flags.${MODULE_ID}.hazardBody`))return wrapped(changed,options,...args);
    const nested=visibilityUpdates.has(this);visibilityUpdates.add(this);
    try{return wrapped(changed,options,...args);}finally{if(!nested)visibilityUpdates.delete(this);}
  },"WRAPPER");
  libWrapper.register(MODULE_ID,"CONFIG.Token.objectClass.prototype.control",function(this:Token,wrapped:(options?:Token.ControlOptions)=>boolean,options?:Token.ControlOptions){
    return wrapped(visibilityUpdates.has(this)?{...options,pan:false}:options);
  },"WRAPPER");
}
