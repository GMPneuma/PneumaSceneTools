import {MODULE_ID} from './settings.js';
import {pinningEnabled} from './map-pins-data.js';
import {ensureSceneToolsFolder} from './world-folders.js';
import {exportPageSections,sectionsHTML,sectionImageHTML,type SectionImage} from './map-pin-sections.js';

type Data=Record<string,unknown>;
interface Page {key:string;data:Data;sections?:Record<string,string>;image?:SectionImage}
interface Journal {key:string;data:Data;pages:Page[]}
export interface PinBundle {format:'pneuma-scenetools-map-pins';version:1;scene:{name:string};journals:Journal[];notes:{journal:string|null;page:string|null;data:Data}[]}
function requireGM(scene:Scene):void {if(!game.user?.isGM||!pinningEnabled(scene))throw Error('Only GMs can transfer pins on enabled Map POI scenes.');}
function clean(source:Data):Data {
  const data=structuredClone(source);
  for(const key of ['_id','_stats','folder','ownership','pages','entryId','pageId'])delete data[key];
  if(source.ownership)data.ownership={default:(source.ownership as {default?:number}).default??0};
  return data;
}
export function exportPins(scene:Scene):PinBundle {
  requireGM(scene);
  const journals=new Map<string,Journal>();
  const notes=scene.notes.contents.map(note=>{
    const entry=note.entry;
    if(note.entryId&&!entry)throw Error(`The journal linked to ${note.text} is missing.`);
    if(entry&&!journals.has(entry.id!)){
      const data=clean(entry.toObject() as unknown as Data);delete data.flags;
      journals.set(entry.id!,{key:entry.id!,data,pages:entry.pages.contents.map(page=>{
        const data={...clean(page.toObject() as unknown as Data),sort:page.sort} as Data;
        const text=data.text as Data|undefined;
        const content=data.type==='text'&&text?.format!==2&&typeof text?.content==='string'?exportPageSections(text.content):undefined;
        if(content)delete data.text;
        return {key:page.id!,data,...content};
      })});
    }
    if(note.pageId&&!entry?.pages.get(note.pageId))throw Error(`The page linked to ${note.text} is missing.`);
    return {journal:entry?.id??null,page:note.pageId??null,data:clean(note.toObject() as unknown as Data)};
  });
  return {format:'pneuma-scenetools-map-pins',version:1,scene:{name:scene.name},journals:[...journals.values()],notes};
}
export function parsePinBundle(text:string):PinBundle {
  const value=JSON.parse(text) as PinBundle;
  if(!value||value.format!=='pneuma-scenetools-map-pins'||value.version!==1||!Array.isArray(value.journals)||!Array.isArray(value.notes))throw Error('Expected a SceneTools map pins JSON file (version 1).');
  const object=(data:unknown):data is Data=>!!data&&typeof data==='object'&&!Array.isArray(data);
  const keys=new Map<string,Set<string>>();
  for(const journal of value.journals){
    if(!journal||typeof journal.key!=='string'||!journal.key||keys.has(journal.key)||!object(journal.data)||typeof journal.data.name!=='string'||!Array.isArray(journal.pages))throw Error('Each journal needs a unique key, data.name, and pages array.');
    const pages=new Set<string>();keys.set(journal.key,pages);
    for(const page of journal.pages){
      if(!page||typeof page.key!=='string'||!page.key||pages.has(page.key)||!object(page.data)||typeof page.data.name!=='string'||typeof page.data.type!=='string')throw Error('Each page needs a unique key, data.name, and data.type.');
      pages.add(page.key);
      if(page.sections!==undefined){
        if(page.data.type!=='text')throw Error('Only text pages support named sections.');
        sectionsHTML(page.sections);
        if(page.data.text!==undefined)throw Error('Use either page sections or data.text, not both.');
      }
      if(page.image!==undefined){
        if(page.sections===undefined)throw Error('Page image requires named sections.');
        sectionImageHTML(page.image);
      }
    }
  }
  for(const note of value.notes){
    if(!note||!object(note.data)||!Number.isFinite(note.data.x)||!Number.isFinite(note.data.y))throw Error('Each Note needs numeric data.x and data.y coordinates.');
    if(note.journal!==null&&!keys.has(note.journal))throw Error('A Note references an unknown journal key.');
    if(note.page!==null&&(!note.journal||!keys.get(note.journal)?.has(note.page)))throw Error('A Note references an unknown page key.');
    const flags=(note.data.flags as Record<string,Data>|undefined)?.[MODULE_ID]?.mapPin as Data|undefined;
    for(const field of ['imagePageId','descriptionPageId'])if(flags?.[field]&&(!note.journal||!keys.get(note.journal)?.has(String(flags[field]))))throw Error(`A Note has an unknown ${field}.`);
  }
  return value;
}
const pending=new Set<string>();
export async function importPins(scene:Scene,text:string):Promise<void> {
  requireGM(scene);const bundle=parsePinBundle(text);
  if(pending.has(scene.id!))throw Error('A pin import is already running for this scene.');
  pending.add(scene.id!);
  const created:JournalEntry[]=[],noteIds:string[]=[],links=new Map<string,{id:string;pages:Map<string,string>}>();
  try {
    const folder=await ensureSceneToolsFolder('JournalEntry','Imported POIs');
    for(const source of bundle.journals){
      requireGM(scene);
      const data=clean(source.data);delete data.flags;
      const journal=await JournalEntry.create({...data,folder:folder.id,pages:[]} as JournalEntry.CreateData);
      if(!journal)throw Error('Journal creation was cancelled.');created.push(journal);
      const pages=new Map<string,string>();links.set(source.key,{id:journal.id!,pages});
      for(const page of source.pages){
        const data=clean(page.data);
        if(page.sections!==undefined)data.text={format:1,content:sectionsHTML(page.sections)+sectionImageHTML(page.image)};
        const [saved]=(await journal.createEmbeddedDocuments('JournalEntryPage',[data as JournalEntryPage.CreateData]))??[];
        if(!saved)throw Error('Page creation was cancelled.');pages.set(page.key,saved.id!);
      }
    }
    for(const source of bundle.notes){
      requireGM(scene);
      const link=source.journal?links.get(source.journal):undefined,data=clean(source.data);
      const flags=(data.flags as Record<string,Data>|undefined)?.[MODULE_ID]?.mapPin as Data|undefined;
      const sourcePage=bundle.journals.find(journal=>journal.key===source.journal)?.pages.find(page=>page.key===source.page);
      if(flags&&sourcePage?.sections!==undefined)flags.imageSrc=sourcePage.image?.src??'';
      if(flags)for(const key of ['imagePageId','descriptionPageId'])if(flags[key])flags[key]=link?.pages.get(String(flags[key]))??'';
      const [note]=(await scene.createEmbeddedDocuments('Note',[{...data,entryId:link?.id??null,pageId:source.page?link?.pages.get(source.page):null} as NoteDocument.CreateData],{sceneToolsPinImport:true} as object))??[];
      if(!note)throw Error('Note creation was cancelled.');noteIds.push(note.id!);
    }
    ui.notifications?.info(`Imported ${noteIds.length} pins and ${created.length} journals.`);
  } catch(error){
    let retained=false;
    for(const id of noteIds)try{await scene.deleteEmbeddedDocuments('Note',[id]);if(scene.notes.has(id))retained=true;}catch{retained=true;}
    for(const journal of created){
      if(scene.notes.some(note=>note.entryId===journal.id)){retained=true;continue;}
      try{await journal.delete();if(game.journal?.get(journal.id!))retained=true;}catch{retained=true;}
    }
    throw Error(`${String(error)}${retained?' Some imported documents could not be removed; review the scene and Imported POIs folder before retrying.':''}`);
  } finally {pending.delete(scene.id!);}
}
