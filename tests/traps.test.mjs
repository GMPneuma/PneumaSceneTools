import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Collection,getPath,applyChanges} from './netarch/helpers.mjs';
import {blankTrap,blankAction,validateAction,validateTrap,parsePresets,exportPresets,validateDevice} from '../dist/scripts/traps/model.js';
import {setHazardRegionVisibility,locateHazard,deleteHazard,sceneHazard,traps,findHazard,resolveHazard,operational,hazardIssues,saveTrap,syncAccessPoint,ensureBehavior,TRAP_BEHAVIOR,ensureRegionHazard,updateTrap,createHazardToken,setHazardHP,cleanupHazardActor,createHazardAccessPoint} from '../dist/scripts/traps/documents.js';
import {propose,resolve,applyCombatEffect,activation,registerRuntime,registerBehavior,regionEvent,enqueue,cameraSees,cleanupEffects,manualTrigger,card} from '../dist/scripts/traps/runtime.js';
import {eligible} from '../dist/scripts/traps/triggers.js';
import {validateHazardReadiness} from '../dist/scripts/traps/readiness.js';
import {applyAction,attackHazard} from '../dist/scripts/traps/resolution.js';
globalThis.FormApplication = class {};
const M='pneuma-scenetools';
test('counter skill is fixed for new hazards and older preset data',()=>{
 assert.equal(blankTrap().disarmSkill,'Electronics/Security Tech');
 assert.equal(validateTrap({...blankTrap(),disarmSkill:'Demolitions'}).disarmSkill,'Electronics/Security Tech');
 const [preset]=parsePresets(exportPresets([{...blankTrap(),disarmSkill:'Other skill'}]));
 assert.equal(preset.disarmSkill,'Electronics/Security Tech');
});
test('source and built manifests authorize the registered native RegionBehavior type',async()=>{
 setup();registerBehavior();
 for(const path of ['../module.json','../dist/module.json']){
  const manifest=JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
  const allowed=new Set(Object.keys(manifest.documentTypes?.RegionBehavior??{}).map(type=>`${manifest.id}.${type}`));
  assert.ok(allowed.has(TRAP_BEHAVIOR),`${path} must declare ${TRAP_BEHAVIOR}`);
  assert.equal(typeof CONFIG.RegionBehavior.dataModels[TRAP_BEHAVIOR],'function');
  const region={behaviors:new Collection(),async createEmbeddedDocuments(kind,data){
   assert.equal(kind,'RegionBehavior');
   for(const entry of data){assert.ok(allowed.has(entry.type),'Native document type validation');assert.ok(CONFIG.RegionBehavior.dataModels[entry.type]);this.behaviors.set('trap',{...entry,id:'trap'});}
   return this.behaviors.contents;
  }};
  await ensureBehavior(region);await ensureBehavior(region);assert.equal(region.behaviors.size,1);
 }
});
function setup(){
 let sequence=0;const hooks=new Map(),docs=new Map(),settings={trapPresets:{presets:[]}},calls={damage:[],effects:[],moves:[],errors:[]};
 globalThis.foundry={data:{regionBehaviors:{RegionBehaviorType:class{}}},utils:{getProperty:getPath,randomID:()=>`id${++sequence}`,deepClone:structuredClone}};
 const gm={id:'gm',isGM:true,active:true},player={id:'player',isGM:false,active:true};
 globalThis.game={user:gm,users:new Collection([gm,player]),messages:new Collection(),actors:new Collection(),modules:new Map([["pneuma-combattools",{active:true}]]),
  time:{worldTime:100},system:{version:'0.92.4'},settings:{get:(_m,k)=>settings[k],set:async(_m,k,v)=>settings[k]=v},i18n:{localize:v=>v}};
 calls.cards=[];game.modules.get('pneuma-combattools').api={sceneEffects:{version:4,getAvoidanceResult:()=>null,create:async request=>{calls.cards.push(request);return 'effect-card';}}};
 game.users.activeGM=gm;
 globalThis.CONST={WALL_DOOR_STATES:{CLOSED:0},REGION_VISIBILITY:{LAYER:0,GAMEMASTER:1,ALWAYS:2},REGION_EVENTS:{TOKEN_ENTER:"tokenEnter",TOKEN_EXIT:"tokenExit",TOKEN_MOVE:"tokenMove",TOKEN_TURN_START:"tokenTurnStart",TOKEN_TURN_END:"tokenTurnEnd"},DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3},ACTIVE_EFFECT_MODES:{ADD:2}};
 globalThis.CONFIG={RegionBehavior:{dataModels:{}},statusEffects:[{id:'prone',name:'Prone',changes:[]}],Canvas:{polygonBackends:{sight:{testCollision:()=>false},move:{testCollision:()=>false}}}};
 globalThis.ui={notifications:{error:m=>calls.errors.push(m)}};
 globalThis.Hooks={on:(h,f)=>{const all=hooks.get(h)??[];all.push(f);hooks.set(h,all)}};
 globalThis.fromUuid=async uuid=>docs.get(uuid)??null;
 const add=o=>{docs.set(o.uuid,o);o.update=async changes=>{applyChanges(o,changes);return o};return o};
 globalThis.ChatMessage={getWhisperRecipients:()=>[gm],getSpeaker:()=>({}),create:async data=>{
   const m=add({...structuredClone(data),id:`m${++sequence}`,uuid:`ChatMessage.${sequence}`});game.messages.set(m.id,m);return m;
 }};
 const scene={id:'s',uuid:'Scene.s',grid:{size:100,distance:2,measurePath:([a,b])=>({distance:Math.hypot(b.x-a.x,b.y-a.y)/50})},globalLight:true,
   regions:new Collection(),tokens:new Collection(),walls:new Collection(),updateEmbeddedDocuments:async()=>[],
   createEmbeddedDocuments:async(_type,data)=>data.map(entry=>{
     if(_type==='Region'){
       const id='region'+(++sequence),r=add({...region,...entry,id,uuid:'Scene.s.Region.'+id,flags:structuredClone(entry.flags??{}),behaviors:new Collection(),tokens:new Set()});
       r.createEmbeddedDocuments=async(kind,entries)=>entries.map(e=>{const behavior={...e,id:'behavior'+(++sequence)};r.behaviors.set(behavior.id,behavior);return behavior;});
       r.delete=async()=>scene.regions.delete(id);scene.regions.set(id,r);return r;
     }
     const token=makeToken('ap'+(++sequence));applyChanges(token,entry);return token;
   })};
 globalThis.canvas={scene,ready:true,tokens:{controlled:[]}};
 function makeToken(id='pc',x=-150,y=0){
   const actor={uuid:`Actor.${id}`,system:{derivedStats:{hp:{value:10}},stats:{move:{value:4}}},items:new Collection(),effects:new Collection(),
     testUserPermission:u=>u.id==='player',get hasPlayerOwner(){return game.users.some(u=>!u.isGM&&this.testUserPermission(u,CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));},_applyDamage:async(...args)=>calls.damage.push(args),
     createEmbeddedDocuments:async(_kind,data)=>data.map(entry=>{const e={...entry,id:`e${++sequence}`};actor.effects.set(e.id,e);calls.effects.push(e);return e}),
     deleteEmbeddedDocuments:async(_kind,ids)=>ids.forEach(id=>actor.effects.delete(id))};
   actor.update=async changes=>{applyChanges(actor,changes);return actor};
   const t=add({id,uuid:`Scene.s.Token.${id}`,documentName:'Token',name:id,parent:scene,x,y,width:1,height:1,elevation:0,rotation:0,actor,actorId:id,flags:{}});
   t.delete=async()=>scene.tokens.delete(id);scene.tokens.set(id,t);return t;
 }
 const body=makeToken("body",0,0);body.flags[M]={hazardBody:"Scene.s.SceneToolsHazard.trap"};
 const target=makeToken(),device=makeToken('device',-50,-50);device.actor.testUserPermission=()=>false;
 const region=add({id:'trap',uuid:'Scene.s.Region.trap',documentName:'Region',parent:scene,x:0,y:0,rotation:0,elevation:{bottom:null,top:null},tokens:new Set(),behaviors:new Collection([{id:'behavior',type:'pneuma-scenetools.trap',disabled:false}]),shapes:[{type:'rectangle',x:0,y:0,width:100,height:100,rotation:0,hole:false}],
  flags:{}});
 scene.regions.set(region.id,region);region.toObject=()=>({shapes:structuredClone(region.shapes)});
 scene.flags={[M]:{hazards:{trap:{...blankTrap(),triggerRegionId:region.id,hp:10,bodyId:"body",armed:true,actions:[{...blankAction("status"),status:"prone"}]}}}};
 scene.update=async changes=>{for(const [key,value]of Object.entries(changes)){const parts=key.split("."),last=parts.at(-1);if(last.startsWith("-="))delete getPath(scene,parts.slice(0,-1).join("."))[last.slice(2)];else applyChanges(scene,{[key]:value});}return scene;};
 const hazard=sceneHazard(scene,"trap");
 game.scenes=new Collection([scene]);
 return {scene,target,device,body,region,hazard,calls,makeToken,settings,docs,async hook(name,...args){for(const fn of hooks.get(name)??[])await fn(...args);await enqueue(async()=>{});},t:()=>scene.flags[M].hazards.trap};
}
test('portable presets discard scene references, runtime state and executable input',()=>{
 const t={...blankTrap(),armed:true,deviceId:'device',apId:'ap',detected:['pc'],engaged:['pc'],patrol:[{x:1,y:2,elevation:0}],
  actions:[{...blankAction('door'),wallIds:['wall'],x:50}]};
 const [p]=parsePresets(exportPresets([t]));assert.equal(p.armed,false);assert.equal(p.deviceId,'');assert.deepEqual(p.actions[0].wallIds,[]);assert.deepEqual(p.engaged,[]);
 assert.throws(()=>validateTrap({...t,version:2}));assert.equal(validateTrap({...t,charges:1.5}).charges,undefined);
 assert.throws(()=>validateTrap({...t,actions:[{...blankAction('damage'),formula:'@actor.hp'}]}));
 assert.throws(()=>parsePresets(JSON.stringify({format:'other',version:1,presets:[]})));
});
test('device presets retain native stats and embedded IDs while excluding grants and module scripts',()=>{
 const device=validateDevice({name:'Own device',type:'character',img:'icons/svg/hazard.svg',system:{stats:{move:{value:3}}},items:[{
  _id:'abcdefghijklmnop',name:'Own equipment',type:'gear',system:{installed:['abcdefghijklmnop']},effects:[{changes:[],origin:'Actor.old',flags:{macro:{script:'bad'}}}],flags:{macro:{script:'bad'}}}]});
 assert.equal(device.items[0]._id,'abcdefghijklmnop');assert.equal(device.system.stats.move.value,3);assert.equal(device.items[0].effects[0].flags,undefined);assert.equal(device.items[0].effects[0].origin,undefined);
 const [restored]=parsePresets(exportPresets([{...blankTrap(),deviceTemplate:device}]));assert.deepEqual(restored.deviceTemplate,device);
});
test('detection produces GM-only pending cards and applies nothing until approved',async()=>{
 const f=setup();await propose(f.hazard,f.target,'enter');await propose(f.hazard,f.target,'enter');
 assert.equal(game.messages.size,1);const m=game.messages.contents[0];assert.deepEqual(m.whisper,['gm']);assert.equal(activation(m).state,'pending');assert.equal(f.calls.effects.length,0);
 await resolve(m,'approve');assert.equal(activation(m).state,'ready');assert.equal(f.calls.effects.length,0);
 await resolve(m,'apply');assert.equal(f.calls.effects.length,0);await applyCombatEffect(m.id,0,'effect-card');assert.equal(f.calls.effects.length,1);await resolve(m,'apply');assert.equal(f.calls.effects.length,1);
});
test('dismissed and player requests never mutate Actors or arming',async()=>{
 const f=setup();await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];
 game.user=game.users.get('player');await assert.rejects(()=>resolve(m,'approve'),/active GM/);assert.equal(f.t().armed,true);
 game.user=game.users.get('gm');await resolve(m,'skip');assert.equal(f.t().armed,true);assert.equal(f.calls.effects.length,0);
});
test('retired limits cannot disable area activation or prevent subsequent triggers',async()=>{
 const f=setup(),second=f.makeToken('second',0,0);f.target.x=0;f.t().singleUse=true;f.t().charges=0;f.t().cooldown=9999;f.t().lastFired=100;f.t().effectAreaId='trap';f.t().targetMode='region';f.region.tokens=new Set([f.target,second]);
 await manualTrigger(f.hazard,[f.target]);assert.equal(game.messages.size,2);
 for(const m of game.messages){await resolve(m,'approve');await resolve(m,'apply');await applyCombatEffect(m.id,0,'effect-card');assert.equal(activation(m).state,'done');}
 assert.equal(f.t().armed,true);assert.equal(f.calls.effects.length,2);assert.equal(second.actor.effects.size,1);await propose(f.hazard,f.target,'enter again');assert.equal(game.messages.size,3);
});
test('failed effects require review and cannot be replayed on retry or reload',async()=>{
 const f=setup();f.target.actor.createEmbeddedDocuments=async()=>{throw Error('write failed')};
 await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];await resolve(m,'approve');await resolve(m,'apply');
 await assert.rejects(()=>applyCombatEffect(m.id,0,'effect-card'),/write failed/);
 assert.equal(activation(m).state,'review');f.target.actor.createEmbeddedDocuments=async()=>{throw Error('must not retry')};
 await resolve(m,'apply');assert.match(activation(m).error,/write failed/);await resolve(m,'omit');assert.equal(activation(m).state,'done');
});
test('destroyed devices and changed configurations reject stale approval',async()=>{
 const f=setup();f.t().deviceId='device';await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];
 f.body.actor.system.derivedStats.hp.value=0;assert.equal(operational(f.hazard),false);await assert.rejects(()=>resolve(m,'approve'),/destroyed/);
 f.body.actor.system.derivedStats.hp.value=1;f.t().dv=12;await assert.rejects(()=>resolve(m,'approve'),/configuration changed/);
});
test('native movement segments catch crossings and deduplicate entry callbacks',async()=>{
 const f=setup();registerBehavior();const handler=CONFIG.RegionBehavior.dataModels['pneuma-scenetools.trap'].events;
 const event={region:f.region,data:{token:f.target,segments:[{type:1},{type:0,from:{x:0,y:50},to:{x:100,y:50}},{type:-1}]}};
 await handler.tokenMove.call({behavior:{id:'behavior'}},{...event,name:'tokenMove'});
 await handler.tokenEnter.call({behavior:{id:'behavior'}},{...event,name:'tokenEnter'});
 assert.equal(game.messages.size,1);assert.equal(f.calls.effects.length,0);
 await resolve(game.messages.contents[0],'skip');game.user=game.users.get('player');await regionEvent({...event,name:'tokenMove'});assert.equal(game.messages.size,1);
 game.user=game.users.get('gm');f.region.behaviors.get('behavior').disabled=true;await regionEvent({...event,name:'tokenMove'});assert.equal(game.messages.size,1);
});
test('native inside segments count distance; holes, outside segments and teleports do not',async()=>{
 const f=setup();f.t().triggers=['move'];f.t().distance=3;f.region.tokens.add(f.target);
 const event={name:'tokenMove',region:f.region,data:{token:f.target,segments:[{type:0,from:{x:0,y:0},to:{x:50,y:0}},{type:-1,from:{x:50,y:0},to:{x:100,y:0}},{type:0,from:{x:100,y:0},to:{x:150,y:0}}]}};
 await regionEvent(event);assert.equal(game.messages.size,0);assert.equal(f.t().moveProgress.pc,2);
 await regionEvent({...event,data:{...event.data,teleport:true}});assert.equal(f.t().moveProgress.pc,2);
 await regionEvent(event);assert.equal(game.messages.size,1);assert.equal(f.t().moveProgress.pc,1);
 f.region.tokens.delete(f.target);await regionEvent({name:'tokenExit',region:f.region,data:{token:f.target}});
 assert.equal(f.t().moveProgress.pc,1); // Membership exit may precede the completed native movement event.
 await regionEvent(event);assert.equal(f.t().moveProgress.pc,0);
});
test('native turn events and membership govern targets without an updateToken geometry engine',async()=>{
 const f=setup();registerRuntime();await f.hook('updateToken',f.target,{x:0});assert.equal(game.messages.size,0);
 f.t().triggers=['turnEnd'];await regionEvent({name:'tokenTurnEnd',region:f.region,data:{token:f.target,combatant:{parent:{id:'c',round:1,turn:0}}}});
 assert.equal(game.messages.size,1);assert.match(activation(game.messages.contents[0]).event,/Combat.c.1.0.turnEnd/);
});
test('camera respects range, walls, illumination and elevation, without repeat spam',async()=>{
 const f=setup();Object.assign(f.t(),{triggers:['detect'],deviceId:'device',range:10,angle:90,anchor:{x:0,y:0},minElevation:0,maxElevation:5});f.region.elevation={bottom:0,top:5};
 f.target.x=-50;f.target.y=150;assert.equal(cameraSees(f.hazard,f.target),true);
 CONFIG.Canvas.polygonBackends.sight.testCollision=()=>true;assert.equal(cameraSees(f.hazard,f.target),false);CONFIG.Canvas.polygonBackends.sight.testCollision=()=>false;
 f.scene.globalLight=false;assert.equal(cameraSees(f.hazard,f.target),false);f.t().darkness=true;assert.equal(cameraSees(f.hazard,f.target),true);
 f.target.elevation=6;assert.equal(cameraSees(f.hazard,f.target),false);f.target.elevation=0;
 registerRuntime();await f.hook('canvasReady');assert.equal(game.messages.size,1);await resolve(game.messages.contents[0],'skip');await f.hook('updateWorldTime');assert.equal(game.messages.size,1);
});
test('linked device cycles terminate and each downstream activation requires approval',async()=>{
 const f=setup();const other=sceneHazard(f.scene,'other');f.scene.flags[M].hazards.other={...blankTrap(),triggerRegionId:'trap',hp:10,bodyId:'body',armed:true,actions:[{...blankAction('triggerHazard'),hazardId:'trap'}]};f.t().actions=[{...blankAction('triggerHazard'),hazardId:'other'}];
 await propose(f.hazard,f.target,'enter');await resolve(game.messages.contents[0],'approve');assert.equal(game.messages.size,1);await resolve(game.messages.contents[0],'apply');assert.equal(game.messages.size,2);assert.equal(activation(game.messages.contents[1]).state,'pending');
 await resolve(game.messages.contents[1],'approve');await resolve(game.messages.contents[1],'apply');assert.equal(game.messages.size,2);
});
test('temporary effects expire independently and preserve other statuses',async()=>{
 const f=setup();f.target.x=0;
 await applyAction(f.hazard,f.target,{...blankAction('status'),status:'prone',seconds:5},'a');
 f.target.actor.effects.set('manual',{id:'manual',statuses:['prone']});game.time.worldTime=106;await cleanupEffects(f.scene);assert.deepEqual([...f.target.actor.effects.keys()],['manual']);
 await applyAction(f.hazard,f.target,{...blankAction('status'),status:'prone',untilExit:true},'b');f.target.x=500;f.region.tokens.delete(f.target);await cleanupEffects(f.scene);assert.deepEqual([...f.target.actor.effects.keys()],['manual']);
});
test('native hazard damage uses body damage and preserves armor handling',async()=>{
 const f=setup();globalThis.Roll=class{static validate(){return true}async evaluate(){this.total=8;return this}async toMessage(){}};
 await applyAction(f.hazard,f.target,{...blankAction('damage'),formula:'2d6',armor:'ignore',ablation:2,lethal:false,shield:false},'damage');
 assert.equal(f.calls.damage.length,1);assert.deepEqual(f.calls.damage[0].slice(0,9),[8,0,'body',0,'basic',100,0,true,{useShield:false,damageReductionRole:true,damageReductionAE:true,brainDamageReduction:true}]);
});
test('damage requires a separate confirmation after rolling and stale double-clicks cannot apply it',async()=>{
 const f=setup();globalThis.Roll=class{static validate(){return true}async evaluate(){this.total=8;return this}async toMessage(){}};
 f.t().actions=[{...blankAction('damage'),formula:'2d6'}];await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];
 await resolve(m,'approve');const revision=activation(m).revision;await resolve(m,'apply',revision);
 assert.equal(activation(m).effectCard.id,'effect-card');assert.equal(f.calls.damage.length,0);
 await assert.rejects(()=>resolve(m,'apply',revision),/card changed/);assert.equal(f.calls.damage.length,0);
 await assert.rejects(()=>resolve(m,'apply',activation(m).revision),/Combat Tools card/);
 await assert.rejects(()=>applyCombatEffect(m.id,0,'effect-card'),/Roll the effect/);
 await applyCombatEffect(m.id,0,'effect-card',8);assert.equal(f.calls.damage.length,1);
});
test('end-on-damage effects remove only owned effects after actual HP loss',async()=>{
 const f=setup();registerRuntime();await f.hook('canvasReady');
 await applyAction(f.hazard,f.target,{...blankAction('status'),status:'prone',endOnDamage:true},'wake');
 f.target.actor.effects.set('other',{id:'other'});f.target.actor.system.derivedStats.hp.value=9;
 await f.hook('updateActor',f.target.actor);assert.deepEqual([...f.target.actor.effects.keys()],['other']);
});
test('fall effects only lower elevation; door effects only close doors',async()=>{
 const f=setup(),before={x:f.target.x,y:f.target.y};
 await applyAction(f.hazard,f.target,{...blankAction('relocate'),x:999,y:999,elevation:-5},'fall');
 assert.equal(f.target.elevation,-5);assert.equal(f.target.x,before.x);assert.equal(f.target.y,before.y);
 await assert.rejects(()=>applyAction(f.hazard,f.target,{...blankAction('relocate'),elevation:5},'rise'),/below/);
 const changes=[];f.scene.walls.set('door',{id:'door',door:1});f.scene.updateEmbeddedDocuments=async(type,data)=>{changes.push(...data);return data};
 await applyAction(f.hazard,f.target,{...blankAction('door'),wallIds:['door'],doorState:1},'door');assert.equal(changes[0].ds,0);
});
test('Scanner link uses native AP flags/icons and follows the physical device',async()=>{
 const f=setup();Object.assign(f.t(),{deviceId:'device',apType:'camera'});
 const template={id:'cameraTemplate',flags:{[M]:{templateType:'camera'}},getTokenDocument:async p=>({toObject:()=>({...p,actorId:'cameraTemplate',width:.5,height:.5,texture:{src:'modules/pneuma-scenetools/assets/camera.svg'}})})};game.actors.set(template.id,template);
 const placed=await createHazardAccessPoint(f.scene,f.t());f.t().apId=placed.id;await syncAccessPoint(f.hazard);
 const marker=f.scene.tokens.get(f.t().apId);assert.equal(marker.flags[M].accessPoint,true);assert.equal(marker.flags[M].type,'camera');assert.match(marker.texture.src,/camera.svg$/);assert.equal(marker.hidden,true);
 marker.texture.src='custom-camera.webp';f.body.x=350;await syncAccessPoint(f.hazard);assert.equal(marker.x,375);assert.equal(marker.texture.src,'custom-camera.webp');assert.equal(f.device.flags[M]?.accessPoint,undefined);
 f.scene.tokens.delete(marker.id);await syncAccessPoint(f.hazard);assert.equal(f.t().apId,'');
 assert.equal(await createHazardAccessPoint(f.scene,{...f.t(),apId:marker.id}).then(ap=>ap.actorId),'cameraTemplate');
 f.t().apId=marker.id;f.scene.tokens.set(marker.id,marker);
 f.t().apType='';await syncAccessPoint(f.hazard);assert.equal(f.scene.tokens.has(marker.id),false);
});
test('hazard edits preserve native Region visibility and save incomplete dependencies inactive',async()=>{
 const f=setup();f.region.visibility=2;await saveTrap(f.hazard,f.t());assert.equal(f.region.visibility,2);
 await saveTrap(f.hazard,{...f.t(),triggers:['detect'],deviceId:'',range:5});assert.equal(operational(f.hazard),false);assert.match(hazardIssues(f.t(),f.hazard).join(' '),/camera actor/);
});

