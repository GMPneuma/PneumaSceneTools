import {pinningEnabled} from "./map-pins-data.js";

const originalScales=new WeakMap<Note,{x:number;y:number}>();
/** Limit screen size above 100% zoom; scale icon, label, and hit target together. */
export function refreshPinScale(note:Note):void {
  if(note.destroyed)return;
  const enabled=pinningEnabled(note.document.parent);
  let original=originalScales.get(note);
  if(!enabled){
    if(original){note.scale.set(original.x,original.y);originalScales.delete(note);}
    return;
  }
  if(!original){original={x:note.scale.x,y:note.scale.y};originalScales.set(note,original);}
  const zoom=canvas.stage?.scale.x??1;
  const factor=1/Math.max(1,zoom);
  const x=original.x*factor,y=original.y*factor;
  if(note.scale.x!==x||note.scale.y!==y)note.scale.set(x,y);
}
function refreshScenePins():void {
  for(const note of canvas.notes?.placeables??[])refreshPinScale(note);
  for(const note of canvas.notes?.preview?.children??[])if(note instanceof Note)refreshPinScale(note);
}
let installed=false;
export function installPinScaling():void {
  if(installed)return;
  Hooks.on("drawNote",refreshPinScale);
  Hooks.on("refreshNote",refreshPinScale);
  Hooks.on("canvasReady",refreshScenePins);
  Hooks.on("canvasPan",refreshScenePins);
  Hooks.on("updateScene",(scene:Scene)=>{if(scene.id===canvas.scene?.id)refreshScenePins();});
  installed=true;
}
