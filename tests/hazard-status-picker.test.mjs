import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseHazardStatus} from '../dist/scripts/traps/status-picker.js';

function setup(){
 globalThis.game={modules:new Map(),i18n:{localize:x=>x}};
 globalThis.CONFIG={statusEffects:[{id:'prone',name:'Prone',img:'prone.svg'}]};
}
test('active CT picker is used with supported native IDs and preserves cancellation',async()=>{
 setup();let calls=0;
 game.modules.set('pneuma-combattools',{active:true,api:{statusPicker:{version:1,choose:async(selected,slot,options)=>{
   calls++;assert.deepEqual(selected,[]);assert.equal(slot,0);assert.deepEqual(options.allowedIds,['prone']);return ['prone'];
 }}}});
 globalThis.Dialog={prompt:async()=>{throw Error('Fallback must not open');}};
 assert.equal(await chooseHazardStatus(''),'prone');assert.equal(calls,1);
 const picker=game.modules.get('pneuma-combattools').api.statusPicker;
 picker.choose=async()=>null;assert.equal(await chooseHazardStatus('prone'),null);
 picker.choose=async()=>['instant:flashbang'];await assert.rejects(()=>chooseHazardStatus(''),/unavailable/);
});
test('inactive CT and missing picker never open a substitute list',async()=>{
 setup();game.modules.set('pneuma-combattools',{active:false,api:{statusPicker:{version:1,choose:async()=>{throw Error('Inactive CT');}}}});
 globalThis.Dialog={prompt:async()=>{throw Error('Substitute picker must not open');}};await assert.rejects(()=>chooseHazardStatus(''),/Enable Combat Tools/);
 game.modules.set('pneuma-combattools',{active:true,api:{}});
 await assert.rejects(()=>chooseHazardStatus(''));
});

test('unsupported public picker versions fail without loading private Combat Tools files',async()=>{
 setup();game.modules.set('pneuma-combattools',{active:true,api:{statusPicker:{version:2,choose:async()=>{throw Error('Must not run');}}}});
 await assert.rejects(()=>chooseHazardStatus('prone'),/statusPicker API v1/);
});