test('exit membership before movement does not discard the last inside distance',async()=>{
 const f=setup();f.t().triggers=['move'];f.t().distance=3;f.t().moveProgress.pc=2;
 await regionEvent({name:'tokenExit',region:f.region,data:{token:f.target}});
 await regionEvent({name:'tokenMove',region:f.region,data:{token:f.target,segments:[{type:0,from:{x:0,y:0},to:{x:50,y:0}},{type:-1,from:{x:50,y:0},to:{x:150,y:0}}]}});
 assert.equal(game.messages.size,1);assert.equal(f.t().moveProgress.pc,0);
});

test('native membership changes clean up effects in a separate Region without a trap behavior',async()=>{
 const f=setup();registerRuntime();const area={...f.region,id:'area',uuid:'Scene.s.Region.area',flags:{},behaviors:new Collection(),tokens:new Set([f.target])};
 f.scene.regions.set(area.id,area);f.t().triggerRegionId=area.id;
 await applyAction(f.hazard,f.target,{...blankAction('status'),status:'prone',untilExit:true},'separate-area');
 await cleanupEffects(f.scene);assert.equal(f.target.actor.effects.size,1);
 area.tokens.delete(f.target);await f.hook('updateToken',f.target,{_regions:[]});assert.equal(f.target.actor.effects.size,0);
});

