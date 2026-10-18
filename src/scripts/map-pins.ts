import {installPinScaling} from "./map-pins-scale.js";
import {registerPinJournal} from "./map-pin-journal.js";
import {exportPins,importPins,parsePinBundle} from "./map-pin-transfer.js";
import {cleanExistingPinTemplates} from "./map-pin-template-cleanup.js";
import {compactIconPicker,bindIconPicker} from "./map-pin-icons.js";
import {openPinStyleEditor} from "./map-pins-bulk.js";
import {installPinContextMenu,openPinJournal,pinPermissionDocument,pinPermissionLabel,playersCanReadPin,setPinPlayerRead} from "./map-pin-permissions.js";
import {MODULE_ID} from "./settings.js";
import {syncPinImage} from "./map-pins-image.js";
import {installPinVisibility} from "./map-pins-visibility.js";
import {createMapPin,DEFAULT_PIN,getPinDefaults,pinVisualDefaults,validatePinDefaults,EMPTY_TEMPLATE,ensurePinTemplate,getPinTemplate,poiPageContent,pinInfo,pinningEnabled,validateTemplate} from "./map-pins-data.js";
import {parseHoverPage,selectedHoverFields,registerPinHover} from "./map-pins-hover.js";

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const error=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);
const option=(id:string,label:string,selected:string)=>`<option value="${escape(id)}" ${id===selected?"selected":""}>${escape(label)}</option>`;
const hoverFieldRefreshers=new Map<HTMLElement,(page:JournalEntryPage)=>void>();
function wholeCoordinates(form:HTMLElement):void {
  for(const name of ["x","y"]){
    const input=form.querySelector<HTMLInputElement>(`input[name="${name}"]`);if(!input)continue;
    input.step="1";
    const round=()=>{if(input.value!==""&&Number.isFinite(input.valueAsNumber))input.value=String(Math.round(input.valueAsNumber));};
    round();input.addEventListener("change",round);
  }
}
function pageOptions(journal:JournalEntry|undefined,type:string,selected:string):string {
  return option("","None",selected)+(journal?.pages.contents.filter(p=>p.type===type || type==="image" && p.type==="text").map(p=>option(p.id!,p.name,selected)).join("")??"");
}
function sectionChoices(container:HTMLElement,page:JournalEntryPage|undefined,input:HTMLInputElement,value:string):void {
  container.replaceChildren();
  const selected=selectedHoverFields(value)?.map(name=>name.toLocaleLowerCase());
  const sections=parseHoverPage(page?.text.content??"",true);
  const description=document.createElement("p");description.className="notes";
  description.textContent="Image and description are always displayed. Choose any additional hover fields below.";container.append(description);
  const fields=[...new Set(sections.map(section=>section.name).filter(name=>!["description","image"].includes(name.trim().toLocaleLowerCase())))];
  const write=()=>{input.value=JSON.stringify([...container.querySelectorAll<HTMLInputElement>('input:checked')].map(box=>box.value));};
  for(const name of fields){
    const label=document.createElement("label"),box=document.createElement("input");box.type="checkbox";box.value=name;
    box.checked=!selected||selected.includes(name.toLocaleLowerCase());
    box.addEventListener("change",write);label.append(box,document.createTextNode(name));container.append(label);
  }
  if(!fields.length){const empty=document.createElement("p");empty.className="notes";empty.textContent="No other sections found on this page. Add headings to the Description page to define hover fields.";container.append(empty);}
  write();
}
export async function openPinTemplate():Promise<void> { await openPinDefaults(); }

