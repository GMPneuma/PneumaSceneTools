import test from "node:test";
import assert from "node:assert/strict";
import {environment, Collection,applyChanges} from "../netarch/helpers.mjs";
globalThis.FormApplication=class {};
const {withMookOperation}=await import("../../dist/scripts/mookmaker/operations.js");
const {applyMookChanges}=await import("../../dist/scripts/mookmaker/apply-mook.js");
const {purgeGear}=await import("../../dist/scripts/mookmaker/purge.js");
const {promoteToken}=await import("../../dist/scripts/mookmaker/promotion.js");
const {ensureSceneToolsFolder,WORLD_FOLDERS}=await import("../../dist/scripts/world-folders.js");
function setup(){
 const env=environment();foundry.utils.deepClone=structuredClone;
 game.i18n={localize:key=>key,format:key=>key};
 const actor={name:"Mook",items:new Collection(),toObject(){return {name:this.name,items:[],prototypeToken:{texture:{src:"old"}}}}};
 const token={actor,document:{uuid:"Scene.test.Token.mook",actorId:"original",actorLink:false,texture:{src:"portrait"},async update(changes){applyChanges(this,changes)}}};
 return {...env,actor,token};
}
test("Apply, Purge and Promote reject overlapping actions and release the guard after failure",async()=>{
 const {token}=setup();let finish;
 const running=withMookOperation(token,()=>new Promise(resolve=>finish=resolve));
 await assert.rejects(applyMookChanges({token}),/already running/);
 await assert.rejects(purgeGear(token),/already running/);
 await assert.rejects(promoteToken(token),/already running/);
 finish();await running;
 await assert.rejects(withMookOperation(token,async()=>{throw Error("failure")}),/failure/);
 assert.equal(await withMookOperation(token,async()=>42),42);
 token.document.actorLink=true;await assert.rejects(purgeGear(token),/unlinked/);
});
test("promotion removes the new Actor if linking fails, and successful retry preserves token artwork",async()=>{
 const {token}=setup();await ensureSceneToolsFolder("Actor",WORLD_FOLDERS.mookPromoted);
 let deleted=0,created;
 Actor.create=async data=>created={...data,id:"promoted",async delete(){deleted++}};
 const update=token.document.update;
 token.document.update=async()=>{throw Error("link failed")};
 const old=console.error;console.error=()=>{};
 try {assert.equal(await promoteToken(token),false);}finally{console.error=old;}
 assert.equal(deleted,1);assert.equal(token.document.actorId,"original");
 token.document.update=update;assert.equal(await promoteToken(token),true);
 assert.equal(token.document.actorId,"promoted");assert.equal(token.document.actorLink,true);
 assert.equal(created.img,"portrait");assert.equal(created.prototypeToken.texture.src,"portrait");
});
test("purge restores magazine state on deletion failure and preserves equipped gear on retry",async()=>{
 const {token,actor}=setup();
 actor.items=new Collection([{id:"weapon",name:"Pistol",type:"weapon",system:{equipped:"owned",magazine:{value:6},installedItems:{list:["ammo"]}}},{id:"ammo",type:"ammo",name:"Ammo",system:{}},{id:"keep",name:"Armor",type:"armor",system:{equipped:"equipped"}}]);
 actor.updateEmbeddedDocuments=async(_type,updates)=>updates.forEach(data=>applyChanges(actor.items.get(data._id),data));
 actor.deleteEmbeddedDocuments=async()=>{throw Error("delete failed")};
 const old=console.error;console.error=()=>{};
 try {assert.equal(await purgeGear(token),false);}finally{console.error=old;}
 assert.equal(actor.items.get("weapon").system.magazine.value,6);
 assert.deepEqual(actor.items.get("weapon").system.installedItems.list,["ammo"]);
 actor.deleteEmbeddedDocuments=async(_type,ids)=>ids.forEach(id=>actor.items.delete(id));
 assert.equal(await purgeGear(token),true);assert.deepEqual([...actor.items.keys()],["ammo","keep"]);
});

test("confirmed Purge waits for deletion despite Foundry closing the confirmation immediately",async()=>{
 const {token,actor,values}=setup();values.set("confirmPurgeGear",true);
 actor.items=new Collection([{id:"gear",type:"gear",name:"Gear",system:{equipped:"owned"}}]);
 let release,dialog,callback;
 actor.deleteEmbeddedDocuments=async()=>{await new Promise(resolve=>release=resolve);actor.items.clear();};
 const original=globalThis.Dialog;
 globalThis.Dialog=class {constructor(data){this.data=data;dialog=this;}render(){return this;}};
 try {
  const {confirmPurgeGear}=await import("../../dist/scripts/mookmaker/purge.js");
  let settled=false;const result=confirmPurgeGear(token).then(value=>{settled=true;return value;});
  callback=dialog.data.buttons.confirm.callback();dialog.data.close();
  await Promise.resolve();assert.equal(settled,false);assert.equal(actor.items.size,1);
  release();await callback;assert.equal(await result,true);assert.equal(actor.items.size,0);
  actor.items=new Collection([{id:"gear",type:"gear",system:{}}]);
  const dismissed=confirmPurgeGear(token);dialog.data.close();assert.equal(await dismissed,false);
 } finally {globalThis.Dialog=original;}
});

test("promotion removes template identity but preserves other flags",async()=>{
 const {token,actor}=setup();await ensureSceneToolsFolder("Actor",WORLD_FOLDERS.mookPromoted);
 const flags={"pneuma-scenetools":{IsDefaultMookTemplate:true,DefaultMookTemplateVersion:5,custom:"keep"},other:{value:1}};
 actor.toObject=()=>({name:"Mook",flags:structuredClone(flags)});
 let created;Actor.create=async data=>created={...data,id:"promoted"};
 assert.equal(await promoteToken(token),true);
 assert.deepEqual(created.flags,{"pneuma-scenetools":{custom:"keep",PromotedFromMookMaker:true},other:{value:1}});
 assert.equal(flags["pneuma-scenetools"].IsDefaultMookTemplate,true);
});

test("cancelled promotion linking reports failure and removes the unused Actor",async()=>{
 const {token}=setup();await ensureSceneToolsFolder("Actor",WORLD_FOLDERS.mookPromoted);
 let deleted=0;Actor.create=async()=>({id:"promoted",async delete(){deleted++;}});
 token.document.update=async()=>undefined;
 const old=console.error;console.error=()=>{};
 try {assert.equal(await promoteToken(token),false);}finally{console.error=old;}
 assert.equal(deleted,1);assert.equal(token.document.actorId,"original");assert.equal(token.document.actorLink,false);
});
