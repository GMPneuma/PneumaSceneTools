import {MODULE_ID} from "./settings.js";
import {parseHoverPage} from "./map-pins-hover.js";
import {DEFAULT_PIN,pinInfo,pinningEnabled,validatePinDefaults} from "./map-pins-data.js";

const fields={size:"iconSize",tint:"texture.tint",fontFamily:"fontFamily",fontSize:"fontSize",textColor:"textColor",textAnchor:"textAnchor"} as const;
/** Empty fields preserve each pin's current appearance. Only native Note styling is written. */
export async function applyPinStyle(scene:Scene,ids:string[],data:FormData):Promise<void> {
  if(!game.user?.isGM || !pinningEnabled(scene))throw Error("Only GMs can restyle pins on enabled scenes.");
  const selected=[...new Set(ids)];
  if(!selected.length)throw Error("Select at least one pin.");
  if(selected.some(id=>!scene.notes.has(id)))throw Error("A selected pin was deleted. Reopen the POI manager and select again.");
  const values={...DEFAULT_PIN},changes:Record<string,string|number|boolean>={};
  for(const [key,path] of Object.entries(fields)) {
    const value=String(data.get(key)??"").trim();
    if(!value)continue;
    if(key==="size" || key==="fontSize" || key==="textAnchor") {
      const number=Number(value);
      if(!Number.isInteger(number))throw Error("Sizes must be whole numbers.");
      values[key]=number;changes[path]=number;
    }else {
      values[key as "tint"|"fontFamily"|"textColor"]=value;changes[path]=value;
    }
  }
  const prefix=`flags.${MODULE_ID}.mapPin`;
  for(const [key,path] of [["global","global"],["hover",`${prefix}.hover`]] as const) {
    const value=data.get(key);
    if(value==="true" || value==="false")changes[path!]=value==="true";
  }
  const mode=data.get("sectionsMode");
  if(mode==="all")changes[`${prefix}.sections`]="";
  if(mode==="selected")changes[`${prefix}.sections`]=JSON.stringify(data.getAll("sections").map(String));
  if(!Object.keys(changes).length)throw Error("Choose at least one appearance change.");
  validatePinDefaults(values);
  const updated=await scene.updateEmbeddedDocuments("Note",selected.map(_id=>({_id,...changes})));
  if(selected.some(id=>!updated?.some(note=>note.id===id)))throw Error("Not all selected pins were updated. Check the pins and retry.");
}

export async function openPinStyleEditor(scene:Scene,ids:string[]):Promise<void> {
  if(!game.user?.isGM || !pinningEnabled(scene) || !ids.length)return;
  const headings=new Set<string>();
  for(const id of ids){
    const note=scene.notes.get(id);if(!note)continue;
    const ownPage=note.entry?.pages.get(note.pageId??"");
    const managed=ownPage && foundry.utils.getProperty(ownPage,`flags.${MODULE_ID}.poi`);
    const page=managed?ownPage:note.entry?.pages.get(pinInfo(note)?.descriptionPageId??"");
    for(const section of parseHoverPage(page?.text.content??"",true))if(!["description","image"].includes(section.name.toLocaleLowerCase()))headings.add(section.name);
  }
  const content=await renderTemplate("modules/pneuma-scenetools/templates/map-pins-bulk.hbs",{
    count:ids.length,pins:ids.map(id=>{const note=scene.notes.get(id);return {name:note?.text||note?.entry?.name||"Map pin"};}),headings:[...headings],fonts:Object.entries(FontConfig.getAvailableFontChoices()).map(([value,label])=>({value,label}))
  });
  const dialog=new Dialog({title:"Edit selected POIs",content,buttons:{},render:html=>{
    const form=html[0]!.querySelector<HTMLFormElement>(".pin-bulk-style")!;
    const mode=form.elements.namedItem("sectionsMode") as HTMLSelectElement;
    mode.addEventListener("change",()=>{form.querySelector<HTMLElement>(".pin-section-list")!.hidden=mode.value!=="selected";});
    for(const picker of form.querySelectorAll<HTMLInputElement>("[data-pin-color]"))picker.addEventListener("input",()=>{
      (form.elements.namedItem(picker.dataset.pinColor!) as HTMLInputElement).value=picker.value;
    });
    let busy=false;
    form.addEventListener("submit",event=>{
      event.preventDefault();if(busy)return;
      busy=true;
      const button=form.querySelector<HTMLButtonElement>('[type="submit"]')!,message=form.querySelector(".pin-error")!;
      button.disabled=true;message.textContent="";
      void applyPinStyle(scene,ids,new FormData(form)).then(async()=>{
        ui.notifications?.info(`Updated ${ids.length} POI pins.`);await dialog.close();
      }).catch(cause=>{message.textContent=cause instanceof Error?cause.message:String(cause);})
        .finally(()=>{busy=false;button.disabled=false;});
    });
  }},{width:640,height:"auto",resizable:true});
  dialog.render(true);
}
