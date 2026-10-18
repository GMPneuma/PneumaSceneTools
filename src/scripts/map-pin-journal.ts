import {MODULE_ID} from "./settings.js";
import {pinningEnabled} from "./map-pins-data.js";

function linkedNotes(page:JournalEntryPage):NoteDocument[] {
  return ((game.scenes?.contents??[]) as Scene[]).filter(scene=>pinningEnabled(scene)).flatMap(scene=>scene.notes.contents.filter(note=>note.entryId===page.parent?.id && note.pageId===page.id));
}
let linkedPages:Set<string>|undefined;
function hasLinkedNote(page:JournalEntryPage):boolean {
  if(!linkedPages){
    linkedPages=new Set();
    for(const scene of game.scenes??[])if(pinningEnabled(scene))for(const note of scene.notes){
      if(note.entryId&&note.pageId)linkedPages.add(`${note.entryId}.${note.pageId}`);
    }
  }
  return linkedPages.has(`${page.parent?.id}.${page.id}`);
}

export async function panToPin(page:JournalEntryPage):Promise<void> {
  if(!game.user || !page.testUserPermission(game.user,"OBSERVER"))return;
  const notes=linkedNotes(page);
  const note=notes.find(note=>note.parent?.id===canvas.scene?.id)??notes[0];
  if(!note){ui.notifications?.warn("This location no longer has a map Note.");return;}
  if(note.parent?.id!==canvas.scene?.id){
    if(!game.user.isGM){ui.notifications?.info("This location is on another scene.");return;}
    await note.parent!.view();
  }
  // Recheck after a scene transition; never apply another scene's coordinates.
  if(!canvas.ready || canvas.scene?.id!==note.parent?.id || note.parent?.notes.get(note.id!)!==note)return;
  if(!game.user.isGM && !note.object?.isVisible){ui.notifications?.warn("This Note is not visible on your map.");return;}
  await canvas.animatePan({x:note.x,y:note.y});
}

export function addPinJournalButton(page:JournalEntryPage,root:HTMLElement):void {
  root=root.closest<HTMLElement>('.journal-entry-page')??root;
  root.querySelectorAll('.pneuma-pin-journal-action').forEach(node=>node.remove());
  if(!game.user || !page.testUserPermission(game.user,"OBSERVER"))return;
  if(!foundry.utils.getProperty(page,`flags.${MODULE_ID}.poi`) && !hasLinkedNote(page))return;
  const bar=document.createElement('div');bar.className='pneuma-pin-journal-action';
  const button=document.createElement('button');button.type='button';button.innerHTML='<i class="fas fa-map-marker-alt" aria-hidden="true"></i> Pan to Note';
  button.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();button.disabled=true;
    void panToPin(page).catch(error=>ui.notifications?.error(String(error))).finally(()=>{button.disabled=false;});
  });
  bar.append(button);root.prepend(bar);
}

export function registerPinJournal():void {
  for(const hook of ['createNote','updateNote','deleteNote','createScene','updateScene','deleteScene'])Hooks.on(hook,()=>{linkedPages=undefined;});
  Hooks.on('renderJournalPageSheet',(app:{object:JournalEntryPage},html:JQuery)=>{
    if(html[0])addPinJournalButton(app.object,html[0]);
  });
  Hooks.on('renderJournalSheet',(app:{object:JournalEntry},html:JQuery)=>{
    for(const root of html[0]?.querySelectorAll<HTMLElement>('.journal-entry-page[data-page-id]')??[]){
      const page=app.object.pages.get(root.dataset.pageId!);if(page)addPinJournalButton(page,root);
    }
  });
}