test('hazard types and multiple triggers round-trip with current fields',()=>{
 const t={...blankTrap(),hazardType:'active',triggers:['enter','turnEnd'],patrol:[{x:1,y:2,elevation:0}]};
 const [restored]=parsePresets(exportPresets([t]));assert.equal(restored.hazardType,'active');assert.deepEqual(restored.triggers,['enter','turnEnd']);
 const incomplete={...blankTrap()};delete incomplete.triggers;assert.throws(()=>validateTrap(incomplete));
 assert.throws(()=>validateTrap({...t,hazardType:'unknown'}));assert.deepEqual(validateTrap({...t,triggers:[]}).triggers,[]);assert.throws(()=>validateTrap({...t,triggers:['unknown']}));
});
test('multiple selected triggers reach the same GM-confirmed runtime',async()=>{
 const f=setup();f.t().triggers=['enter','turnEnd'];
 await regionEvent({name:'tokenEnter',region:f.region,data:{token:f.target}});assert.equal(game.messages.size,1);await resolve(game.messages.contents[0],'skip');
 await regionEvent({name:'tokenTurnEnd',region:f.region,data:{token:f.target,combatant:{parent:{id:'multi',round:1,turn:0}}}});assert.equal(game.messages.size,2);assert.equal(f.calls.effects.length,0);
});
test('notification hazards accept the current effect list',async()=>{
 const f=setup();Object.assign(f.t(),{hazardType:'notification',check:'Evasion',actions:[{...blankAction('notice'),name:'Camera alarm <script>'}]});
 await propose(f.hazard,f.target,'notice');const a=activation(game.messages.contents[0]),html=card(a);
 assert.match(html,/Camera alarm &lt;script&gt;/);assert.doesNotMatch(html,/Roll Evasion/);assert.match(html,/Confirm trigger/);
 await saveTrap(f.hazard,{...f.t(),actions:[blankAction('damage')]});await saveTrap(f.hazard,{...f.t(),armed:true,actions:[{...blankAction('notice'),name:'Camera alarm <script>'}]});
 await resolve(game.messages.contents[0],'approve');await resolve(game.messages.contents[0],'apply');assert.equal(f.calls.damage.length,0);assert.equal(f.calls.effects.length,0);
});

test('saving hazard drafts and presets preserves native Region elevation; cameras read native bounds',async()=>{
 const f=setup();Object.assign(f.t(),{deviceId:'device',range:10,minElevation:-100,maxElevation:100});
 const oldDraft=structuredClone(f.t());f.region.elevation={bottom:2,top:8};
 await saveTrap(f.hazard,oldDraft);assert.deepEqual(f.region.elevation,{bottom:2,top:8});
 const [preset]=parsePresets(exportPresets([oldDraft]));await saveTrap(f.hazard,preset);assert.deepEqual(f.region.elevation,{bottom:2,top:8});
 Object.assign(f.t(),{deviceId:'device',range:10});f.target.elevation=1;assert.equal(cameraSees(f.hazard,f.target),false);
 f.target.elevation=4;assert.equal(cameraSees(f.hazard,f.target),true);
 f.region.elevation={bottom:null,top:null};f.target.elevation=-1;assert.equal(cameraSees(f.hazard,f.target),true);
});

test('hazard activation effects run in order, require downstream approval, and suppress cycles',async()=>{
 const f=setup();const other=sceneHazard(f.scene,'other');f.scene.flags[M].hazards.other={...blankTrap(),triggerRegionId:'trap',hp:10,bodyId:'body',armed:true,actions:[{...blankAction('triggerHazard'),hazardId:'trap'}]};
 f.t().actions=[{...blankAction('status'),status:'prone'},{...blankAction('triggerHazard'),hazardId:'other'}];
 await propose(f.hazard,f.target,'enter');const source=game.messages.contents[0];await resolve(source,'approve');assert.equal(game.messages.size,1);
 await resolve(source,'apply');await applyCombatEffect(source.id,0,'effect-card');assert.equal(f.calls.effects.length,1);assert.equal(game.messages.size,1);
 await resolve(source,'apply');assert.equal(game.messages.size,2);const child=game.messages.contents[1];assert.equal(activation(child).state,'pending');
 await resolve(child,'approve');await resolve(child,'apply');assert.equal(game.messages.size,2);
 const [preset]=parsePresets(exportPresets([f.t()]));assert.equal(preset.actions[1].hazardId,'');
 await saveTrap(f.hazard,{...f.t(),actions:[{...blankAction('triggerHazard'),hazardId:'trap'}]});assert.equal(operational(f.hazard),false);assert.match(hazardIssues(f.t(),f.hazard).join(' '),/another hazard/);
});
test('missing downstream hazard stays inactive, including existing confirmation cards',async()=>{
 const f=setup();await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];await resolve(m,'approve');
 await saveTrap(f.hazard,{...f.t(),actions:[{...blankAction('triggerHazard'),hazardId:'missing'}]});
 await assert.rejects(()=>resolve(m,'apply'),/disabled or destroyed/);assert.equal(f.calls.effects.length,0);
 await propose(f.hazard,f.target,'enter again');assert.equal(game.messages.size,1);
});

function nativeCreation(f){
 if(f.nativeCreated)return;f.nativeCreated=true;
 const root={id:'root',name:'SceneTools',type:'Actor',folder:null,flags:{[M]:{SceneToolsFolder:'root'}}};
 const folder={id:'hazards',name:'Hazard Actors',type:'Actor',folder:root,flags:{[M]:{SceneToolsFolder:'Hazard Actors'}}};
 game.folders=new Collection([root,folder]);game.documentTypes={Actor:['mook','character'],Item:['armor']};
 let next=0;
 globalThis.Actor={createDocuments:async data=>data.map(entry=>{
   const id='created'+(++next),temp=f.makeToken('fixture'+id);f.scene.tokens.delete(temp.id);
   const actor=temp.actor;Object.assign(actor,{id,uuid:'Actor.'+id,name:entry.name,type:entry.type,folder:game.folders.get(entry.folder),flags:entry.flags??{},system:structuredClone(entry.system??{derivedStats:{hp:{value:40,max:40}},stats:{move:{value:6}}}),items:new Collection((entry.items??[]).map((i,n)=>({...i,id:i._id??'weapon'+n})))});
   actor.toObject=()=>structuredClone({...entry,system:actor.system,items:actor.items.contents});
   actor.getTokenDocument=async position=>({toObject:()=>({...position,actorId:id,name:actor.name,width:position.width??1,height:position.height??1})});
   actor.delete=async()=>game.actors.delete(id);game.actors.set(id,actor);return actor;
 })};
 const nativeCreate=f.scene.createEmbeddedDocuments;
 f.scene.createEmbeddedDocuments=async(kind,data)=>{if(kind==='Region')return nativeCreate(kind,data);assert.equal(kind,'Token');return data.map(entry=>{const token=f.makeToken('placed'+(++next));Object.assign(token,entry);token.actor=game.actors.get(entry.actorId);return token;})};
 canvas.regions={get:()=>({center:{x:100,y:100}})};
}
async function hazardTemplate(f,name='Hazard template',hp=12,weapon='Template gun'){
 const root=game.folders.get('root');let folder=game.folders.get('hazardTemplates');
 if(!folder){folder={id:'hazardTemplates',name:'Hazard Actor Templates',type:'Actor',folder:root,flags:{[M]:{SceneToolsFolder:'Hazard Actor Templates'}}};game.folders.set(folder.id,folder);}
 const [actor]=await Actor.createDocuments([{name,type:'mook',folder:folder.id,system:{derivedStats:{hp:{value:hp,max:hp}},stats:{move:{value:4}}},items:[{_id:'weapon',name:weapon,type:'weapon',system:{}}]}]);return actor;
}

test('template-backed hazards create independent actors without requiring a Region and preserve damage on retries',async()=>{
 const f=setup();nativeCreation(f);sceneStore(f);const template=await hazardTemplate(f),h=sceneHazard(f.scene,'owned');
 await saveTrap(h,{...blankTrap(),name:'Turret',hazardActorTemplateId:template.id,actions:[{...blankAction('attack'),weapon:'Template gun'}]});
 const body=f.scene.tokens.get(h.config.bodyId);assert.ok(body);assert.notEqual(body.actorId,template.id);assert.equal(body.actor.name,'Turret');assert.equal(body.hidden,true);assert.equal(body.actor.items.get('weapon').name,'Template gun');
 body.actor.system.derivedStats.hp.value=3;await saveTrap(h,h.config);assert.equal(h.config.bodyId,body.id);assert.equal(body.actor.system.derivedStats.hp.value,3);assert.equal(template.system.derivedStats.hp.value,12);
 const [preset]=parsePresets(exportPresets([h.config]));assert.equal(preset.hazardActorTemplateId,template.id);assert.equal(preset.bodyId,'');
 const next=await hazardTemplate(f,'Different template',18,'Other gun');await saveTrap(h,{...h.config,hazardActorTemplateId:next.id,actions:[]});
 assert.notEqual(h.config.bodyId,body.id);assert.equal(f.scene.tokens.has(body.id),false);assert.equal(game.actors.has(template.id),true);assert.equal(game.actors.has(next.id),true);assert.equal(f.scene.tokens.get(h.config.bodyId).actor.system.derivedStats.hp.value,18);
});