const managers=new Map<string,Dialog>();
const creationTemplates=new WeakMap<NoteDocument,JournalEntry>();
const creationSheets=new Map<string,NoteConfig>();
const initializedDrafts=new WeakSet<NoteDocument>();
function fillVisualDefaults(form:HTMLElement):void {
  for(const [name,value] of Object.entries(pinVisualDefaults())){
    const field=form.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`);if(!field)continue;
    if(field.value!==String(value)){
      field.value=String(value);
      // Foundry custom inputs already emit input/change from their value setter.
      if(field instanceof HTMLInputElement||field instanceof HTMLSelectElement)field.dispatchEvent(new Event("change",{bubbles:true}));
    }
    form.querySelectorAll<HTMLInputElement>(`input[type="color"][data-edit="${name}"]`).forEach(picker=>{picker.value=String(value);});
  }
}
function visualPanel(basic:HTMLElement,special:HTMLElement,note:NoteDocument,resize:()=>void):void {
  const columns=document.createElement("div");columns.className="pin-config-columns";
  const hover=special.querySelector<HTMLElement>(".pneuma-pin-hover-config")!;hover.before(columns);columns.append(hover);
  const panel=document.createElement("fieldset");panel.className="pin-visual-config";
  panel.innerHTML='<legend>Pin appearance</legend><div class="pin-visual-preview"><canvas width="256" height="256"></canvas><span></span></div><div class="pin-visual-controls"></div><div class="pin-visual-actions"><button type="button" data-action="visual-defaults">Load defaults</button><button type="button" data-action="visual-apply">Apply</button></div><p class="pin-visual-status" role="status"></p>';
  columns.append(panel);
  const controls=panel.querySelector(".pin-visual-controls")!;
  const fields:Record<string,string>={iconSize:"Icon size","texture.tint":"Icon tint",fontFamily:"Font",fontSize:"Font size",textColor:"Text color",textAnchor:"Text anchor"};
  const read=(name:string)=>basic.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`);
  const proxies=new Map<string,HTMLInputElement|HTMLSelectElement>();
  const swatches=new Map<string,HTMLInputElement>();
  for(const [name,label] of Object.entries(fields)){
    const source=read(name);if(!source)continue;
    const row=document.createElement("div");row.className="form-group pin-visual-row";const caption=document.createElement("label");caption.textContent=label;
    const inputs=document.createElement("div");inputs.className="form-fields";
    // Never clone Foundry custom inputs: assigning their value emits events,
    // which feeds a mirror-to-source-to-mirror loop during the initial refresh.
    const proxy=source instanceof HTMLSelectElement?source.cloneNode(true) as HTMLSelectElement:document.createElement("input");
    if(proxy instanceof HTMLInputElement){
      proxy.type=source instanceof HTMLInputElement?source.type:"text";
      for(const attribute of ["min","max","step"]){const value=source.getAttribute(attribute);if(value!==null)proxy.setAttribute(attribute,value);}
    }
    proxy.removeAttribute("name");proxy.removeAttribute("id");proxy.removeAttribute("data-edit");proxy.dataset.visualField=name;
    proxy.setAttribute("aria-label",label);
    if(proxy instanceof HTMLInputElement&&(name==="texture.tint"||name==="textColor")){
      proxy.type="text";
      const swatch=document.createElement("input");swatch.type="color";swatch.setAttribute("aria-label",`Choose ${label.toLowerCase()}`);
      swatch.addEventListener("input",()=>{proxy.value=swatch.value;proxy.dispatchEvent(new Event("input",{bubbles:true}));});
      swatches.set(name,swatch);
    }
    for(const eventName of ["input","change"])proxy.addEventListener(eventName,()=>{
      const native=source instanceof HTMLInputElement||source instanceof HTMLSelectElement;
      if(source.value!==proxy.value)source.value=proxy.value;
      else if(!native)return;
      if(native)source.dispatchEvent(new Event(eventName,{bubbles:true}));
      basic.querySelectorAll<HTMLInputElement>(`input[type="color"][data-edit="${name}"]`).forEach(picker=>{picker.value=proxy.value;});
    });
    inputs.append(proxy);const swatch=swatches.get(name);if(swatch)inputs.append(swatch);
    row.append(caption,inputs);controls.append(row);proxies.set(name,proxy);
  }
  const canvas=panel.querySelector("canvas")!,label=panel.querySelector<HTMLSpanElement>(".pin-visual-preview span")!;
  let image:HTMLImageElement|undefined,path="";
  const refresh=()=>{
    for(const [name,proxy] of proxies){const value=read(name)?.value??"";if(proxy.value!==value)proxy.value=value;const swatch=swatches.get(name);if(swatch&&/^#[0-9a-f]{6}$/i.test(value))swatch.value=value;}
    const src=read("icon.selected")?.value||read("icon.custom")?.value||note.texture.src||"";
    if(src!==path){path=src;const next=new Image();image=next;next.onload=()=>{if(image===next)refresh();};next.src=src;}
    const size=Math.max(1,Number(read("iconSize")?.value)||40)/2;
    canvas.style.width=canvas.style.height=`${size}px`;
    const ctx=canvas.getContext("2d")!;ctx.clearRect(0,0,256,256);
    if(image?.complete&&image.naturalWidth){
      ctx.globalCompositeOperation="source-over";ctx.drawImage(image,0,0,256,256);
      ctx.globalCompositeOperation="multiply";ctx.fillStyle=read("texture.tint")?.value||"#ffffff";ctx.fillRect(0,0,256,256);
      ctx.globalCompositeOperation="destination-in";ctx.drawImage(image,0,0,256,256);ctx.globalCompositeOperation="source-over";
    }
    label.textContent=read("text")?.value||note.text||"Map pin";
    label.style.fontFamily=read("fontFamily")?.value||"Signika";
    const fontSize=Math.max(1,Number(read("fontSize")?.value)||32)/2;
    label.style.fontSize=`${fontSize}px`;
    label.style.color=read("textColor")?.value||"#ffffff";
    const half=size/2+4,anchor=Number(read("textAnchor")?.value??1);
    const lineHeight=fontSize*1.15;
    const stacked=anchor===1||anchor===2;
    const height=stacked?size+lineHeight+4:Math.max(size,lineHeight);
    const centerY=anchor===2?lineHeight+4+size/2:anchor===1?size/2:height/2;
    const preview=panel.querySelector<HTMLElement>(".pin-visual-preview")!;
    if(preview.style.height!==`${height}px`){preview.style.height=`${height}px`;resize();}
    canvas.style.top=`${centerY}px`;
    label.style.left=`calc(50% + ${anchor===3?-half:anchor===4?half:0}px)`;
    label.style.top=`${centerY+(anchor===1?half:anchor===2?-half:0)}px`;
    label.style.transform=anchor===1?"translate(-50%,0)":anchor===2?"translate(-50%,-100%)":anchor===3?"translate(-100%,-50%)":anchor===4?"translate(0,-50%)":"translate(-50%,-50%)";
  };
  basic.addEventListener("input",refresh);basic.addEventListener("change",refresh);refresh();
  panel.querySelector('[data-action="visual-defaults"]')!.addEventListener("click",()=>{fillVisualDefaults(basic);refresh();status.textContent="";});
  const apply=panel.querySelector<HTMLButtonElement>('[data-action="visual-apply"]')!;
  const status=panel.querySelector<HTMLElement>('.pin-visual-status')!;
  panel.addEventListener("input",()=>{status.textContent="";});
  if(!note.id){apply.disabled=true;apply.title="Save the new pin first.";}
  apply.addEventListener("click",()=>{
    apply.disabled=true;status.textContent="";
    void (async()=>{
      if(!game.user?.isGM || !pinningEnabled(note.parent))throw new Error("Only GMs can apply appearance on enabled scenes.");
      const value={...getPinDefaults(),size:Number(read("iconSize")?.value),tint:read("texture.tint")?.value??"",fontFamily:read("fontFamily")?.value??"",fontSize:Number(read("fontSize")?.value),textColor:read("textColor")?.value??"",textAnchor:Number(read("textAnchor")?.value)};
      validatePinDefaults(value);
      const changes:Record<string,unknown>={};
      for(const name of Object.keys(fields))changes[name]=["iconSize","fontSize","textAnchor"].includes(name)?Number(read(name)?.value):read(name)?.value;
      await note.update(changes as NoteDocument.UpdateData);
      for(const [name,value] of Object.entries(changes))if(String(foundry.utils.getProperty(note,name))!==String(value))throw new Error("Foundry did not save the appearance settings.");
      status.textContent="Appearance applied.";
    })().catch(cause=>{status.textContent=error(cause);}).finally(()=>{apply.disabled=false;});
  });
}
function renderPinConfig(app:NoteConfig,html:JQuery):void {
  const note=app.object,root=html[0];
  if(!root||!game.user?.isGM||!pinningEnabled(note.parent)||root.querySelector(".pneuma-pin-editor"))return;
  const form=root.matches("form")?root:root.querySelector("form");
  if(!form)return;
  form.classList.add("pneuma-poi-form");
  wholeCoordinates(form);
  if(!note.id&&!initializedDrafts.has(note)){
    note.updateSource(pinVisualDefaults());fillVisualDefaults(form);initializedDrafts.add(note);
  }
  const creationTemplate=creationTemplates.get(note);
  const defaults=getPinDefaults();
  const info=pinInfo(note)??{hover:defaults.hover,imagePageId:note.entry?.pages.find(p=>p.type==="image")?.id??"",descriptionPageId:note.entry?.pages.find(p=>p.type==="text"&&p.name.toLocaleLowerCase()==="description")?.id??"",sections:"",category:""};
  const prefix=`flags.${MODULE_ID}.mapPin`;
  const content=document.createElement("section");content.className="pneuma-pin-editor";
  const basic=document.createElement("fieldset");basic.className="pin-location-config";
  // Move the original nodes so Foundry's native listeners and field values survive.
  const submit=form.querySelector('button[type="submit"]');
  const footer=submit?.closest("footer")??submit;
  for(const child of [...form.childNodes])if(child!==footer)basic.append(child);
  basic.insertAdjacentHTML("afterbegin","<legend>Location</legend>");
  const special=document.createElement("div");special.className="pneuma-map-pins";
  special.innerHTML=`<fieldset class="pin-icon-config"><legend>Icon</legend>${compactIconPicker(note.texture.src??"",true)}</fieldset>
  <fieldset class="pneuma-pin-hover-config"><legend>Journal hover preview</legend><div class="form-group"><label>Show preview</label><input type="checkbox" name="${prefix}.hover" ${info.hover?"checked":""}></div><div class="form-group"><label>Image page</label><div class="form-fields"><select name="${prefix}.imagePageId"></select></div></div><div class="form-group"><label>Description page</label><div class="form-fields"><select name="${prefix}.descriptionPageId"></select></div></div><h4>Hover fields</h4><input type="hidden" name="${prefix}.sections"><div class="pin-section-list"></div><p class="notes">Journal permissions and unrevealed secrets still apply.</p><input type="hidden" name="${prefix}.category" value="${escape(info.category)}"></fieldset>`;
  content.append(basic,special);form.prepend(content);
  visualPanel(form,special,note,()=>requestAnimationFrame(()=>{if(form.isConnected)app.setPosition({height:"auto"});}));
  // Keep native fields and listeners for submission; appearance mirrors are the
  // sole visible controls. No cloned native widgets or second tab are needed.
  for(const name of ["iconSize","texture.tint","fontFamily","fontSize","textColor","textAnchor"]){
    const source=basic.querySelector<HTMLElement>(`[name="${name}"]`);
    const row=source?.closest<HTMLElement>(".form-group");
    if(row)row.hidden=true;else if(source)source.hidden=true;
  }

  const image=special.querySelector<HTMLSelectElement>(`[name="${prefix}.imagePageId"]`)!;
  const imageRow=document.createElement("div");imageRow.className="form-group";
  imageRow.innerHTML=`<label>POI image</label><div class="form-fields"><input type="text" name="${prefix}.imageSrc" value="${escape(info.imageSrc??"")}" placeholder="Image for this POI"><button type="button" title="Choose this POI's image" aria-label="Choose this POI's image"><i class="fas fa-file-import"></i></button></div>`;
  image.closest(".form-group")!.before(imageRow);
  imageRow.querySelector("button")!.addEventListener("click",()=>{
    const field=imageRow.querySelector("input")!;
    new FilePicker({type:"image",current:field.value,callback:path=>{field.value=path;field.dispatchEvent(new Event("change",{bubbles:true}));}}).render(true);
  });
  const description=special.querySelector<HTMLSelectElement>(`[name="${prefix}.descriptionPageId"]`)!;
  const entry=basic.querySelector<HTMLSelectElement>('[name="entryId"]');
  const refreshSections=(value="")=>{
    const journal=entry?game.journal?.find(j=>j.id===entry.value):note.entry??undefined;
    sectionChoices(special.querySelector(".pin-section-list")!,creationTemplate?{text:{content:poiPageContent(creationTemplate)}} as JournalEntryPage:journal?.pages.find(p=>p.id===description.value),special.querySelector<HTMLInputElement>(`[name="${prefix}.sections"]`)!,value);
  };
  description.addEventListener("change",()=>refreshSections());
  const refreshPages=(initial=false)=>{
    const journal=entry?game.journal?.find(j=>j.id===entry.value):note.entry??undefined;
    const ownPage=journal?.pages.get(note.pageId??"");
    const managed=Boolean(ownPage && foundry.utils.getProperty(ownPage,`flags.${MODULE_ID}.poi`));
    image.innerHTML=pageOptions(journal,"image",initial?info.imagePageId:"");
    description.innerHTML=pageOptions(journal,"text",initial?info.descriptionPageId:journal?.pages.find(p=>p.type==="text"&&p.name.toLocaleLowerCase()==="description")?.id??"");
    image.closest<HTMLElement>(".form-group")!.hidden=managed||!!creationTemplate;
    description.closest<HTMLElement>(".form-group")!.hidden=managed||!!creationTemplate;
    if(managed){image.value=ownPage!.id!;description.value=ownPage!.id!;}
    refreshSections(initial?info.sections:"");
  };
  refreshPages(true);entry?.addEventListener("change",()=>refreshPages());
  hoverFieldRefreshers.set(form,page=>{
    const journalId=creationTemplate?.id??entry?.value??note.entry?.id;
    if(page.parent?.id!==journalId||(!creationTemplate&&page.id!==description.value))return;
    refreshSections(special.querySelector<HTMLInputElement>(`[name="${prefix}.sections"]`)!.value);
    app.setPosition({height:"auto"});
  });
  const selected=basic.querySelector<HTMLSelectElement>('[name="icon.selected"]');
  const custom=basic.querySelector<HTMLInputElement>('[name="icon.custom"]');
  if(selected){
    selected.hidden=true;
    const row=selected.closest<HTMLElement>(".form-group");
    if(row&&!row.contains(custom))row.hidden=true;
  }
  if(custom){
    const row=custom.closest<HTMLElement>(".form-group");
    const container=special.querySelector(".pin-icon-config")!;
    if(row){container.append(row);row.hidden=false;}
    else {const label=document.createElement("label");label.textContent="Custom icon path";label.append(custom);container.append(label);}
    custom.disabled=false;custom.placeholder=note.texture.src??"";
    const useCustomIcon=()=>{if(selected?.value){selected.value="";selected.dispatchEvent(new Event("change",{bubbles:true}));}custom.disabled=false;};
    custom.addEventListener("input",useCustomIcon);custom.addEventListener("change",useCustomIcon);
  }
  const refreshIcon=bindIconPicker(special,()=>selected?.value||custom?.value||note.texture.src||"");
  const syncIcons=()=>{
    refreshIcon();
    const src=selected?.value||custom?.value||note.texture.src;
    special.querySelectorAll<HTMLElement>(".pin-icon").forEach(icon=>icon.setAttribute("aria-pressed",String(icon.dataset.src===src)));
  };
  selected?.addEventListener("change",syncIcons);custom?.addEventListener("change",syncIcons);
  special.querySelectorAll<HTMLButtonElement>(".pin-icon").forEach(button=>button.addEventListener("click",()=>{
    if(!selected||!custom)return;
    selected.value="";selected.dispatchEvent(new Event("change",{bubbles:true}));
    custom.disabled=false;custom.value=button.dataset.src!;custom.dispatchEvent(new Event("change",{bubbles:true}));
    special.querySelector<HTMLInputElement>(`[name="${prefix}.category"]`)!.value=button.dataset.category!;
    syncIcons();
  }));
  const iconPanel=special.querySelector(".pin-icon-config")!;
  for(const [name,caption] of [["text","Text label"],["entryId","Journal Entry"],["pageId","Page"]]){
    const field=basic.querySelector<HTMLElement>(`[name="${name}"]`);if(!field)continue;
    let row=field.closest<HTMLElement>(".form-group");
    if(!row){row=document.createElement("div");row.className="form-group";const label=document.createElement("label");label.textContent=caption!;row.append(label,field);}
    iconPanel.append(row);
  }
  basic.querySelector('[name="global"]')?.closest(".form-group")?.classList.add("pin-global-visibility");
  const header=document.createElement("div");header.className="pin-config-header";
  header.append(special.querySelector(".pin-icon-config")!,basic);special.prepend(header);
  const x=basic.querySelector<HTMLInputElement>('[name="x"]'),y=basic.querySelector<HTMLInputElement>('[name="y"]');
  if(x&&y){
    const rows=new Set([x.closest(".form-group"),y.closest(".form-group")]);
    const coordinates=document.createElement("div");coordinates.className="form-group pin-coordinates";
    (x.closest(".form-group")??x).before(coordinates);
    for(const [caption,input] of [["X",x],["Y",y]] as const){
      const label=document.createElement("label");label.append(caption,input);coordinates.append(label);
    }
    for(const row of rows)if(row&&!row.querySelector("input,select,textarea,button"))row.remove();
  }
  if(creationTemplate){
    const global=basic.querySelector<HTMLInputElement>('[name="global"]');if(global)global.checked=defaults.global;
    for(const [name,label] of [["entryId",`${note.parent?.name} - POIs`],["pageId","Created from your POI template"]]){
      const select=form.querySelector<HTMLSelectElement>(`[name="${name}"]`);if(select){select.replaceChildren(new Option(label!,""));select.disabled=true;}
    }
    if(submit)submit.innerHTML='<i class="fas fa-save"></i> Create pin &amp; journal';
  }
  app.setPosition({width:Math.max(Number(app.position.width)||400,580),height:"auto"});
}

export async function openPinDefaults():Promise<void> {return openPinForm();}
class PinDefaultsMenu extends FormApplication {
  constructor(){super({});}
  override render(_force?:boolean,_options?:Partial<Application.RenderOptions>):this {
    void openPinDefaults().catch(e=>ui.notifications?.error(error(e)));return this;
  }
  protected override async _updateObject(_event:Event,_data:object):Promise<void> {}
}

export async function openMapPins(scene:Scene,editing?:NoteDocument,position?:{x:number;y:number}):Promise<void> {
  if(!game.user?.isGM||!pinningEnabled(scene))return;
  if(editing){editing.sheet?.render(true);return;}
  if(position)return openPinCreation(scene,position);
  const existing=managers.get(scene.id!);if(existing?.rendered){existing.bringToTop();return;}
  const rows=scene.notes.contents.map(note=>`<div class="pin-row" data-id="${escape(note.id!)}"><input type="checkbox" class="pin-select" aria-label="Select ${escape(note.text||note.entry?.name||"Map pin")}"><span>${escape(note.text||note.entry?.name||"Map pin")}</span><button type="button" data-action="pan" title="Pan to pin" aria-label="Pan to pin"><i class="fas fa-crosshairs"></i></button><button type="button" data-action="journal" title="Open journal" aria-label="Open journal" ${note.entry?"":"disabled"}><i class="fas fa-book-open"></i></button><button type="button" data-action="permissions" title="${pinPermissionLabel(note)}" aria-label="${pinPermissionLabel(note)}" aria-pressed="${playersCanReadPin(note)}" ${pinPermissionDocument(note)?"":"disabled"}><i class="fas fa-book-reader"></i></button><button type="button" data-action="edit" title="Edit pin" aria-label="Edit pin"><i class="fas fa-cog"></i></button><button type="button" data-action="delete" title="Delete pin; keep journal" aria-label="Delete pin"><i class="fas fa-trash"></i></button></div>`).join("");
  const content=`<section class="pneuma-map-pins pneuma-pin-manager"><h3>${escape(scene.name)} — Scene pins (${scene.notes.size})</h3><div class="pin-options"><button type="button" data-action="place"><i class="fas fa-map-pin"></i> Place pin on map</button><button type="button" data-action="defaults"><i class="fas fa-cog"></i> Map POI Defaults</button></div><div class="pin-options pin-selection"><label><input type="checkbox" data-select-all> Select all</label><button type="button" data-action="bulk-style" disabled>Style selected (0)</button></div><div class="pin-list">${rows||"<p>No pins on this scene.</p>"}</div><p class="pin-error" role="alert"></p></section>`;
  const dialog=new Dialog({title:"Scene Tools Map POI",content,buttons:{},render:html=>{
    const root=html[0]!,message=root.querySelector(".pin-error")!;
    const transfer=document.createElement('div');transfer.className='pin-options';
    transfer.innerHTML='<button type="button" data-action="export-pins">Export JSON</button><button type="button" data-action="import-pins">Import JSON</button><input type="file" accept=".json,application/json" hidden>';
    root.querySelector('.pin-options')!.after(transfer);
    const file=transfer.querySelector<HTMLInputElement>('input')!;
    transfer.querySelector('[data-action="export-pins"]')!.addEventListener('click',()=>{
      try{saveDataToFile(JSON.stringify(exportPins(scene),null,2),'application/json',`${scene.name.replace(/[^a-z0-9_-]/gi,'_')}-pins.json`);}catch(cause){message.textContent=error(cause);}
    });
    transfer.querySelector('[data-action="import-pins"]')!.addEventListener('click',()=>file.click());
    file.addEventListener('change',()=>{void (async()=>{
      const selected=file.files?.[0];if(!selected)return;
      const text=await selected.text(),bundle=parsePinBundle(text);
      if(!await Dialog.confirm({title:'Import Map Pins',content:`<p>Add ${bundle.notes.length} pins and ${bundle.journals.length} journals to this scene? Existing documents are kept. Importing the same file again creates additional copies. Image files are not included.</p>`,defaultYes:false}))return;
      transfer.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=true;});
      await importPins(scene,text);await dialog.close();await openMapPins(scene);
    })().catch(cause=>{message.textContent=error(cause);}).finally(()=>{file.value='';transfer.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=false;});});});
    const selections=Array.from(root.querySelectorAll<HTMLInputElement>(".pin-select"));
    const all=root.querySelector<HTMLInputElement>("[data-select-all]")!,bulk=root.querySelector<HTMLButtonElement>('[data-action="bulk-style"]')!;
    const selectedIds=()=>selections.filter(input=>input.checked).map(input=>input.closest<HTMLElement>(".pin-row")!.dataset.id!);
    const refreshSelection=()=>{const count=selectedIds().length;all.checked=count>0&&count===selections.length;all.indeterminate=count>0&&count<selections.length;bulk.disabled=!count;bulk.textContent=`Style selected (${count})`;};
    all.disabled=!selections.length;
    all.addEventListener("change",()=>{for(const input of selections)input.checked=all.checked;refreshSelection();});
    for(const input of selections)input.addEventListener("change",refreshSelection);
    bulk.addEventListener("click",()=>{void openPinStyleEditor(scene,selectedIds()).catch(cause=>{message.textContent=error(cause);});});
    root.querySelector('[data-action="defaults"]')!.addEventListener("click",()=>{void openPinDefaults().catch(e=>{message.textContent=error(e);});});
    root.querySelector('[data-action="place"]')!.addEventListener("click",()=>{
      if(canvas.scene?.id!==scene.id){message.textContent="View this scene before placing a pin.";return;}
      void dialog.close().then(()=>{canvas.notes?.activate();placementSceneId=scene.id!;ui.notifications?.info("Click the map to place a pin. Press Escape to cancel.");});
    });
    root.querySelectorAll<HTMLButtonElement>(".pin-row button").forEach(button=>button.addEventListener("click",()=>{
      void (async()=>{
        if(!game.user?.isGM||!pinningEnabled(scene))throw new Error("Map pinning is no longer enabled for this scene.");
        const note=scene.notes.get(button.closest<HTMLElement>(".pin-row")!.dataset.id!);if(!note)return;
        switch(button.dataset.action){
          case "permissions":
            button.disabled=true;
            try {await setPinPlayerRead(note,!playersCanReadPin(note));button.title=pinPermissionLabel(note);button.setAttribute("aria-label",button.title);button.setAttribute("aria-pressed",String(playersCanReadPin(note)));}
            finally {button.disabled=false;}
            break;
          case "edit":note.sheet?.render(true);break;
          case "journal":note.entry?.sheet?.render(true,{pageId:note.pageId});break;
          case "pan":if(canvas.scene?.id===scene.id)await canvas.animatePan({x:note.x,y:note.y});break;
          case "delete":if(await Dialog.confirm({title:"Delete map pin",content:"<p>Delete this pin? Its journal entry will be kept.</p>"})){await note.delete();await dialog.close();await openMapPins(scene);}break;
        }
      })().catch(e=>{message.textContent=error(e);});
    }));
  },close:()=>{managers.delete(scene.id!);}},{width:540,height:460,resizable:true});
  managers.set(scene.id!,dialog);dialog.render(true);
}

