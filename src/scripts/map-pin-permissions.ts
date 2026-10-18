import {MODULE_ID} from "./settings.js";
import {pinningEnabled} from "./map-pins-data.js";
import {hidePinHover} from "./map-pins-hover.js";

export function pinPermissionDocument(note:NoteDocument):JournalEntryPage|JournalEntry|undefined {
  return note.pageId ? note.entry?.pages.get(note.pageId) : note.entry??undefined;
}
export function canOpenPinJournal(note:NoteDocument):boolean {
  const linked=pinPermissionDocument(note);
  return !!linked && !!game.user && (game.user.isGM || linked.testUserPermission(game.user,"OBSERVER"));
}
export function openPinJournal(note:NoteDocument):void {
  if(canOpenPinJournal(note))note.entry?.sheet?.render(true,{pageId:note.pageId});
}
export function playersCanReadPin(note:NoteDocument):boolean {
  const document=pinPermissionDocument(note);
  if(!document)return false;
  const players=game.users?.filter(user=>!user.isGM)??[];
  return players.length ? players.every(user=>document.testUserPermission(user,"OBSERVER"))
    : (document.ownership.default===CONST.DOCUMENT_OWNERSHIP_LEVELS.INHERIT ? note.entry?.ownership.default??0 : document.ownership.default??0)>=CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
}
export async function setPinPlayerRead(note:NoteDocument,allowed:boolean):Promise<void> {
  if(!game.user?.isGM || !pinningEnabled(note.parent))throw Error("Only GMs can change POI permissions on enabled scenes.");
  const document=pinPermissionDocument(note);
  if(!document)throw Error("This POI has no linked journal page.");
  const level=allowed?CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER:CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
  const changes:Record<string,number>={"ownership.default":level};
  for(const user of game.users??[])if(!user.isGM)changes[`ownership.${user.id}`]=level;
  await document.update(changes);
  if(document.ownership.default!==level || (game.users?.filter(user=>!user.isGM)??[]).some(user=>document.ownership[user.id!]!==level))throw Error("POI permissions did not save.");
  ui.notifications?.info(allowed?"Player read access added.":"Player read access removed.");
}
export function pinPermissionLabel(note:NoteDocument):string {
  return playersCanReadPin(note)?"Remove player read access":"Allow player read access";
}
let installed=false;
/** Use Foundry's ContextMenu for canvas pins; retain native handling elsewhere. */
export function installPinContextMenu():void {
  if(installed)return;
  // Native right-click permission is HUD/ownership based; readable pins also expose their journal menu.
  libWrapper.register(MODULE_ID,"Note.prototype._canHUD",function(this:Note,wrapped:(...args:unknown[])=>boolean,...args:unknown[]){
    if(pinningEnabled(this.document.parent) && this.visible && canOpenPinJournal(this.document))return true;
    return wrapped(...args);
  },"MIXED");
  let anchor:HTMLElement|undefined,menu:ContextMenu|undefined;
  let pending:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{clearTimeout(pending);pending=undefined;anchor?.remove();anchor=undefined;};
  libWrapper.register(MODULE_ID,"Note.prototype._onUnclickRight",function(this:Note,wrapped:(event:PIXI.FederatedEvent)=>unknown,event:PIXI.FederatedEvent){
    const note=this.document;
    if(!pinningEnabled(note.parent) || (!game.user?.isGM && !canOpenPinJournal(note)))return wrapped(event);
    void menu?.close({animate:false});clear();
    event.stopPropagation();
    const {clientX,clientY}=event as PIXI.FederatedPointerEvent;
    // Foundry clickRight runs on pointer-down. Wait until release and its native
    // contextmenu event have finished before creating the menu under the cursor.
    pending=setTimeout(()=>{
      pending=undefined;
      if(!pinningEnabled(note.parent) || canvas.scene?.id!==note.parent?.id || (!game.user?.isGM && !canOpenPinJournal(note)))return;
      const target=document.createElement("div");anchor=target;target.className="pneuma-pin-context";
      Object.assign(target.style,{position:"fixed",left:`${Math.max(0,Math.min(clientX,innerWidth-240))}px`,top:`${clientY}px`,width:"240px",height:"1px",zIndex:"10000"});
      document.body.append(target);
      hidePinHover();
      const allowed=playersCanReadPin(note);
      menu=new ContextMenu($(target),".pneuma-pin-context",[
        {name:"Open Journal",icon:'<i class="fas fa-book-open"></i>',condition:canOpenPinJournal(note),callback:()=>openPinJournal(note)},
        {name:pinPermissionLabel(note),icon:'<i class="fas fa-book-reader"></i>',condition:!!game.user?.isGM && !!pinPermissionDocument(note),callback:()=>{void setPinPlayerRead(note,!allowed).catch(cause=>ui.notifications?.error(String(cause)));}},
        {name:"Edit POI",icon:'<i class="fas fa-edit"></i>',condition:!!game.user?.isGM,callback:()=>{if(game.user?.isGM)note.sheet?.render(true);}}
      ],{onClose:()=>{target.remove();if(anchor===target){anchor=undefined;menu=undefined;}}});
      target.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,clientX,clientY}));
    },0);
  },"MIXED");
  Hooks.on("canvasTearDown",()=>{void menu?.close({animate:false});clear();});
  installed=true;
}
