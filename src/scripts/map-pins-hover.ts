import {managedPinPage,pinImagePath} from './map-pins-image.js';
import {pinInfo,pinningEnabled,pinningChanged} from "./map-pins-data.js";
import {changesSeatFields} from "./vehicle-seat-changes.js";
import {MODULE_ID} from "./settings.js";

export interface HoverSection {name:string;html:string;}
/** Empty values select all fields; JSON arrays select individual fields or none. */
export function selectedHoverFields(value:string):string[]|undefined {
  if(!value.trim())return undefined;
  try {const parsed:unknown=JSON.parse(value);if(Array.isArray(parsed)&&parsed.every(v=>typeof v==="string"))return parsed;}catch {}
  return [];
}
/** Every heading defines a section through the next heading, regardless of heading level. */
export function parseHoverPage(html:string):HoverSection[] {
  const doc=new DOMParser().parseFromString(html,"text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,form,input,button").forEach(node=>node.remove());
  doc.querySelectorAll("*").forEach(node=>{
    for(const attr of [...node.attributes])if(attr.name.startsWith("on")||(["href","src","xlink:href"].includes(attr.name)&&/^\s*(javascript|vbscript):/i.test(attr.value)))node.removeAttribute(attr.name);
  });
  const headings=[...doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  if(!headings.length)return doc.body.textContent?.trim()||doc.body.querySelector("img")?[{name:"Description",html:doc.body.innerHTML}]:[];
  const sections=headings;
  return sections.map((heading,index)=>{
    const range=doc.createRange();range.setStartAfter(heading);
    const next=sections[index+1];if(next)range.setEndBefore(next);else range.setEnd(doc.body,doc.body.childNodes.length);
    const content=doc.createElement("div");content.append(range.cloneContents());
    return {name:heading.textContent?.trim()??"",html:content.innerHTML};
  }).filter(section=>Boolean(section.name));
}
let hideTimer:ReturnType<typeof setTimeout>|undefined;
const cancelHide=()=>{if(hideTimer)clearTimeout(hideTimer);hideTimer=undefined;};
let generation=0;
let card:HTMLElement|undefined;
let pointer={x:20,y:20};
export function hidePinHover():void {cancelHide();generation++;card?.remove();card=undefined;}
function position():void {
  if(!card) return;
  const width=card.offsetWidth,height=card.offsetHeight;
  card.style.left=`${Math.max(8,Math.min(pointer.x+20,innerWidth-width-8))}px`;
  card.style.top=`${Math.max(8,Math.min(pointer.y+16,innerHeight-height-8))}px`;
}
export async function showPinHover(note:Note):Promise<void> {
  hidePinHover();
  if(document.querySelector(".pneuma-pin-context"))return;
  const request=generation,info=pinInfo(note.document);
  const journal=note.document.entry;
  if(!pinningEnabled(note.document.parent) || !info?.hover || !game.user || !journal) return;
  const ownPage=journal.pages.get(note.document.pageId??"");
  const access=ownPage??journal;
  if(!access.testUserPermission(game.user,"OBSERVER"))return;
  const managed=Boolean(ownPage && foundry.utils.getProperty(ownPage,`flags.${MODULE_ID}.poi`));
  const imagePageId=managed?ownPage!.id!:info.imagePageId;
  const descriptionPageId=managed?ownPage!.id!:info.descriptionPageId;
  const permitted=(id:string,type:string)=>{
    const page=journal.pages.get(id);
    return (page?.type===type || type==="image" && page?.type==="text") && page.testUserPermission(game.user!,"OBSERVER") ? page : undefined;
  };
  const image=permitted(imagePageId,"image"),description=permitted(descriptionPageId,"text");
  if(!image && !description) return;
  const content=description ? await TextEditor.enrichHTML(description.text.content??"",{secrets:true}) : "";
  if(request!==generation || document.querySelector(".pneuma-pin-context") || !pinningEnabled(note.document.parent) || !access.testUserPermission(game.user,"OBSERVER")) return;
  // Permissions may have changed while enrichment was pending.
  const allowedDescription=permitted(descriptionPageId,"text"),allowedImage=permitted(imagePageId,"image");
  if(!allowedDescription && !allowedImage) return;
  card=document.createElement("aside");card.className="app window-app pneuma-pin-hover";card.setAttribute("role","tooltip");
  const body=document.createElement("div");body.className="window-content";card.append(body);
  const title=document.createElement("h3");title.textContent=note.document.text||journal.name;body.append(title);
  const top=document.createElement("div");top.className="pin-hover-top";
  let imagePath=allowedImage?.src;
  if(allowedImage?.type==="text") {
    const safe=parseHoverPage(allowedImage.text.content??"").map(section=>section.html).join("");
    imagePath=new DOMParser().parseFromString(safe,"text/html").querySelector("img")?.getAttribute("src")??undefined;
  }
  if(allowedDescription || allowedImage){const path=pinImagePath(note.document);if(managedPinPage(note.document))imagePath=path||undefined;else if(path.trim())imagePath=path.trim();}
  if(imagePath && !/^\s*(javascript|vbscript):/i.test(imagePath)) {
    const img=document.createElement("img");img.src=imagePath;img.alt=allowedImage?.name??"";img.addEventListener("load",position);top.append(img);top.classList.add("has-image");
  }
  if(allowedDescription) {
    const descriptionDoc=new DOMParser().parseFromString(content,"text/html");
    descriptionDoc.querySelectorAll('[data-poi-image]').forEach(element=>element.remove());
    const sections=parseHoverPage(descriptionDoc.body.innerHTML);
    const selected=selectedHoverFields(info.sections)?.map(name=>name.toLocaleLowerCase());
    const fields=document.createElement("dl");fields.className="pin-hover-fields";
    for(const section of sections) {
      if(["description","image"].includes(section.name.toLocaleLowerCase()))continue;
      if(selected&&!selected.includes(section.name.toLocaleLowerCase()))continue;
      const label=document.createElement("dt");label.textContent=section.name;
      const value=document.createElement("dd");value.innerHTML=section.html;
      // Editors often retain blank paragraphs; they should not stretch compact detail rows.
      value.querySelectorAll("p").forEach(p=>{if(!p.textContent?.trim()&&[...p.children].every(child=>child.tagName==="BR"))p.remove();});
      fields.append(label,value);
    }
    if(fields.childElementCount)top.append(fields);
    if(top.childElementCount)body.append(top);
    const descriptions=sections.filter(section=>section.name.toLocaleLowerCase()==="description");
    if(descriptions.length){
      const bottom=document.createElement("section");bottom.className="pin-hover-description";
      for(const section of descriptions){const text=document.createElement("div");text.innerHTML=section.html;if(imagePath)text.querySelectorAll("img").forEach(img=>{if(img.getAttribute("src")===imagePath)img.remove();});bottom.append(text);}
      body.append(bottom);
    }
  }else if(top.childElementCount)body.append(top);
  const hint=document.createElement("small");hint.className="pin-hover-hint";hint.textContent=canvas.notes?.active ? "Double-click to configure the note. Right-click to open its journal." : "Double-click the pin to open its journal.";body.append(hint);
  card.addEventListener("pointerenter",cancelHide);
  card.addEventListener("pointerleave",hidePinHover);
  document.body.append(card);
  // Use the native canvas UI surface (Players), including its texture and alpha,
  // rather than the opaque journal/window-content surface.
  const controls=document.getElementById("players");
  const surface=controls?getComputedStyle(controls):undefined;
  card.style.setProperty("background",surface?.background??"rgba(0, 0, 0, 0.5)","important");
  // Add a little opacity beneath the native texture for readability over maps.
  card.style.setProperty("background-color",`color-mix(in srgb, ${surface?.backgroundColor??"rgba(0, 0, 0, 0.5)"} 70%, #000 30%)`,"important");
  body.style.setProperty("background","transparent","important");
  body.style.setProperty("color",surface?.color??"#f0f0e0","important");
  if(surface){card.style.border=surface.border;card.style.borderRadius=surface.borderRadius;card.style.boxShadow=surface.boxShadow;}
  position();
}
export function registerPinHover():void {
  document.addEventListener("pointermove",event=>{if(card?.contains(event.target as Node))return;pointer={x:event.clientX,y:event.clientY};if(!hideTimer)position();});
  Hooks.on("hoverNote",(note:Note,hovered:boolean)=>{if(hovered) void showPinHover(note).catch(()=>hidePinHover());else {generation++;cancelHide();hideTimer=setTimeout(hidePinHover,180);}});
  for(const hook of ["canvasTearDown","updateJournalEntry","updateJournalEntryPage","deleteJournalEntry","deleteJournalEntryPage","updateNote","deleteNote","updateUser"]) Hooks.on(hook,hidePinHover);
  Hooks.on('updateScene',(scene:Scene,changes:object)=>{if(scene.id===canvas.scene?.id&&(pinningChanged(changes)||changesSeatFields(changes,['notes','ownership','grid','width','height','padding'])))hidePinHover();});
}