test('failed native template placement preserves the template and keeps the hazard draft saved',async()=>{
 const f=setup();nativeCreation(f);sceneStore(f);const template=await hazardTemplate(f),h=sceneHazard(f.scene,'owned');const count=game.actors.size;
 const create=f.scene.createEmbeddedDocuments;f.scene.createEmbeddedDocuments=async(kind,data)=>kind==='Region'?create(kind,data):[];
 await assert.rejects(()=>saveTrap(h,{...blankTrap(),name:'Turret',hazardActorTemplateId:template.id}),/placement was cancelled/);
 assert.equal(h.config.hazardActorTemplateId,template.id);assert.equal(game.actors.size,count);assert.equal(game.actors.has(template.id),true);
});

test('failed template replacement keeps the original hazard actor and rolls back the new copy',async()=>{
 const f=setup();nativeCreation(f);sceneStore(f);const template=await hazardTemplate(f),h=sceneHazard(f.scene,'owned');
 await saveTrap(h,{...blankTrap(),name:'Turret',hazardActorTemplateId:template.id});const oldId=h.config.bodyId;
 const replacement=await hazardTemplate(f,'Replacement',20);const actorCount=game.actors.size,update=f.scene.update;let writes=0;
 f.scene.update=async changes=>++writes===2?undefined:update(changes);
 await assert.rejects(()=>saveTrap(h,{...h.config,hazardActorTemplateId:replacement.id}),/cancelled/);
 assert.equal(h.config.bodyId,oldId);assert.ok(f.scene.tokens.get(oldId)?.actor);assert.equal(game.actors.size,actorCount);
 assert.match(hazardIssues(h.config,h).join(' '),/replace the hazard actor/);
});

test('new hazards get their own hidden body; save retries never heal or duplicate it',async()=>{
 const f=setup();nativeCreation(f);f.t().bodyId='';f.scene.tokens.delete('body');
 await saveTrap(f.hazard,f.t());const id=f.t().bodyId,body=f.scene.tokens.get(id);assert.ok(body);assert.equal(body.hidden,true);assert.notEqual(id,'device');assert.equal(body.actor.system.derivedStats.hp.value,40);
 body.actor.system.derivedStats.hp.value=4;await saveTrap(f.hazard,f.t());assert.equal(f.t().bodyId,id);assert.equal(body.actor.system.derivedStats.hp.value,4);assert.equal(game.actors.size,1);
 await saveTrap(f.hazard,{...f.t(),hp:20});assert.equal(body.actor.system.derivedStats.hp.value,20);assert.equal(f.device.actor.system.derivedStats.hp.value,10);
 body.actor.system.derivedStats.hp.value=0;assert.equal(operational(f.hazard),false);
});

test('hazards without a body remain inactive until Save creates a native Actor',async()=>{
 const f=setup();f.t().hp=0;f.t().bodyId='';
 assert.match(hazardIssues(f.t(),f.hazard).join(' '),/Save to create/);assert.equal(operational(f.hazard),false);
 await propose(f.hazard,f.target,'enter');assert.equal(game.messages.size,0);
 nativeCreation(f);await saveTrap(f.hazard,{...f.t(),armed:true});assert.equal(operational(f.hazard),true);
 await propose(f.hazard,f.target,'enter');const message=game.messages.contents[0];
 await resolve(message,'approve');await resolve(message,'apply');await applyCombatEffect(message.id,0,'effect-card');assert.equal(f.calls.effects.length,1);
 f.t().bodyId='';f.t().triggers=['deviceTurn'];assert.match(hazardIssues(f.t(),f.hazard).join(' '),/turn actor/);
});

test('already-correct HP does not cancel hazard creation when native updates return no document',async()=>{
 const f=setup();nativeCreation(f);const create=Actor.createDocuments;
 Actor.createDocuments=async data=>{const actors=await create(data);for(const actor of actors){const update=actor.update;actor.update=async changes=>{const before=JSON.stringify(actor);await update(changes);return JSON.stringify(actor)===before?undefined:actor;};}return actors;};
 const body=await createHazardToken(f.scene,'Own hazard',20,{x:0,y:0,elevation:0,hidden:true},{hazardBody:f.hazard.uuid});
 assert.ok(game.actors.has(body.actorId));assert.equal(body.actor.system.derivedStats.hp.value,20);assert.equal(body.actor.system.derivedStats.hp.max,20);
 // Accept an update whose persisted HP is correct even if the backend omits the return document.
 body.actor.update=async changes=>{applyChanges(body.actor,changes);};
 await setHazardHP(body,25);assert.equal(body.actor.system.derivedStats.hp.value,25);
 body.actor.update=async()=>undefined;
 await assert.rejects(()=>setHazardHP(body,30),/cancelled/);assert.equal(body.actor.system.derivedStats.hp.value,25);
});

test('rollback and token deletion cleanup cannot delete the same hazard Actor twice',async()=>{
 const f=setup();nativeCreation(f);const create=Actor.createDocuments;let deletions=0;
 Actor.createDocuments=async data=>{const actors=await create(data);for(const actor of actors){actor.system.derivedStats.hp.value=0;const update=actor.update;actor.update=async changes=>Object.keys(changes).some(k=>k.startsWith('system.derivedStats.hp'))?undefined:update(changes);actor.delete=async()=>{deletions++;assert.ok(game.actors.has(actor.id),'Actor must still exist');await Promise.resolve();game.actors.delete(actor.id);};}return actors;};
 const place=f.scene.createEmbeddedDocuments;
 f.scene.createEmbeddedDocuments=async(...args)=>{const tokens=await place(...args);for(const token of tokens){const remove=token.delete;token.delete=async()=>{await remove();await Promise.all([cleanupHazardActor(token),cleanupHazardActor(token)]);};}return tokens;};
 await assert.rejects(()=>createHazardToken(f.scene,'Cancelled hazard',20,{x:0,y:0,elevation:0,hidden:true},{hazardBody:f.hazard.uuid}),/cancelled/);
 assert.equal(deletions,1);assert.equal(game.actors.size,0);assert.equal(f.scene.tokens.some(t=>t.flags[M]?.hazardBody===f.hazard.uuid&&t.id!=='body'),false);
});
test('body creation and HP changes roll back when saving the Region is cancelled',async()=>{
 const f=setup();nativeCreation(f);const update=f.scene.update;f.scene.update=async()=>undefined;
 await assert.rejects(()=>saveTrap(f.hazard,{...f.t(),hp:20}),/cancelled/);assert.equal(f.body.actor.system.derivedStats.hp.value,10);
 f.t().bodyId='';f.scene.tokens.delete('body');await assert.rejects(()=>saveTrap(f.hazard,f.t()),/cancelled/);
 assert.equal(game.actors.size,0);assert.equal(f.scene.tokens.some(t=>t.flags[M]?.hazardBody),false);f.scene.update=update;
});
test('start-turn and actor-turn triggers require native membership, without camera range or prior engagement',async()=>{
 const f=setup();registerRuntime();f.t().triggers=['turnStart','deviceTurn'];f.t().turnActorId='device';f.t().targets='all';
 const start={name:'tokenTurnStart',region:f.region,data:{token:f.target,combatant:{parent:{id:'c',round:1,turn:0}}}};
 await regionEvent(start);assert.equal(game.messages.size,0);f.region.tokens.add(f.target);await regionEvent(start);assert.equal(game.messages.size,1);
 await resolve(game.messages.contents[0],'skip');await f.hook('updateCombat',{id:'c',scene:f.scene,round:1,turn:1,combatant:{tokenId:'device'}},{turn:1});assert.equal(game.messages.size,1);await f.hook('updateCombat',{id:'c',scene:f.scene,round:1,turn:1,combatant:{tokenId:'body'}},{turn:1});assert.equal(game.messages.size,2);
 await resolve(game.messages.contents[1],'skip');f.region.tokens.delete(f.target);await f.hook('updateCombat',{id:'c',scene:f.scene,round:2,turn:1,combatant:{tokenId:'body'}},{round:2});assert.equal(game.messages.size,2);
});
test('targets use this hazard Region and ignore retired alternate-area references',async()=>{
 const f=setup(),npc=f.makeToken('npc');npc.actor.testUserPermission=()=>false;f.t().targets='all';f.t().targetMode='region';f.region.tokens.add(npc);
 const external=f.makeToken('external'),area={...f.region,id:'area',uuid:'Scene.s.Region.area',tokens:new Set([external]),flags:{}};f.scene.regions.set('area',area);f.t().effectAreaId='area';f.t().useOtherRegion=true;
 await manualTrigger(f.hazard,[f.target]);assert.equal(activation(game.messages.contents[0]).target,npc.uuid);assert.equal(game.messages.size,1);
 await resolve(game.messages.contents[0],'skip');f.t().targetMode='triggering';await manualTrigger(f.hazard,[f.target]);assert.equal(game.messages.size,2);assert.equal(activation(game.messages.contents[1]).target,f.target.uuid);
 const cleaned=validateTrap(f.t());assert.equal('effectAreaId' in cleaned,false);assert.equal('useOtherRegion' in cleaned,false);
});

test('avoidance is delegated to CombatTools and verified before applying or skipping each effect',async()=>{
 const f=setup();
 f.t().actions=[{...blankAction('direct'),formula:'1d6',statuses:['prone'],resistSkill:'Resist Torture/Drugs',resistDV:12},{...blankAction('status'),status:'prone',resistSkill:'Evasion',resistDV:10}];
 await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];await resolve(m,'approve');
 assert.doesNotMatch(card(activation(m)),/resistRoll|resistPass|resistFail/);
 await resolve(m,'apply');assert.deepEqual(f.calls.cards[0].avoidance,{skill:'Resist Torture/Drugs',dv:12});
 await assert.rejects(()=>applyCombatEffect(m.id,0,'effect-card',6),/avoidance/);
 const result=(index,skill,dv,total)=>{game.modules.get('pneuma-combattools').api.sceneEffects.getAvoidanceResult=query=>{
   assert.deepEqual(query,{cardId:'effect-card',provider:M,source:m.id,index,target:f.target.uuid});
   return {skill,dv,total,passed:total>dv};
 };};
 result(0,'Resist Torture/Drugs',12,12);
 await applyCombatEffect(m.id,0,'effect-card',6);assert.equal(f.calls.damage.length,1);assert.equal(f.calls.effects.length,1);
 await resolve(m,'apply');result(1,'Evasion',10,11);
 await assert.rejects(()=>applyCombatEffect(m.id,1,'effect-card'),/avoidance/);
 await applyCombatEffect(m.id,1,'effect-card',undefined,true);
 assert.equal(activation(m).state,'done');assert.equal(f.calls.effects.length,1);
});

