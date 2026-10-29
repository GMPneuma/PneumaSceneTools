import test from 'node:test';
import assert from 'node:assert/strict';
import {installPinVisibility,refreshPinVisibility} from '../dist/scripts/map-pins-visibility.js';

test('POI visibility overrides the layer for players without changing saved preferences or individual notes',async()=>{
  const wrappers=new Map(),hooks=new Map();
  let saved=false,nativeChanges=0;
  const scene={id:'poi',flags:{'pneuma-scenetools':{mapPinning:true}}};
  const layer={objects:{visible:false},interactiveChildren:false,active:false,placeables:[{visible:false},{visible:true}]};
  globalThis.canvas={ready:true,scene,notes:layer};
  globalThis.foundry={utils:{getProperty:(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object)}};
  const setting={onChange(value){nativeChanges++;layer.objects.visible=layer.interactiveChildren=value;}};
  globalThis.game={user:{isGM:false},settings:{get:()=>saved,settings:new Map([['core.notesDisplayToggle',setting]])}};
  globalThis.libWrapper={register(_id,path,fn){wrappers.set(path,fn);}};
  globalThis.Hooks={on(name,fn){hooks.set(name,fn);}};
  installPinVisibility();installPinVisibility();assert.equal(wrappers.size,2);
  hooks.get('canvasReady')();assert.equal(layer.objects.visible,true);assert.equal(layer.interactiveChildren,true);
  const deactivate=()=>{layer.objects.visible=layer.interactiveChildren=false;return 'native-result';};
  assert.equal(wrappers.get('NotesLayer.prototype._deactivate').call(layer,deactivate),'native-result');
  assert.equal(layer.objects.visible,true);
  await wrappers.get('NotesLayer.prototype._draw').call(layer,async()=>deactivate());
  assert.equal(layer.objects.visible,true);
  setting.onChange(false);assert.equal(nativeChanges,1);assert.equal(layer.objects.visible,true);assert.equal(saved,false);
  assert.deepEqual(layer.placeables,[{visible:false},{visible:true}]);
  scene.flags['pneuma-scenetools'].mapPinning=false;
  hooks.get('updateScene')(scene,{'flags.pneuma-scenetools.hazards.trap.detected':['pc']});
  assert.equal(layer.objects.visible,true,'Unrelated bookkeeping must not refresh the note layer');
  hooks.get('updateScene')(scene,{flags:{'pneuma-scenetools':{mapPinning:false}}});
  assert.equal(layer.objects.visible,false);assert.equal(layer.interactiveChildren,false);
  layer.active=true;refreshPinVisibility();assert.equal(layer.objects.visible,true);
  layer.active=false;saved=true;refreshPinVisibility();assert.equal(layer.objects.visible,true);
  canvas.scene={id:'ordinary',flags:{}};saved=false;hooks.get('canvasReady')();assert.equal(layer.objects.visible,false);
  wrappers.get('NotesLayer.prototype._deactivate').call(layer,deactivate);assert.equal(layer.objects.visible,false);
  canvas.scene=scene;scene.flags['pneuma-scenetools'].mapPinning=true;hooks.get('canvasReady')();assert.equal(layer.objects.visible,true);
});


test('POI screen size caps at configured size while zoom-out, position and document stay native',async()=>{
  const {installPinScaling,refreshPinScale}=await import('../dist/scripts/map-pins-scale.js');
  const hooks=new Map();globalThis.Hooks={on(name,fn){hooks.set(name,fn);}};
  const scene={id:'scale',flags:{'pneuma-scenetools':{mapPinning:true}}};
  globalThis.foundry={utils:{getProperty:(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object)}};
  const note={document:{parent:scene,iconSize:80,fontSize:24,x:400,y:300},position:{x:400,y:300},scale:{x:1,y:1,set(x,y){this.x=x;this.y=y;}}};
  globalThis.canvas={scene,stage:{scale:{x:1}},notes:{placeables:[note]}};
  installPinScaling();installPinScaling();assert.equal(hooks.size,5);
  for(const zoom of [0.25,1,2,4,2,0.5]){
    canvas.stage.scale.x=zoom;hooks.get('canvasPan')();
    assert.equal(note.scale.x*zoom,Math.min(zoom,1));assert.equal(note.scale.y,note.scale.x);
    assert.deepEqual(note.position,{x:400,y:300});assert.equal(note.document.iconSize,80);assert.equal(note.document.fontSize,24);
  }
  canvas.stage.scale.x=3;hooks.get('drawNote')(note);assert.equal(note.scale.x,1/3);
  hooks.get('refreshNote')(note);assert.equal(note.scale.x,1/3);
  scene.flags['pneuma-scenetools'].mapPinning=false;
  hooks.get('updateScene')(scene,{'flags.pneuma-scenetools.hazards.trap.moveProgress.pc':1});
  assert.equal(note.scale.x,1/3,'Hazard progress must not rescan note scales');
  hooks.get('updateScene')(scene,{'flags.pneuma-scenetools.mapPinning':false});assert.equal(note.scale.x,1);
  note.scale.set(0.8,0.8);refreshPinScale(note);assert.equal(note.scale.x,0.8);
  scene.flags['pneuma-scenetools'].mapPinning=true;hooks.get('canvasReady')();assert.equal(note.scale.x,0.8/3);
  scene.flags['pneuma-scenetools'].mapPinning=false;hooks.get('updateScene')(scene,{'flags.pneuma-scenetools.-=mapPinning':null});assert.equal(note.scale.x,0.8);
});
