import {MODULE_ID} from "./settings.js";
import {ensureSceneToolsFolder} from "./world-folders.js";
import {cleanDefaultPinTemplate} from "./map-pin-template-cleanup.js";

export type PinTemplate = {journalId: string; imagePageId: string; descriptionPageId: string; sections: string;}
export interface PinInfo {imagePageId: string; descriptionPageId: string; imageSrc?:string; sections: string; hover: boolean; category: string;}

export type PinDefaults = {size:number;tint:string;global:boolean;hover:boolean;fontFamily:string;fontSize:number;textColor:string;textAnchor:number;}
declare global {interface SettingConfig {"pneuma-scenetools.pinDefaults": PinDefaults;}}
export const DEFAULT_PIN:PinDefaults={size:40,tint:"#ffffff",global:true,hover:true,fontFamily:"Signika",fontSize:32,textColor:"#ffffff",textAnchor:1};
export function getPinDefaults():PinDefaults {
  const saved=game.settings!.get(MODULE_ID,"pinDefaults");
  return {...DEFAULT_PIN,...saved};
}
export function pinVisualDefaults():NoteDocument.UpdateData {
  const defaults=getPinDefaults();
  return {iconSize:defaults.size,"texture.tint":defaults.tint,fontFamily:defaults.fontFamily,fontSize:defaults.fontSize,textColor:defaults.textColor,textAnchor:defaults.textAnchor as typeof CONST.TEXT_ANCHOR_POINTS.BOTTOM} as NoteDocument.UpdateData;
}
export function validatePinDefaults(value:PinDefaults):void {
  if(!value.fontFamily.trim()||!Number.isInteger(value.fontSize)||value.fontSize<1||!/^#[0-9a-f]{6}$/i.test(value.textColor)||![0,1,2,3,4].includes(value.textAnchor))throw new Error("Choose a font, a positive whole-number font size, a text color, and a text anchor.");
  if(!Number.isFinite(value.size) || value.size<16 || value.size>256 || !/^#[0-9a-f]{6}$/i.test(value.tint))throw new Error("Choose a size between 16 and 256 and a valid tint.");
}
declare global {interface SettingConfig {"pneuma-scenetools.pinTemplate": PinTemplate;}}
export const EMPTY_TEMPLATE: PinTemplate = {journalId:"",imagePageId:"",descriptionPageId:"",sections:""};
export function pinningEnabled(scene: Scene | null | undefined): boolean {
  return Boolean(scene && foundry.utils.getProperty(scene,`flags.${MODULE_ID}.mapPinning`));
}
export function pinInfo(note: NoteDocument): PinInfo | undefined {
  return foundry.utils.getProperty(note,`flags.${MODULE_ID}.mapPin`) as PinInfo | undefined;
}
function requireGM(scene?: Scene): void {
  if (!game.user?.isGM) throw new Error("Only GMs can manage map pins.");
  if (scene && !pinningEnabled(scene)) throw new Error("Enable Scene Tools Map POI on this scene first.");
}
let defaultPending: Promise<JournalEntry> | undefined;
export async function ensurePinTemplate(): Promise<JournalEntry> {
  requireGM();
  if (defaultPending) return defaultPending;
  defaultPending = (async () => {
    const existing = game.journal?.find(journal => foundry.utils.getProperty(journal,`flags.${MODULE_ID}.pinTemplate`) === true);
    if (existing) {await cleanDefaultPinTemplate(existing);return existing;}
    const folder = await ensureSceneToolsFolder("JournalEntry");
    const created = await JournalEntry.create({name:"Map POI Template",folder:folder.id,ownership:{default:CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE},
      flags:{[MODULE_ID]:{pinTemplate:true}},pages:[
        {name:"POI",type:"text",sort:100000,text:{format:1,content:'<h2>Description</h2><p>Describe this location.</p><h2>Factions</h2><p></p><h2>NPC&#39;s</h2><p></p><h2>Contacts</h2><p></p><h2>Services</h2><p></p>'}},
      ]} as JournalEntry.CreateData);
    if (!created) throw new Error("Could not create the map pin template.");
    return created;
  })();
  try {return await defaultPending;} finally {defaultPending=undefined;}
}
export async function getPinTemplate(): Promise<{journal:JournalEntry; config:PinTemplate}> {
  requireGM();
  let config=game.settings!.get(MODULE_ID,"pinTemplate");
  if(config.journalId) {
    const journal=game.journal?.find(j=>j.id===config.journalId);
    if(journal){await cleanDefaultPinTemplate(journal);return {journal,config};}
  }
  const journal=await ensurePinTemplate();
  const replacedMissing=!!config.journalId;
  config={journalId:journal.id!,imagePageId:journal.pages.find(p=>p.type==="image")?.id??journal.pages.find(p=>p.type==="text")?.id??"",descriptionPageId:journal.pages.find(p=>p.type==="text")?.id??"",sections:""};
  if(replacedMissing)await game.settings!.set(MODULE_ID,"pinTemplate",config);
  return {journal,config};
}
export function validateTemplate(journal:JournalEntry,config:PinTemplate):void {
  if(config.imagePageId && !["image","text"].includes(journal.pages.get(config.imagePageId)?.type??"")) throw new Error("Choose an image or text page for the hover image.");
  if(config.descriptionPageId && journal.pages.get(config.descriptionPageId)?.type!=="text") throw new Error("Choose a text page for the hover description.");
}
const journalPending = new Map<string,Promise<JournalEntry>>();
export async function pinSceneJournal(scene:Scene):Promise<JournalEntry> {
  requireGM(scene);
  const key=scene.id!;
  if(journalPending.has(key))return journalPending.get(key)!;
  const task=(async()=>{
    const existing=game.journal?.find(j=>foundry.utils.getProperty(j,`flags.${MODULE_ID}.poiSceneJournal`)===key);
    if(existing)return existing;
    const folder=await ensureSceneToolsFolder("JournalEntry");
    const journal=await JournalEntry.create({name:`${scene.name} - POIs`,folder:folder.id,ownership:{default:CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER},pages:[],flags:{[MODULE_ID]:{poiSceneJournal:key}}} as JournalEntry.CreateData);
    if(!journal)throw new Error("Could not create the scene POI journal.");
    return journal;
  })();
  journalPending.set(key,task);
  try{return await task;}finally{journalPending.delete(key);}
}
const escapeHTML=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
/** Preserve editable HTML and secret sections; other media retain native page links. */
export function poiPageContent(journal:JournalEntry):string {
  return [...journal.pages.contents].sort((a,b)=>a.sort-b.sort).map(page=>{
    const data=page.toObject();
    if(data.type==="text") {
      if(data.text?.markdown && !data.text.content)throw new Error(`Convert the Markdown page "${page.name}" to HTML before creating a POI from this template.`);
      const content=data.text?.content??"";
      return /<h[1-6][\s>]/i.test(content)?content:`<h2>${escapeHTML(page.name)}</h2>${content}`;
    }
    if(data.type==="image")return data.src?`<h2>Image</h2><p><img src="${escapeHTML(data.src)}" alt="${escapeHTML(page.name)}"></p>`:"";
    return `<h2>${escapeHTML(page.name)}</h2><p>@UUID[${page.uuid}]{${escapeHTML(page.name)}}</p>`;
  }).join("\n");
}
export interface NewPin extends Partial<Pick<PinDefaults,"fontFamily"|"fontSize"|"textColor"|"textAnchor">> {name:string;icon:string;category:string;x:number;y:number;size:number;tint:string;global:boolean;hover:boolean;sections?:string;imageSrc?:string;elevation?:number;sort?:number;}
export async function createMapPin(scene:Scene,input:NewPin):Promise<NoteDocument> {
  requireGM(scene);
  if(!input.name.trim()) throw new Error("Enter a location name.");
  if(![input.x,input.y,input.size].every(Number.isFinite) || input.size<16 || input.size>256) throw new Error("Use valid coordinates and an icon size between 16 and 256.");
  const visual={...getPinDefaults(),...input};
  validatePinDefaults(visual);
  const {journal:template,config}=await getPinTemplate();
  validateTemplate(template,config);
  if(!input.icon.trim())throw new Error("Choose an icon or enter a custom icon path.");
  if(input.elevation!==undefined&&!Number.isFinite(input.elevation) || input.sort!==undefined&&!Number.isFinite(input.sort))throw new Error("Use valid elevation and sort values.");
  const image=input.imageSrc?.trim();
  if(image&&/^\s*(javascript|vbscript):/i.test(image))throw new Error("Choose a valid POI image path.");
  const content=poiPageContent(template)+(image?`<section data-poi-image="true"><h2>Image</h2><img src="${escapeHTML(image)}" alt="${escapeHTML(input.name.trim())}"></section>`:"");
  const journal=await pinSceneJournal(scene);
  const [page]=(await journal.createEmbeddedDocuments("JournalEntryPage",[{name:input.name.trim(),type:"text",text:{format:CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,content},ownership:{default:CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER},flags:{[MODULE_ID]:{poi:true}}} as JournalEntryPage.CreateData]))??[];
  if(!page || !journal.pages.get(page.id!))throw new Error("Foundry did not create the POI page.");
  try {
    requireGM(scene);
    const info:PinInfo={imagePageId:page.id!,descriptionPageId:page.id!,sections:input.sections??config.sections,hover:input.hover,category:input.category,...(input.imageSrc!==undefined?{imageSrc:input.imageSrc}:{})};
    const [note]=(await scene.createEmbeddedDocuments("Note",[{entryId:journal.id,pageId:info.descriptionPageId||null,x:Math.round(input.x),y:Math.round(input.y),
      text:input.name.trim(),...(input.elevation!==undefined?{elevation:input.elevation}:{}),...(input.sort!==undefined?{sort:input.sort}:{}),iconSize:input.size,fontFamily:visual.fontFamily,fontSize:visual.fontSize,textColor:visual.textColor,textAnchor:visual.textAnchor as typeof CONST.TEXT_ANCHOR_POINTS.BOTTOM,texture:{src:input.icon,tint:input.tint},global:input.global,flags:{[MODULE_ID]:{mapPin:info}}} as NoteDocument.CreateData]))??[];
    if(!note) throw new Error("Foundry did not create the pin.");
    return note;
  } catch(error) {
    try {await journal.deleteEmbeddedDocuments("JournalEntryPage",[page.id!]);if(journal.pages.get(page.id!))throw new Error("Page deletion was cancelled.");} catch {
      throw new Error(`Pin creation failed; the POI page "${page.name}" could not be removed. Check it before retrying. ${String(error)}`);
    }
    throw error;
  }
}