test('condition instances follow their target and destruction removes only their own effects and Actor',async()=>{
 const f=setup();nativeCreation(f);registerRuntime();
 await applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),hp:7,statuses:['prone'],moveReduction:2},'instance');
 const instance=f.scene.tokens.find(t=>t.flags[M]?.hazardCondition);assert.ok(instance);assert.equal(instance.actor.system.derivedStats.hp.value,7);assert.equal(f.target.actor.effects.size,2);
 f.target.actor.effects.set('manual',{id:'manual',statuses:['prone']});f.target.x=300;f.target.elevation=5;await f.hook('updateToken',f.target,{x:300,elevation:5});assert.equal(instance.x,400);assert.equal(instance.elevation,5);
 instance.actor.system.derivedStats.hp.value=0;await f.hook('updateToken',instance,{delta:{system:{derivedStats:{hp:{value:0}}}}});
 assert.deepEqual([...f.target.actor.effects.keys()],['manual']);assert.equal(f.scene.tokens.has(instance.id),false);assert.equal(game.actors.size,0);
});
test('failed condition application removes its spawned token and Actor',async()=>{
 const f=setup();nativeCreation(f);f.target.actor.createEmbeddedDocuments=async()=>{throw Error('effect failed')};
 await assert.rejects(()=>applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),hp:5,statuses:['prone']},'failure'),/effect failed/);
 assert.equal(game.actors.size,0);assert.equal(f.scene.tokens.some(t=>t.flags[M]?.hazardCondition),false);
});
test('attack effects always use the innate hazard actor, ignoring obsolete actor selections',async()=>{
 const f=setup();let attacker;
 f.body.object={};f.target.object={};f.body.actor.items.set('gun',{id:'gun',type:'weapon',name:'Custom weapon'});
 game.modules.set('pneuma-combattools',{active:true,api:{sceneAttack:{version:2,execute:async a=>{attacker=a;return {status:'started',messageId:'attack-card'};}}}});
 await applyAction(f.hazard,f.target,{...blankAction('attack'),actorId:'device',weapon:'Custom weapon'},'attack');assert.equal(attacker,f.body.object);
 assert.equal(f.body.actor.system.derivedStats.hp.value,10);
});

test('one weapon attack covers an area activation and cancellation leaves it available',async()=>{
 const f=setup(),second=f.makeToken('second');let attacks=0,cancel=true;
 f.body.object={};f.target.object={};second.object={};f.body.actor.items.set('gun',{id:'gun',type:'weapon',name:'Gun'});
 f.t().actions=[{...blankAction('attack'),weapon:'gun'},{...blankAction('attack'),weapon:'gun'}];f.t().targetMode='region';f.region.tokens=new Set([f.target,second]);
 game.modules.get('pneuma-combattools').api.sceneAttack={version:2,execute:async()=>{attacks++;return cancel?{status:'cancelled'}:{status:'started',messageId:'area-attack'};}};
 await manualTrigger(f.hazard,[f.target]);const [first,other]=game.messages.contents;
 await resolve(first,'approve');await resolve(first,'apply');assert.equal(activation(first).state,'ready');assert.equal(activation(first).attackReceipt,undefined);
 cancel=false;await resolve(first,'apply');await resolve(first,'apply');await resolve(other,'approve');await resolve(other,'apply');await resolve(other,'apply');
 assert.equal(attacks,2);assert.equal(activation(first).state,'done');assert.equal(activation(other).state,'done');assert.equal(activation(other).attackReceipt.messageId,'area-attack');
});
test('uncertain weapon failure blocks other targets from launching another attack',async()=>{
 const f=setup(),second=f.makeToken('second');let attacks=0;
 f.body.object={};f.target.object={};second.object={};f.body.actor.items.set('gun',{id:'gun',type:'weapon',name:'Gun'});
 f.t().actions=[{...blankAction('attack'),weapon:'gun'}];f.t().targetMode='region';f.region.tokens=new Set([f.target,second]);
 game.modules.get('pneuma-combattools').api.sceneAttack={version:2,execute:async()=>{attacks++;throw Error('after ammo');}};
 await manualTrigger(f.hazard,[f.target]);for(const m of game.messages){await resolve(m,'approve');await resolve(m,'apply');assert.equal(activation(m).state,'review');}
 assert.equal(attacks,1);
});
test('spent round allowance completes the weapon activation and permits next-round triggers',async()=>{
 const f=setup();let spent=false,attacks=0;
 f.body.object={};f.target.object={};f.body.actor.items.set('gun',{id:'gun',type:'weapon',name:'Gun'});
 f.t().actions=[{...blankAction('attack'),weapon:'gun'}];
 game.modules.get('pneuma-combattools').api.sceneAttack={version:2,execute:async()=>{
  if(spent)throw Object.assign(Error('Already attacked'),{code:'HAZARD_ATTACK_SPENT'});
  spent=true;attacks++;return {status:'started',messageId:'attack-card'};
 }};
 for(const event of ['Combat.c.1.0.turnStart','movement again']){
  await propose(f.hazard,f.target,event);const m=game.messages.contents.at(-1);await resolve(m,'approve');await resolve(m,'apply');assert.equal(activation(m).state,'done');
 }
 const exhausted=game.messages.contents.at(-1);assert.equal(activation(exhausted).attackReceipt.state,'spent');assert.equal(activation(exhausted).error,'');assert.match(card(activation(exhausted)),/Weapon attack skipped/);assert.equal(attacks,1);
 spent=false;await propose(f.hazard,f.target,'Combat.c.2.0.turnStart');assert.equal(game.messages.size,3);
 const next=game.messages.contents.at(-1);await resolve(next,'approve');await resolve(next,'apply');assert.equal(attacks,2);assert.equal(activation(next).state,'done');
});
test('spent area weapon allowance is shared across targets and leaves nonweapon effects available',async()=>{
 const f=setup(),second=f.makeToken('second');let attempts=0;
 f.body.object={};f.target.object={};second.object={};f.body.actor.items.set('gun',{id:'gun',type:'weapon',name:'Gun'});
 f.t().actions=[{...blankAction('attack'),weapon:'gun'},{...blankAction('status'),status:'prone'}];f.t().targetMode='region';f.region.tokens=new Set([f.target,second]);
 game.modules.get('pneuma-combattools').api.sceneAttack={version:2,execute:async()=>{attempts++;throw Object.assign(Error('Already attacked'),{code:'HAZARD_ATTACK_SPENT'});}};
 await manualTrigger(f.hazard,[f.target]);for(const m of game.messages){
  await resolve(m,'approve');await resolve(m,'apply');assert.equal(activation(m).state,'ready');assert.equal(activation(m).index,1);
  await resolve(m,'apply');await applyCombatEffect(m.id,1,'effect-card');assert.equal(activation(m).state,'done');
 }
 assert.equal(attempts,1);assert.equal(f.calls.effects.length,2);
});
test('delegated effects reject skipped, repeated, reconfigured and destroyed source activations',async()=>{
 const f=setup();await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];await resolve(m,'approve');await resolve(m,'apply');
 f.body.actor.system.derivedStats.hp.value=0;await assert.rejects(()=>applyCombatEffect(m.id,0,'effect-card'),/destroyed/);f.body.actor.system.derivedStats.hp.value=10;
 f.t().actions[0].name='changed';await assert.rejects(()=>applyCombatEffect(m.id,0,'effect-card'),/configuration changed/);f.t().actions[0].name='';
 await resolve(m,'omit');await assert.rejects(()=>applyCombatEffect(m.id,0,'effect-card'),/already resolved/);assert.equal(f.calls.effects.length,0);
});
for(const timing of ['before approval','after effect card'])test(`deactivation ${timing} stops new triggers but preserves existing damage resolution`,async()=>{
 const f=setup();f.t().actions=[{...blankAction('damage'),formula:'2d6'}];
 await propose(f.hazard,f.target,'entered');const m=game.messages.contents[0];
 if(timing==='before approval')f.t().armed=false;
 await resolve(m,'approve');await resolve(m,'apply');f.t().armed=false;
 assert.equal(operational(f.hazard),false);
 const other=f.makeToken('other');await propose(f.hazard,other,'entered later');assert.equal(game.messages.size,1);
 await assert.rejects(()=>manualTrigger(f.hazard,[other]),/activate the hazard/);
 await applyCombatEffect(m.id,0,'effect-card',8);assert.equal(f.calls.damage.length,1);assert.equal(activation(m).state,'done');assert.equal(f.t().armed,false);
 await assert.rejects(()=>applyCombatEffect(m.id,0,'effect-card',8),/already resolved/);assert.equal(f.calls.damage.length,1);
});
test('condition spawning keeps the existing GM application and posts a completed Combat Tools result',async()=>{
 const f=setup();nativeCreation(f);f.t().actions=[{...blankAction('spawnCondition'),hp:5,statuses:['prone']}];
 await propose(f.hazard,f.target,'enter');const m=game.messages.contents[0];await resolve(m,'approve');assert.equal(f.target.actor.effects.size,0);
 await resolve(m,'apply');assert.equal(f.target.actor.effects.size,1);assert.equal(activation(m).state,'done');assert.match(f.calls.cards[0].result,/created for/);
 await resolve(m,'apply');assert.equal(f.target.actor.effects.size,1);assert.equal(f.calls.cards.length,1);
});

test('native deletion of a condition instance cleans up owned effects and unused Actor',async()=>{
 const f=setup();nativeCreation(f);registerRuntime();await applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),hp:5,statuses:['prone']},'delete');
 const instance=f.scene.tokens.find(t=>t.flags[M]?.hazardCondition);f.scene.tokens.delete(instance.id);await f.hook('deleteToken',instance);
 assert.equal(f.target.actor.effects.size,0);assert.equal(game.actors.size,0);
});
test('per-effect status expiry deletes a condition instance without touching other instances',async()=>{
 const f=setup();nativeCreation(f);await applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),hp:5,statuses:['prone'],seconds:1},'short');
 await applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),hp:5,statuses:['prone']},'long');game.time.worldTime=102;await cleanupEffects(f.scene);
 assert.equal(f.target.actor.effects.size,1);assert.equal(f.scene.tokens.filter(t=>t.flags[M]?.hazardCondition).length,1);assert.equal(game.actors.size,1);
});


test('blank and partially configured hazards create an Actor but never request activation',async()=>{
 const f=setup();nativeCreation(f);f.scene.tokens.delete('body');delete f.scene.flags[M].hazards.trap;
 await saveTrap(f.hazard,{...blankTrap(),name:'',armed:true,actions:[blankAction('attack')]});
 assert.equal(f.t().name,'');assert.ok(f.t().bodyId);assert.equal(game.actors.size,1);assert.equal(operational(f.hazard),false);
 assert.match(hazardIssues(f.t(),f.hazard).join(' '),/name.*weapon/);
 await propose(f.hazard,f.target,'enter');assert.equal(game.messages.size,0);
 await saveTrap(f.hazard,{...f.t(),name:'Draft',hp:0,useOtherRegion:true,effectAreaId:''});
 assert.match(hazardIssues(f.t(),f.hazard).join(' '),/weapon/);
});

