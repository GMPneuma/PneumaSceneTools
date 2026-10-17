import {MODULE_ID} from "./settings.js";
import {pinInfo} from "./map-pins-data.js";

const pending=new Map<string,Promise<void>>();
/** Keep the pin's selected image at the bottom of its own POI page. */
export async function syncPinImage(note:NoteDocument):Promise<void> {
  if(!game.user?.isGM)return;
  const page=note.entry?.pages.get(note.pageId??"");
  if(page?.type!=="text" || !foundry.utils.getProperty(page,`flags.${MODULE_ID}.poi`))return;
  const key=page.uuid;
  const task=(pending.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
    const src=pinInfo(note)?.imageSrc;
    if(src===undefined)return;
    const path=src.trim();
    if(/^\s*(javascript|vbscript):/i.test(path))throw new Error("Choose a valid POI image path.");
    const original=page.text.content??"";
    const document=new DOMParser().parseFromString(original,"text/html");
    document.querySelectorAll('[data-poi-image]').forEach(element=>element.remove());
    if(path){
      const figure=document.createElement("section");figure.dataset.poiImage="true";
      const heading=document.createElement("h2");heading.textContent="Image";
      const image=document.createElement("img");image.setAttribute("src",path);image.alt=note.text||page.name;
      figure.append(heading,image);document.body.append(figure);
    }
    const content=document.body.innerHTML;
    if(content===original)return;
    await page.update({text:{content}});
    if(page.text.content!==content)throw new Error("Foundry did not save the POI image to its journal page.");
  });
  pending.set(key,task);
  try{await task;}finally{if(pending.get(key)===task)pending.delete(key);}
}