async function openPinCreation(scene:Scene,position:{x:number;y:number}):Promise<void> {
  if(!game.user?.isGM||!pinningEnabled(scene))return;
  const existing=creationSheets.get(scene.id!);if(existing?.rendered){existing.bringToTop();return;}
  const {journal,config}=await getPinTemplate();
  validateTemplate(journal,config);
  const defaults=getPinDefaults();
  const draft=new NoteDocument({x:Math.round(position.x),y:Math.round(position.y),entryId:journal.id,pageId:config.descriptionPageId||null,
    ...pinVisualDefaults(),texture:{src:"icons/svg/book.svg",tint:defaults.tint},global:defaults.global,
    flags:{[MODULE_ID]:{mapPin:{hover:defaults.hover,sections:config.sections,imagePageId:config.imagePageId,descriptionPageId:config.descriptionPageId,category:""}}}
  } as NoteDocument.CreateData,{parent:scene});
  creationTemplates.set(draft,journal);
  class CreatePOIConfig extends NoteConfig {
    override async close(options?:Application.CloseOptions):Promise<void>{await super.close(options);creationSheets.delete(scene.id!);}
    override activateListeners(html:JQuery):void {
      super.activateListeners(html);
      renderPinConfig(this,html);
    }
    protected override async _updateObject(_event:Event,formData:NoteConfig.FormData):Promise<unknown> {
      const data=formData as unknown as Record<string,unknown>;
      const prefix=`flags.${MODULE_ID}.mapPin`;
      return createMapPin(scene,{name:String(data.text??""),icon:String(data["texture.src"]??""),category:String(data[`${prefix}.category`]??""),
        x:Number(data.x),y:Number(data.y),size:Number(data.iconSize),tint:String(data["texture.tint"]??"#ffffff"),
        fontFamily:String(data.fontFamily??""),fontSize:Number(data.fontSize),textColor:String(data.textColor??""),textAnchor:Number(data.textAnchor),
        global:Boolean(data.global),hover:Boolean(data[`${prefix}.hover`]),sections:String(data[`${prefix}.sections`]??""),
        imageSrc:String(data[`${prefix}.imageSrc`]??""),elevation:Number(data.elevation??0),sort:Number(data.sort??0)});
    }
  }
  const sheet=new CreatePOIConfig(draft,{title:"Scene Tools Map POI - New Pin",width:740});
  creationSheets.set(scene.id!,sheet);sheet.render(true);
}