test('existing native trigger Region binding routes events, targets and actor turns without becoming a hazard',async()=>{
 const f=setup();registerRuntime();
 const area={...f.region,id:'sensor',uuid:'Scene.s.Region.sensor',tokens:new Set([f.target]),flags:{},behaviors:new Collection(),async createEmbeddedDocuments(kind,data){const created=data.map((v,i)=>({...v,id:'listen'+i}));for(const b of created)this.behaviors.set(b.id,b);return created;}};
 f.scene.regions.set(area.id,area);f.t().triggerRegionId=area.id;
 await saveTrap(f.hazard,{...f.t(),triggerRegionId:'sensor',targetMode:'region',triggers:['enter','deviceTurn'],turnActorId:'device'});
 assert.equal(area.flags[M],undefined);assert.equal(area.behaviors.contents[0].flags,undefined);
 await regionEvent({name:'tokenEnter',region:f.region,data:{token:f.target}},'behavior');assert.equal(game.messages.size,0);
 await regionEvent({name:'tokenEnter',region:area,data:{token:f.target}},'listen0');assert.equal(game.messages.size,1);
 await resolve(game.messages.contents[0],'skip');
 await f.hook('updateCombat',{id:'c',scene:f.scene,round:1,turn:1,combatant:{tokenId:'body'}},{turn:1});assert.equal(game.messages.size,2);
 area.behaviors.contents[0].disabled=true;assert.equal(operational(f.hazard),false);
 f.scene.regions.delete('sensor');assert.match(hazardIssues(f.t(),f.hazard).join(' '),/trigger Region/i);
});

test('presets clear every scene and specific-actor reference but retain condition templates',()=>{
 const f=setup();const t={...f.t(),triggerRegionId:'sensor',useOtherRegion:true,effectAreaId:'area',turnActorId:'drone',apId:'ap',deviceId:'drone',actions:[{...blankAction('spawnCondition'),actorTemplateId:'template'},{...blankAction('attack'),actorId:'drone'},{...blankAction('triggerHazard'),hazardId:'other'}]};
 const [p]=parsePresets(exportPresets([t]));for(const key of ['triggerRegionId','bodyId','apId','deviceId'])assert.equal(p[key],'');
 assert.equal(p.actions[0].actorTemplateId,'template');assert.equal(p.actions[1].actorId,'');assert.equal(p.actions[2].hazardId,'');for(const key of ['effectAreaId','turnActorId','useOtherRegion'])assert.equal(key in p,false);
});

async function conditionTemplate(f,withEffect=true){
 nativeCreation(f);
 const [template]=await Actor.createDocuments([{name:'User condition template',type:'mook',system:{derivedStats:{hp:{value:7,max:7}}}}]);
 if(withEffect)template.effects.set('native',{id:'native',disabled:false,toObject:()=>({_id:'native',name:'User condition',statuses:['prone'],changes:[]})});
 const create=f.scene.createEmbeddedDocuments;
 f.scene.createEmbeddedDocuments=async(kind,data)=>{const result=await create(kind,data);for(const token of result){assert.equal(token.actorLink,false);const independent=f.makeToken('tempActor');f.scene.tokens.delete(independent.id);token.actor=independent.actor;token.actor.system=structuredClone(template.system);}return result;};
 return template;
}

test('template conditions use independent HP, follow the target, and never alter or delete the template',async()=>{
 const f=setup(),template=await conditionTemplate(f);registerRuntime();
 await applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),actorTemplateId:template.id},'from-template');
 const instance=f.scene.tokens.find(t=>t.flags[M]?.hazardCondition);assert.ok(instance);assert.equal(instance.actor.system.derivedStats.hp.value,7);assert.equal(f.target.actor.effects.size,1);
 f.target.x=300;await f.hook('updateToken',f.target,{x:300});assert.equal(instance.x,400);
 instance.actor.system.derivedStats.hp.value=0;await cleanupEffects(f.scene);
 assert.equal(f.target.actor.effects.size,0);assert.equal(f.scene.tokens.has(instance.id),false);assert.equal(game.actors.has(template.id),true);assert.equal(template.system.derivedStats.hp.value,7);assert.equal(template.effects.size,1);
});

test('template without effects stays attached until destroyed or its target is deleted',async()=>{
 const f=setup(),template=await conditionTemplate(f,false);template.flags[M]={hazardOwned:true};
 await applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),actorTemplateId:template.id},'from-template');
 const instance=f.scene.tokens.find(t=>t.flags[M]?.hazardCondition);await cleanupEffects(f.scene);assert.equal(f.scene.tokens.has(instance.id),true);
 f.scene.tokens.delete(f.target.id);await cleanupEffects(f.scene);assert.equal(f.scene.tokens.has(instance.id),false);assert.equal(game.actors.has(template.id),true);
});

test('cancelled template effect application removes the instance but preserves the source template',async()=>{
 const f=setup(),template=await conditionTemplate(f);f.target.actor.createEmbeddedDocuments=async()=>[];
 await assert.rejects(()=>applyAction(f.hazard,f.target,{...blankAction('spawnCondition'),actorTemplateId:template.id},'cancelled'),/cancelled/);
 assert.equal(f.scene.tokens.some(t=>t.flags[M]?.hazardCondition),false);assert.equal(game.actors.has(template.id),true);
});


function sceneStore(f){
 nativeCreation(f);
 f.scene.flags={};f.scene.update=async changes=>{for(const [key,value] of Object.entries(changes)){const parts=key.split('.'),last=parts.at(-1);if(last.startsWith('-='))delete getPath(f.scene,parts.slice(0,-1).join('.'))[last.slice(2)];else applyChanges(f.scene,{[key]:value});}return f.scene;};
 delete f.scene.flags[M]?.hazards?.trap;
}

test('saving a scene hazard creates one native trigger Region and reuses it on retries',async()=>{
 const f=setup();sceneStore(f);const hazard=sceneHazard(f.scene,'saved');
 await saveTrap(hazard,{...blankTrap(),name:'First hazard'});
 assert.equal(traps(f.scene).length,1);assert.equal(findHazard(f.scene,'saved').config.name,'First hazard');assert.equal(f.scene.regions.size,2);
 const created=f.scene.regions.get(hazard.config.triggerRegionId);assert.equal(created.name,'First hazard-Tigger');assert.deepEqual(created.shapes,[]);assert.equal(created.visibility,1);
 assert.equal((await resolveHazard(hazard.uuid)).config.name,'First hazard');assert.equal(operational(hazard),false);
 await saveTrap(sceneHazard(f.scene,'second'),{...blankTrap(),name:'Second hazard'});
 await saveTrap(hazard,{...hazard.config,name:'Renamed'});
 assert.equal(traps(f.scene).length,2);assert.equal(findHazard(f.scene,'second').config.name,'Second hazard');assert.equal(findHazard(f.scene,'saved').config.name,'Renamed');assert.equal(f.scene.regions.size,3);
});

test('cancelled scene writes do not claim success or add a phantom hazard',async()=>{
 const f=setup();sceneStore(f);const hazard=sceneHazard(f.scene,'saved');f.scene.update=async()=>undefined;
 await assert.rejects(()=>saveTrap(hazard,blankTrap()),/cancelled/);assert.equal(traps(f.scene).length,0);
 f.scene.update=async()=>f.scene;await assert.rejects(()=>saveTrap(hazard,blankTrap()),/did not retain/);assert.equal(traps(f.scene).length,0);
});

test('cancelled trigger reference writes roll back the newly created Region',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'saved'),update=f.scene.update;let writes=0;
 f.scene.update=async changes=>++writes===2?undefined:update(changes);
 await assert.rejects(()=>saveTrap(h,{...blankTrap(),name:'Draft'}),/cancelled/);
 assert.equal(f.scene.regions.size,1);assert.equal(h.config.triggerRegionId,'');
 f.scene.update=update;await saveTrap(h,h.config);assert.ok(f.scene.regions.has(h.config.triggerRegionId));assert.equal(f.scene.regions.size,2);
});

test('cancelled automatic Region creation keeps an inactive saved hazard draft',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'saved');f.scene.createEmbeddedDocuments=async()=>[];
 await assert.rejects(()=>saveTrap(h,{...blankTrap(),name:'Draft'}),/Region creation was cancelled/);
 assert.equal(h.config.name,'Draft');assert.equal(h.config.triggerRegionId,'');assert.equal(operational(h),false);
});

test('scene hazard remains in the list if native behavior setup fails',async()=>{
 const f=setup();sceneStore(f);f.region.behaviors.clear();f.region.createEmbeddedDocuments=async()=>[];
 const hazard=sceneHazard(f.scene,'saved');
 await assert.rejects(()=>saveTrap(hazard,{...blankTrap(),name:'Retained draft',hp:10,triggerRegionId:'trap'}),/cancelled/);
 assert.equal(findHazard(f.scene,'saved').config.name,'Retained draft');assert.equal(operational(hazard),false);assert.equal(f.scene.regions.size,1);
});

test('scene-backed hazards trigger native cards, link to scene hazards and clean up effects on exit',async()=>{
 const f=setup();sceneStore(f);nativeCreation(f);f.region.tokens.add(f.target);const template=await hazardTemplate(f);
 const first=sceneHazard(f.scene,'first'),second=sceneHazard(f.scene,'second');
 await saveTrap(second,{...blankTrap(),name:'Second',hazardActorTemplateId:template.id,armed:true,triggerRegionId:'trap',triggers:[],actions:[{...blankAction('status'),status:'prone',untilExit:true}]});
 await saveTrap(first,{...blankTrap(),name:'First',hazardActorTemplateId:template.id,armed:true,triggerRegionId:'trap',actions:[{...blankAction('triggerHazard'),hazardId:'second'}]});
 await regionEvent({name:'tokenEnter',region:f.region,data:{token:f.target}},'behavior');assert.equal(game.messages.size,1);
 const m=game.messages.contents[0];await resolve(m,'approve');await resolve(m,'apply');assert.equal(game.messages.size,2);
 const child=game.messages.contents[1];await resolve(child,'approve');await resolve(child,'apply');await applyCombatEffect(child.id,0,'effect-card');assert.equal(f.target.actor.effects.size,1);
 f.region.tokens.delete(f.target);await cleanupEffects(f.scene);assert.equal(f.target.actor.effects.size,0);
 f.scene.regions.delete('trap');assert.equal(traps(f.scene).length,2);assert.equal(operational(first),false);
});


test('Foundry no-diff updates returning undefined still save and reopen hazards',async()=>{
 const f=setup();sceneStore(f);let writes=0,noops=0;
 f.scene.update=async changes=>{
   const before=JSON.stringify(f.scene.flags);applyChanges(f.scene,changes);
   if(JSON.stringify(f.scene.flags)===before){noops++;return undefined;}
   writes++;return f.scene;
 };
 const hazard=sceneHazard(f.scene,'saved');await saveTrap(hazard,{...blankTrap(),name:'Saved draft'});
 assert.equal(writes,3);assert.equal(noops,0);assert.equal(findHazard(f.scene,'saved').config.name,'Saved draft');
 await saveTrap(hazard,hazard.config);assert.equal(writes,3);assert.equal(noops,2);assert.equal(traps(f.scene).length,1);
 await saveTrap(hazard,{...hazard.config,name:'Renamed draft'});assert.equal(writes,4);assert.equal(findHazard(f.scene,'saved').config.name,'Renamed draft');
 const retained=hazard.config;f.scene.update=async()=>undefined;
 await assert.rejects(()=>saveTrap(hazard,{...retained,name:'Unsaved change'}),/cancelled/);
 assert.equal(findHazard(f.scene,'saved').config.name,'Renamed draft');
});

