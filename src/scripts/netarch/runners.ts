import { isAP } from "./model.js";

let roles = new WeakMap<Actor,boolean>();
let watching: typeof Hooks|undefined;
function watchRoles(){
 if(watching===Hooks)return;watching=Hooks;
 const invalidate=(doc:Actor|Item|TokenDocument)=>{
  const actor="items" in doc ? doc : (doc as TokenDocument).actor ?? (doc as Item).parent ?? doc;
  roles.delete(actor as Actor);
 };
 for(const hook of ['createItem','updateItem','deleteItem','updateActor','updateToken'])Hooks.on(hook,(doc:Actor|Item|TokenDocument,changes?:Record<string,unknown>)=>{
  if(hook==='updateToken'&&changes&&!Object.keys(changes).some(key=>['actorId','actorLink','delta'].includes(key.split('.')[0]!)))return;
  invalidate(doc);
 });
 Hooks.on('canvasTearDown',()=>{roles=new WeakMap();});
}
export function isNetrunner(doc: TokenDocument | null | undefined) {
  if(!doc?.actor||isAP(doc))return false;
  watchRoles();
  let result=roles.get(doc.actor);
  if(result===undefined){result=!!doc.actor.items?.some(item=>String(item.type)==='role'&&String(item.name??'').trim().toLowerCase()==='netrunner');roles.set(doc.actor,result);}
  return result;
}

export function isPlayerOwned(doc: TokenDocument | null | undefined) {
  return Boolean(doc?.actor && game.users!.some((user) => !user.isGM
    && doc.actor!.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)));
}