async function openPinForm():Promise<void> {
  if(!game.user?.isGM)return;
  const key="defaults";
  const existing=managers.get(key);if(existing?.rendered){existing.bringToTop();return;}
  const defaults=getPinDefaults();
  const {journal,config}=await getPinTemplate();
  if(managers.get(key)?.rendered){managers.get(key)!.bringToTop();return;}
  const content=await renderTemplate(`modules/${MODULE_ID}/templates/map-pins.hbs`,{
    ...defaults,
    journalOptions:game.journal?.map(j=>option(j.id!,j.name,journal.id!)).join('')??'',
    fontOptions:Object.entries(typeof FontConfig!=="undefined"?FontConfig.getAvailableFontChoices():{Signika:"Signika"}).map(([id,label])=>option(id,label,defaults.fontFamily)).join(""),
    anchorOptions:["Center","Bottom","Top","Left","Right"].map((label,id)=>option(String(id),label,String(defaults.textAnchor))).join(""),
  });
  let currentForm:HTMLFormElement|undefined;
  const dialog=new Dialog({title:"Scene Tools Map POI - Defaults",content,buttons:{},render:html=>{
    const root=html[0]!,form=root.querySelector<HTMLFormElement>(".pin-create")!;
    currentForm=form;
    wholeCoordinates(form);
    for(const picker of form.querySelectorAll<HTMLInputElement>("[data-pin-color]")){
      const field=form.elements.namedItem(picker.dataset.pinColor!) as HTMLInputElement;
      picker.addEventListener("input",()=>{field.value=picker.value;});
      field.addEventListener("input",()=>{if(/^#[0-9a-f]{6}$/i.test(field.value))picker.value=field.value;});
    }
    const message=root.querySelector(".pin-error")!;
    const journals=form.elements.namedItem('journal') as HTMLSelectElement;
    const sections=form.elements.namedItem('sections') as HTMLInputElement;
    const selectedJournal=()=>game.journal?.find(j=>j.id===journals.value);
    const refreshSections=(value='')=>{
      const selected=selectedJournal();
      sectionChoices(form.querySelector('.pin-section-list')!,selected?{text:{content:poiPageContent(selected)}} as JournalEntryPage:undefined,sections,value);
      dialog.setPosition?.({height:'auto'});
    };
    refreshSections(config.sections);
    journals.addEventListener('change',()=>refreshSections());
    hoverFieldRefreshers.set(form,page=>{if(page.parent?.id===journals.value)refreshSections(sections.value);});
    root.querySelector('[data-action="edit-template"]')!.addEventListener('click',()=>selectedJournal()?.sheet?.render(true));
    root.querySelector('[data-action="default-template"]')!.addEventListener('click',()=>{void ensurePinTemplate().then(j=>{
      if(![...journals.options].some(o=>o.value===j.id))journals.add(new Option(j.name,j.id!));
      journals.value=j.id!;refreshSections();
    }).catch(cause=>{message.textContent=error(cause);});});
    let busy=false;
    form.addEventListener("submit",event=>{event.preventDefault();if(busy)return;busy=true;message.textContent="";
      const submit=form.querySelector<HTMLButtonElement>('[type="submit"]')!;submit.disabled=true;
      void (async()=>{
        const data=new FormData(form);
        if(!game.user?.isGM)throw new Error("Only GMs can change POI defaults.");
        const defaults={size:Number(data.get("size")),tint:String(data.get("tint")),global:data.has("global"),hover:data.has("hover"),
          fontFamily:String(data.get("fontFamily")??""),fontSize:Number(data.get("fontSize")),textColor:String(data.get("textColor")),textAnchor:Number(data.get("textAnchor"))};
        validatePinDefaults(defaults);
        const selected=selectedJournal();if(!selected)throw Error('Select an existing template journal.');
        const textPage=selected.pages.find(page=>page.type==='text');
        const template={journalId:selected.id!,imagePageId:selected.pages.find(page=>page.type==='image')?.id??textPage?.id??'',descriptionPageId:textPage?.id??'',sections:sections.value};
        validateTemplate(selected,template);
        await game.settings!.set(MODULE_ID,'pinTemplate',template);
        await game.settings!.set(MODULE_ID,"pinDefaults",defaults);
        await dialog.close();
      })().catch(e=>{message.textContent=error(e);}).finally(()=>{busy=false;submit.disabled=false;});
    });
  },close:()=>{if(currentForm)hoverFieldRefreshers.delete(currentForm);managers.delete(key);}},{width:560,height:"auto",resizable:true});
  managers.set(key,dialog);dialog.render(true);
}

let placementSceneId:string|undefined;
let placementInstalled=false;
let placementOpening=false;
export function installPinPlacement():void {
  if(placementInstalled)return;
  libWrapper.register(MODULE_ID,"NotesLayer.prototype._onClickLeft",function(this:NotesLayer,wrapped:(...args:unknown[])=>unknown,event:{interactionData?:{origin?:{x:number;y:number}};getLocalPosition?:(stage:PIXI.Container)=>{x:number;y:number};stopPropagation?:()=>void}){
    const scene=canvas.scene;
    const nativeCreate=game.activeTool==="journal";
    const armed=placementSceneId===scene?.id;
    if(!game.user?.isGM||!pinningEnabled(scene)||(!armed&&!nativeCreate))return wrapped(event);
    const point=event.interactionData?.origin??(canvas.stage?event.getLocalPosition?.(canvas.stage):undefined);
    const existing=point?canvas.notes?.placeables?.find(note=>note.visible&&note.bounds.contains(point.x,point.y)):canvas.notes?.hover;
    if(existing){event.stopPropagation?.();return;}
    // Preserve Foundry's centered placement for its Create Map Note tool.
    // The manager's explicitly armed placement keeps the exact clicked position.
    const origin=nativeCreate&&!armed&&event.getLocalPosition&&canvas.grid&&canvas.stage
      ? canvas.grid.getCenterPoint(event.getLocalPosition(canvas.stage))
      : event.interactionData?.origin;
    if(!scene||!origin||!Number.isFinite(origin.x)||!Number.isFinite(origin.y))return;
    if(placementOpening)return;
    placementOpening=true;
    placementSceneId=undefined;
    // Foundry supplies canvas coordinates here, already adjusted for pan and zoom.
    return openMapPins(scene,undefined,{x:origin.x,y:origin.y}).catch(e=>ui.notifications?.error(error(e))).finally(()=>{placementOpening=false;});
  },"MIXED");
  libWrapper.register(MODULE_ID,"Note.prototype._onClickLeft2",function(this:Note,wrapped:(event:PIXI.FederatedEvent)=>unknown,event:PIXI.FederatedEvent){
    if(!pinningEnabled(this.document.parent))return wrapped(event);
    if(!canvas.notes?.active && !canvas.tokens?.active)return wrapped(event);
    placementSceneId=undefined;
    event.stopPropagation();
    if(canvas.notes?.active){
      if(game.user?.isGM || this.document.isOwner)return this.document.sheet?.render(true);
      return;
    }
    return openPinJournal(this.document);
  },"MIXED");
  document.addEventListener("keydown",event=>{if(event.key==="Escape")placementSceneId=undefined;});
  Hooks.on("canvasTearDown",()=>{placementSceneId=undefined;});
  placementInstalled=true;
}

export function registerMapPins():void {
  registerPinJournal();
  Hooks.on("ready",()=>{void cleanExistingPinTemplates().catch(cause=>ui.notifications?.error(String(cause)));});
  Hooks.on("updateNote",(note:NoteDocument,change:Record<string,unknown>,_options:unknown,userId:string)=>{
    if(userId!==game.user?.id || !game.user?.isGM)return;
    const path=`flags.${MODULE_ID}.mapPin.imageSrc`;
    if(!(path in change) && foundry.utils.getProperty(change,path)===undefined && !("entryId" in change) && !("pageId" in change))return;
    void syncPinImage(note).catch(cause=>ui.notifications?.error(`POI journal image: ${error(cause)}`));
  });
  Hooks.on("setup",installPinPlacement);
  Hooks.on("setup",installPinContextMenu);
  Hooks.on("setup",installPinVisibility);
  Hooks.on("setup",installPinScaling);
  game.settings!.registerMenu(MODULE_ID,"mapPinDefaultsMenu",{name:"Map POI Defaults",label:"Configure Map POI Defaults",hint:"Set pin appearance, visibility, journal template, and hover layout defaults.",icon:"fas fa-map-pin",type:PinDefaultsMenu,restricted:true});
  game.settings!.register(MODULE_ID,"pinDefaults",{name:"Map pin defaults",scope:"world",config:false,type:Object,default:DEFAULT_PIN});
  game.settings!.register(MODULE_ID,"pinTemplate",{name:"Map POI journal template",scope:"world",config:false,type:Object,default:EMPTY_TEMPLATE});
  Hooks.on("renderSceneConfig",(app:SceneConfig,html:JQuery)=>{
    if(!game.user?.isGM || html[0]?.querySelector(".pneuma-scene-pinning"))return;
    // Navigation links also carry data-tab="basic"; only insert into the content panel.
    const target=html[0]?.querySelector<HTMLElement>('.tab[data-tab="basic"]');
    if(!target)return;
    const group=document.createElement("div");group.className="form-group pneuma-scene-pinning";
    group.innerHTML=`<label>Scene Tools Map POI</label><div class="form-fields"><input type="checkbox" name="flags.${MODULE_ID}.mapPinning" ${pinningEnabled(app.object)?"checked":""}></div><p class="notes">Enable the city icon picker, template journals, and hover previews for this scene.</p>`;
    target.append(group);
  });
  Hooks.on("getSceneControlButtons",(controls:{name:string;tools:SceneControlTool[]}[])=>{
    if(!game.user?.isGM||!pinningEnabled(canvas.scene))return;
    const notes=controls.find(c=>c.name==="notes");
    if(notes&&!notes.tools.some(tool=>tool.name==="pneuma-map-pins")) notes.tools.push({name:"pneuma-map-pins",title:"Scene Tools Map POI",icon:"fas fa-map-location-dot",button:true,onClick:()=>{
      placementSceneId=undefined;
      const scene=canvas.scene;if(scene)void openMapPins(scene).catch(e=>ui.notifications?.error(error(e)));
    }});
  });
  Hooks.on("getSceneDirectoryEntryContext",(_html:JQuery,options:{name:string;icon:string;condition:(li:JQuery)=>boolean;callback:(li:JQuery)=>void}[])=>{
    options.push({name:"Scene Tools Map POI",icon:'<i class="fas fa-map-pin"></i>',condition:li=>Boolean(game.user?.isGM&&pinningEnabled(game.scenes?.find(s=>s.id===li.data("documentId")))),callback:li=>{const scene=game.scenes?.find(s=>s.id===li.data("documentId"));if(scene)void openMapPins(scene).catch(e=>ui.notifications?.error(error(e)));}});
  });
  Hooks.on("renderNoteConfig",renderPinConfig);
  Hooks.on("updateJournalEntryPage",(page:JournalEntryPage)=>{
    for(const [form,refresh] of hoverFieldRefreshers){
      if(!form.isConnected){hoverFieldRefreshers.delete(form);continue;}
      refresh(page);
    }
  });
  Hooks.on("closeNoteConfig",(app:NoteConfig)=>{if(app.form)hoverFieldRefreshers.delete(app.form);});
  Hooks.on("preCreateNote",(note:NoteDocument,_data:unknown,options?:{sceneToolsPinImport?:boolean})=>{
    if(!pinningEnabled(note.parent))return;
    // Configured pins already carry their form choices; direct native creation needs defaults.
    if(!pinInfo(note)&&!options?.sceneToolsPinImport)note.updateSource(pinVisualDefaults());
    note.updateSource({x:Math.round(note.x),y:Math.round(note.y)});
  });
  Hooks.on("preUpdateNote",(note:NoteDocument,change:NoteDocument.UpdateData)=>{
    if(!pinningEnabled(note.parent))return;
    for(const key of ["x","y"] as const)if(typeof change[key]==="number"&&Number.isFinite(change[key]))change[key]=Math.round(change[key]);
  });
  Hooks.on("updateScene",(scene:Scene)=>{if(canvas.scene?.id===scene.id)ui.controls?.initialize();if(!pinningEnabled(scene)){if(placementSceneId===scene.id)placementSceneId=undefined;void managers.get(scene.id!)?.close();void creationSheets.get(scene.id!)?.close();}});
  Hooks.on("deleteScene",(scene:Scene)=>{if(placementSceneId===scene.id)placementSceneId=undefined;void managers.get(scene.id!)?.close();void creationSheets.get(scene.id!)?.close();});
  registerPinHover();
}