for(const cancelled of [null,'ap','actor','region','record'])test(`hazard deletion cleans linked resources and retries cancelled ${cancelled??'none'}`,async()=>{
 const f=setup();sceneStore(f);nativeCreation(f);const template=await hazardTemplate(f),h=sceneHazard(f.scene,'delete');
 await saveTrap(h,{...blankTrap(),name:'Delete me',hazardActorTemplateId:template.id});
 const body=f.scene.tokens.get(h.config.bodyId),actor=game.actors.get(body.actorId),region=f.scene.regions.get(h.config.triggerRegionId);
 const ap={id:'delete-ap',name:'AP',async update(changes){applyChanges(this,changes)},async delete(){f.scene.tokens.delete(this.id)}};f.scene.tokens.set(ap.id,ap);await saveTrap(h,{...h.config,apId:ap.id,apType:'camera'});
 let restore=()=>{};
 if(cancelled==='ap'||cancelled==='actor'||cancelled==='region'){const doc=cancelled==='ap'?ap:cancelled==='actor'?actor:region,original=doc.delete;doc.delete=async()=>undefined;restore=()=>doc.delete=original;}
 if(cancelled==='record'){const original=f.scene.update;f.scene.update=async changes=>Object.keys(changes).some(k=>k.includes('-='))?undefined:original(changes);restore=()=>f.scene.update=original;}
 if(cancelled){await assert.rejects(()=>deleteHazard(h),/cancelled/);assert.ok(h.config);assert.equal(h.config.armed,false);restore();}
 await deleteHazard(h);assert.equal(h.config,undefined);assert.equal(f.scene.tokens.has(ap.id),false);assert.equal(f.scene.tokens.has(body.id),false);assert.equal(f.scene.regions.has(region.id),false);assert.equal(game.actors.has(actor.id),false);assert.equal(game.actors.has(template.id),true);assert.equal(f.scene.regions.has('trap'),true);
});

test('deleting a trigger preserves hazard state and rejects Save without automatic replacement',async()=>{
 const f=setup();sceneStore(f);nativeCreation(f);registerRuntime();const template=await hazardTemplate(f),h=sceneHazard(f.scene,'missing');
 await saveTrap(h,{...blankTrap(),name:'Missing',hazardActorTemplateId:template.id,armed:true,actions:[{...blankAction('status'),status:'prone'}]});
 const r=f.scene.regions.get(h.config.triggerRegionId),body=f.scene.tokens.get(h.config.bodyId),actor=body.actor;
 actor.system.derivedStats.hp.value=3;r.shapes=[{type:'rectangle',x:0,y:0,width:100,height:100}];await saveTrap(h,{...h.config,armed:true});assert.equal(operational(h),true);
 await r.delete();await f.hook('deleteRegion',r);
 assert.ok(h.config);assert.equal(operational(h),false);assert.match(hazardIssues(h.config,h).join(' '),/Trigger Region is missing/);assert.equal(f.scene.tokens.has(body.id),true);
 await assert.rejects(()=>saveTrap(h,h.config),/Trigger Region no longer exists/);
 assert.equal(h.config.triggerRegionId,r.id);assert.equal(f.scene.regions.size,1);assert.equal(h.config.bodyId,body.id);assert.equal(actor.system.derivedStats.hp.value,3);assert.equal(operational(h),false);
});

test('incomplete hazards save inactive and identify required effect fields',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'incomplete');
 await saveTrap(h,{...blankTrap(),name:'',armed:true,actions:[blankAction('status')]});assert.equal(h.config.armed,false);
 const fields=[];hazardIssues(h.config,h,(message,field,index)=>fields.push({message,field,index}));
 assert.deepEqual(validateHazardReadiness(h.config,h),fields.map(({message,field,index})=>({message,field,effectIndex:index})));
 assert.ok(fields.some(f=>f.field==='name'));assert.ok(fields.some(f=>f.field==='triggerRegionId'));assert.ok(fields.some(f=>f.field==='status'&&f.index===0));
 await assert.rejects(()=>manualTrigger(h,[f.target]),/Complete and activate/);
});

test('automatic hazard Actors retain identity, damage and equipment across icon changes; preset icons round-trip',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'automatic');
 await saveTrap(h,{...blankTrap(),name:'Automatic'});const id=h.config.bodyId,token=f.scene.tokens.get(id),actor=token.actor;
 assert.equal(token.texture.src,'modules/pneuma-scenetools/assets/hazard-sign.svg');assert.equal(actor.img,token.texture.src);assert.equal(actor.prototypeToken.texture.src,token.texture.src);assert.equal(actor.flags[M].hazardOwned,true);
 actor.system.derivedStats.hp.value=7;actor.items.set('gun',{id:'gun',name:'Custom gun',type:'weapon'});
 await saveTrap(h,{...h.config,tokenIcon:'worlds/custom/hazard.webp'});
 assert.equal(h.config.bodyId,id);assert.equal(token.texture.src,'worlds/custom/hazard.webp');assert.equal(actor.img,'worlds/custom/hazard.webp');assert.equal(actor.prototypeToken.texture.src,'worlds/custom/hazard.webp');assert.equal(actor.system.derivedStats.hp.value,7);assert.equal(actor.items.has('gun'),true);
 const [preset]=parsePresets(exportPresets([h.config]));assert.equal(preset.tokenIcon,'worlds/custom/hazard.webp');assert.equal(preset.bodyId,'');
 const next=sceneHazard(f.scene,'copy');await saveTrap(next,preset);assert.notEqual(next.config.bodyId,id);assert.equal(f.scene.tokens.get(next.config.bodyId).texture.src,preset.tokenIcon);
 assert.throws(()=>validateTrap({...blankTrap(),tokenIcon:'javascript:alert(1)'}),/file path/);
});

test('default hazard Actors own an equipped Very Heavy Pistol with 200 Basic rounds loaded',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'pistol');await saveTrap(h,blankTrap());
 const actor=f.scene.tokens.get(h.config.bodyId).actor,pistol=actor.items.find(item=>item.type==='weapon'),ammo=actor.items.find(item=>item.type==='ammo');
 assert.equal(pistol.name,'Very Heavy Pistol');assert.equal(pistol.system.equipped,'equipped');assert.equal(pistol.system.weaponSkill,'Handgun');assert.equal(pistol.system.weaponType,'vHeavyPistol');assert.equal(pistol.system.damage,'4d6');
 assert.equal(pistol.system.magazine.max,200);assert.equal(pistol.system.magazine.value,200);
 assert.deepEqual(pistol.system.installedItems.list,[ammo.id]);assert.equal(ammo.system.type,'basic');assert.equal(ammo.system.variety,'vHeavyPistol');assert.equal(ammo.system.amount,0,'All ammunition is already loaded, with no extra reserve');
 assert.equal(actor.img,'modules/pneuma-scenetools/assets/hazard-sign.svg');assert.equal(actor.prototypeToken.texture.src,actor.img);
 pistol.system.magazine.value=199;await saveTrap(h,h.config);assert.equal(pistol.system.magazine.value,199,'Saving does not refill a used magazine');
 const next=sceneHazard(f.scene,'another');await saveTrap(next,blankTrap());const fresh=f.scene.tokens.get(next.config.bodyId).actor.items.find(item=>item.type==='weapon');
 assert.equal(fresh.system.magazine.value,200);assert.notEqual(fresh.id,pistol.id);assert.notEqual(fresh.system.installedItems.list[0],ammo.id);
});

for(const route of ['world','delta','flatDelta','startup'])test(`zero HP persistently deactivates only its hazard through ${route}`,async()=>{
 const f=setup();sceneStore(f);registerRuntime();const h=sceneHazard(f.scene,'destroyed'),other=sceneHazard(f.scene,'other');
 const config={...blankTrap(),name:'Destroyable',triggerRegionId:'trap',armed:true,actions:[{...blankAction('status'),status:'prone'}]};
 await saveTrap(h,config);await saveTrap(other,{...config,name:'Other'});
 const body=f.scene.tokens.get(h.config.bodyId),otherBody=f.scene.tokens.get(other.config.bodyId);assert.equal(h.config.armed,true);
 await propose(h,f.target,'enter');const card=game.messages.contents[0];assert.ok(card);
 body.actor.system.derivedStats.hp.value=0;
 if(route==='world')await f.hook('updateActor',body.actor);
 else if(route==='startup')await f.hook('ready');
 else await f.hook('updateToken',body,route==='delta'?{delta:{system:{derivedStats:{hp:{value:0}}}}}:{'delta.system.derivedStats.hp.value':0});
 assert.equal(h.config.armed,false);assert.equal(other.config.armed,true);assert.equal(operational(h),false);assert.equal(f.scene.tokens.has(body.id),true);assert.equal(f.scene.tokens.has(otherBody.id),true);
 await assert.rejects(()=>resolve(card,'approve'),/disabled or destroyed/);
 body.actor.system.derivedStats.hp.value=10;await f.hook('updateActor',body.actor);assert.equal(h.config.armed,false);
});
test('non-authoritative clients do not persist zero-HP deactivation',async()=>{
 const f=setup();sceneStore(f);registerRuntime();const h=sceneHazard(f.scene,'gm-only');await saveTrap(h,{...blankTrap(),name:'GM only',armed:true,triggerRegionId:'trap',actions:[{...blankAction('status'),status:'prone'}]});
 f.scene.tokens.get(h.config.bodyId).actor.system.derivedStats.hp.value=0;game.user=game.users.get('player');await f.hook('updateActor',f.scene.tokens.get(h.config.bodyId).actor);assert.equal(h.config.armed,true);assert.equal(operational(h),false);
});

test('a saved hazard cannot be rebound to another trigger Region',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'fixed');await saveTrap(h,{...blankTrap(),name:'Fixed'});
 const own=h.config.triggerRegionId;await saveTrap(h,{...h.config,triggerRegionId:'trap'});assert.equal(h.config.triggerRegionId,own);
 await f.scene.regions.get(own).delete();await assert.rejects(()=>saveTrap(h,{...h.config,triggerRegionId:'trap'}),/Trigger Region no longer exists/);assert.equal(h.config.triggerRegionId,own);
});

test('missing saved hazard Actors are not silently replaced',async()=>{
 const f=setup();f.scene.tokens.delete('body');const before=structuredClone(f.t());
 await assert.rejects(()=>saveTrap(f.hazard,f.t()),/Hazard Actor no longer exists/);
 assert.deepEqual(f.t(),before);assert.equal(game.actors.size,0);
});

test('Hazards cannot edit, trigger or resolve without active Combat Tools',async()=>{
 for(const ct of [undefined,{active:false}]){
  setup();game.modules.clear();if(ct)game.modules.set('pneuma-combattools',ct);
  const {editTrap}=await import('../dist/scripts/traps/ui.js');
  await assert.rejects(()=>editTrap(),/requires Pneuma Combat Tools/);
  await assert.rejects(()=>manualTrigger(null,[]),/requires Pneuma Combat Tools/);
  await assert.rejects(()=>resolve(null,'apply'),/requires Pneuma Combat Tools/);
  await assert.rejects(()=>applyAction(null,null,blankAction(),'test'),/requires Pneuma Combat Tools/);
  assert.equal(operational(null),false);
  await propose(null,null,'test');await regionEvent({});
  let ran=false;await enqueue(async()=>{ran=true});assert.equal(ran,false);
 }
});

