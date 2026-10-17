import {MODULE_ID} from "./settings.js";
import {pinningEnabled} from "./map-pins-data.js";

/** Change only the Notes container; native Note permission and vision checks remain intact. */
export function refreshPinVisibility():void {
  if(!canvas.ready || !canvas.notes?.objects)return;
  const visible=pinningEnabled(canvas.scene) || canvas.notes.active || Boolean(game.settings!.get("core","notesDisplayToggle"));
  canvas.notes.objects.visible=visible;
  canvas.notes.interactiveChildren=visible;
}
let installed=false;
export function installPinVisibility():void {
  if(installed)return;
  libWrapper.register(MODULE_ID,"NotesLayer.prototype._deactivate",function(this:NotesLayer,wrapped:()=>unknown){
    const result=wrapped();
    if(pinningEnabled(canvas.scene) && this.objects){this.objects.visible=true;this.interactiveChildren=true;}
    return result;
  },"WRAPPER");
  libWrapper.register(MODULE_ID,"NotesLayer.prototype._draw",async function(this:NotesLayer,wrapped:(...args:unknown[])=>Promise<unknown>,...args:unknown[]){
    const result=await wrapped(...args);
    if(pinningEnabled(canvas.scene) && this.objects){this.objects.visible=true;this.interactiveChildren=true;}
    return result;
  },"WRAPPER");
  // Client settings invoke onChange directly, without a Setting document hook.
  const setting=game.settings!.settings.get("core.notesDisplayToggle");
  if(setting){
    const original=setting.onChange;
    setting.onChange=value=>{original?.(value);refreshPinVisibility();};
  }
  Hooks.on("canvasReady",refreshPinVisibility);
  Hooks.on("updateScene",(scene:Scene)=>{if(scene.id===canvas.scene?.id)refreshPinVisibility();});
  installed=true;
}