test('hazard visibility updates suppress only native automatic panning and restore scope after failures',async()=>{
 const f=setup(),wrappers=new Map();globalThis.libWrapper={register(_module,path,callback){wrappers.set(path,callback)}};
 const {registerHazardVisibility,HAZARD_VISIBILITY_OPTION}=await import('../dist/scripts/traps/visibility.js');registerHazardVisibility();
 const update=wrappers.get('CONFIG.Token.objectClass.prototype._onUpdate'),control=wrappers.get('CONFIG.Token.objectClass.prototype.control');
 const token={document:f.body},pans=[];const nativeControl=options=>{pans.push(options?.pan);return true};
 const nativeUpdate=()=>control.call(token,nativeControl,{pan:true});
 update.call(token,nativeUpdate,{hidden:false},{[HAZARD_VISIBILITY_OPTION]:true});assert.deepEqual(pans,[false]);
 update.call(token,nativeUpdate,{hidden:false},{});assert.deepEqual(pans,[false,true]);
 update.call({document:f.target},()=>control.call({document:f.target},nativeControl,{pan:true}),{hidden:false},{[HAZARD_VISIBILITY_OPTION]:true});assert.equal(pans.at(-1),true);
 assert.throws(()=>update.call(token,()=>{throw Error('native failure')},{hidden:false},{[HAZARD_VISIBILITY_OPTION]:true}),/native failure/);
 control.call(token,nativeControl,{pan:true});assert.equal(pans.at(-1),true);
});

test('Locate finds the hazard Actor with blank or deleted Regions and falls back to a drawn Region',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'locate');await saveTrap(h,{...blankTrap(),name:'Locate'});
 const body=f.scene.tokens.get(h.config.bodyId),region=f.scene.regions.get(h.config.triggerRegionId),pans=[],controls=[];
 canvas.animatePan=async point=>pans.push(point);canvas.tokens={activate(){},get:id=>({control:options=>controls.push({id,options})})};
 body.x=300;body.y=200;await locateHazard(h);assert.deepEqual(pans.at(-1),{x:350,y:250});assert.equal(controls.at(-1).id,body.id);assert.equal(controls.at(-1).options.pan,false);
 await region.delete();await locateHazard(h);assert.equal(controls.at(-1).id,body.id);
 f.scene.tokens.delete(body.id);await assert.rejects(()=>locateHazard(h),/no Actor or drawn/);
 f.scene.flags[M].hazards[h.id].triggerRegionId='trap';canvas.regions={activate(){},get:id=>({center:{x:150,y:150},control:options=>controls.push({id,options})})};
 await locateHazard(h);assert.equal(controls.at(-1).id,'trap');assert.deepEqual(pans.at(-1),{x:150,y:150});
 canvas.scene={id:'different'};await assert.rejects(()=>locateHazard(h),/View the hazard's scene/);
});

test('Actor, GM and player Region visibility remain independent from hazard activation',async()=>{
 const f=setup();sceneStore(f);const h=sceneHazard(f.scene,'visibility');await saveTrap(h,{...blankTrap(),name:'Visible',triggerRegionId:'trap',armed:true,actions:[{...blankAction('status'),status:'prone'}]});
 const body=f.scene.tokens.get(h.config.bodyId),region=f.region;
 for(const visibility of [0,1,2]){await setHazardRegionVisibility(h,visibility);assert.equal(region.visibility,visibility);assert.equal(body.hidden,true);assert.equal(h.config.armed,true);assert.equal(operational(h),true);await saveTrap(h,h.config);assert.equal(region.visibility,visibility);}
 await assert.rejects(()=>setHazardRegionVisibility(h,3),/Invalid/);const update=region.update;region.update=async()=>undefined;await assert.rejects(()=>setHazardRegionVisibility(h,0),/cancelled/);region.update=update;
});

test('action normalization retains only fields belonging to the selected kind',()=>{
 const damage=validateAction({...blankAction('damage'),formula:'2d6',weapon:'old gun',wallIds:['wall'],status:'prone',actorTemplateId:'actor'});
 assert.equal(damage.formula,'2d6');
 for(const key of ['weapon','wallIds','status','actorTemplateId'])assert.equal(key in damage,false);
 const status=validateAction({...damage,kind:'status',status:'prone',seconds:9,untilExit:true});
 assert.equal(status.status,'prone');assert.equal(status.seconds,9);assert.equal(status.untilExit,true);
 for(const key of ['formula','armor','ablation'])assert.equal(key in status,false);
 const config=validateTrap({...blankTrap(),trigger:'move',triggers:['turnStart'],effectAreaId:'old',turnActorId:'old',useOtherRegion:true});
 assert.deepEqual(config.triggers,['turnStart']);
 for(const key of ['trigger','effectAreaId','turnActorId','useOtherRegion'])assert.equal(key in config,false);
 assert.deepEqual(validateTrap(config),config);
});

test('existing chat effect snapshots normalize before checking saved configuration',async()=>{
 const f=setup();f.t().actions=[{...blankAction('damage'),formula:'1d6'}];
 await propose(f.hazard,f.target,'old snapshot');const message=game.messages.contents[0];
 await resolve(message,'approve');await resolve(message,'apply');
 // Earlier saved cards carried every action field, including unrelated empty values.
 Object.assign(activation(message).config.actions[0],{status:'',weapon:'',actorTemplateId:'',wallIds:[],seconds:0});
 await applyCombatEffect(message.id,0,'effect-card',4);
 assert.equal(f.calls.damage.length,1);assert.equal(activation(message).state,'done');
});

test('player-only targeting uses native ownership and still excludes hazard bodies',()=>{
 const f=setup();f.t().targets='players';
 f.target.actor.testUserPermission=()=>{throw Error('Do not duplicate the native ownership query');};
 Object.defineProperty(f.target.actor,'hasPlayerOwner',{value:true,configurable:true});
 assert.equal(eligible(f.t(),f.target),true);
 Object.defineProperty(f.target.actor,'hasPlayerOwner',{value:false,configurable:true});
 assert.equal(eligible(f.t(),f.target),false);
 f.t().targets='all';assert.equal(eligible(f.t(),f.target),true);
 f.target.flags[M]={hazardBody:true};assert.equal(eligible(f.t(),f.target),false);
});

test('wall creation and deletion rescan detection; unrelated scenes and Actor edits do not',async()=>{
 const f=setup();Object.assign(f.t(),{triggers:['detect'],deviceId:'device',range:10});
 let scans=0,blocked=true;CONFIG.Canvas.polygonBackends.sight.testCollision=()=>{scans++;return blocked;};
 registerRuntime();await f.hook('canvasReady');assert.equal(game.messages.size,0);scans=0;
 await f.hook('updateActor',f.target.actor,{name:'Renamed'});
 await f.hook('updateScene',f.scene,{thumb:'new.webp'});
 await f.hook('updateWall',{parent:{id:'other'}});assert.equal(scans,0);
 await f.hook('createWall',{parent:f.scene});assert.ok(scans>0);scans=0;
 blocked=false;await f.hook('deleteWall',{parent:f.scene});assert.ok(scans>0);assert.equal(game.messages.size,1);
});
test('hazard maintenance combines queued wall refreshes and avoids other scenes',async()=>{
 const f=setup();Object.assign(f.t(),{triggers:['detect'],deviceId:'device',range:10});
 let scans=0;CONFIG.Canvas.polygonBackends.sight.testCollision=()=>{scans++;return true;};
 registerRuntime();await f.hook('canvasReady');const once=scans;scans=0;
 let release;const gate=new Promise(resolve=>release=resolve);void enqueue(()=>gate);
 const calls=[f.hook('createWall',{parent:f.scene}),f.hook('updateWall',{parent:f.scene}),f.hook('deleteWall',{parent:f.scene})];
 release();await Promise.all(calls);assert.equal(scans,once);
});

test('hazard damage delegates through CT only after source validation, without applying native damage twice',async()=>{
 const f=setup();f.t().actions=[{...blankAction('damage'),formula:'2d6',armor:'half',ablation:2}];
 await propose(f.hazard,f.target,'enter');const message=game.messages.contents[0];
 await resolve(message,'approve');await resolve(message,'apply');
 assert.deepEqual(f.calls.cards[0].damage,{armor:'half',ablation:2});
 let applied=0;await applyCombatEffect(message.id,0,'effect-card',8,false,async()=>{applied++;});
 assert.equal(applied,1);assert.equal(f.calls.damage.length,0);assert.equal(activation(message).state,'done');
 await assert.rejects(()=>applyCombatEffect(message.id,0,'effect-card',8,false,async()=>{applied++;}),/already resolved/);
 assert.equal(applied,1);
});
test('ended hazard refuses CT damage callback before mutating the target',async()=>{
 const f=setup();f.t().actions=[{...blankAction('damage'),formula:'2d6'}];
 await propose(f.hazard,f.target,'enter');const message=game.messages.contents[0];
 await resolve(message,'approve');await resolve(message,'apply');await resolve(message,'skip');
 let applied=0;await assert.rejects(()=>applyCombatEffect(message.id,0,'effect-card',8,false,async()=>{applied++;}),/already resolved/);
 assert.equal(applied,0);
});


test('Scene records are the sole hazard store and Region UUIDs never resolve as hazards',async()=>{
 const f=setup();f.region.flags[M]={trap:{...blankTrap(),name:'Ignored Region data',armed:true}};
 assert.deepEqual(traps(f.scene).map(h=>h.id),['trap']);assert.equal(findHazard(f.scene,'trap').uuid,f.hazard.uuid);
 assert.equal(await resolveHazard(f.region.uuid),null);
 delete f.scene.flags[M].hazards.trap;assert.deepEqual(traps(f.scene),[]);assert.equal(await resolveHazard(f.hazard.uuid),null);
});

test('native Region hazard creation writes one Scene record and leaves geometry/configuration native',async()=>{
 const f=setup();const [region]=await f.scene.createEmbeddedDocuments('Region',[{name:'Tripwire',shapes:[],flags:{}}]);
 const first=await ensureRegionHazard(region),second=await ensureRegionHazard(region);
 assert.equal(first.id,second.id);assert.equal(first.config.name,'Tripwire');assert.equal(first.config.triggerRegionId,region.id);
 assert.equal(first.config.armed,false);assert.equal(region.flags[M]?.trap,undefined);assert.equal(region.behaviors.size,1);
 assert.equal(traps(f.scene).length,2);assert.equal(first.uuid.includes('.SceneToolsHazard.'),true);
});

test('hazard activation progress saves only to its Scene record',async()=>{
 const f=setup(),before=structuredClone(f.region.shapes);await updateTrap(f.hazard,{armed:false,'moveProgress.pc':3});
 assert.equal(f.scene.flags[M].hazards.trap.armed,false);assert.equal(f.scene.flags[M].hazards.trap.moveProgress.pc,3);
 assert.equal(f.region.flags[M]?.trap,undefined);assert.deepEqual(f.region.shapes,before);
});

test('hazard attacks reject a missing native weapon skill before calling Combat Tools',async()=>{
 const f=setup();let attacks=0;
 f.body.object={actor:f.body.actor};f.target.object={actor:f.target.actor};
 f.body.actor.items.set('pistol',{id:'pistol',name:'Very Heavy Pistol',type:'weapon',system:{weaponSkill:'Handgun'}});
 game.modules.set('pneuma-combattools',{active:true,api:{sceneAttack:{version:2,execute:async()=>{attacks++;return {status:'started',messageId:'attack'};}}}});
 await assert.rejects(attackHazard(f.hazard,f.target,{...blankAction('attack'),weapon:'pistol'}),/missing the native 'Handgun' skill/);
 assert.equal(attacks,0);
 f.body.actor.items.set('skill',{id:'skill',type:'skill',name:'Handgun'});
 assert.equal((await attackHazard(f.hazard,f.target,{...blankAction('attack'),weapon:'pistol'})).status,'started');
 assert.equal(attacks,1);
});
