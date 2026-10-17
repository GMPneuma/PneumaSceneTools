import assert from "node:assert/strict";
import {fixture} from "./browser-fixture.mjs";
const {chromium}=await import(process.env.PNEUMA_PLAYWRIGHT_MODULE??"playwright");
const browser=await chromium.launch({headless:true,...(process.env.PNEUMA_BROWSER_CHANNEL?{channel:process.env.PNEUMA_BROWSER_CHANNEL}:{})});
try {
  const image=n=>`maps/SOL-CorporateEateryInt-Map${n}-128px-4k.webp`;
  // Generic filenames in a conventional folder must still be discovered together.
  const json=n=>`maps/FoundryWalls/export-${n}.json`;
  const source=n=>({name:`Corporate Eatery Interior Floor ${n}`,width:4000,height:3000,
    _id:`ExportScene0000${n}`,_stats:{coreVersion:"12.331"},background:{src:image(n),offsetX:4,offsetY:8,scaleX:1,scaleY:1},
    foreground:"assets/canopy.webp",foregroundElevation:12,padding:0.25,
    grid:{type:1,size:128,distance:2,units:"m",color:"#ff0000",alpha:0.4,style:"solidLines",thickness:1},
    environment:{darknessLevel:0.65,globalLight:{enabled:false,alpha:0.8},cycle:true},
    tokenVision:false,fog:{exploration:false,overlay:"assets/fog.webp"},
    walls:[{_id:"WallOriginal0001",c:[200,200,400,200],door:1,ds:0,flags:{test:{wall:true}}}],
    lights:[{_id:"LightOriginal001",x:800,y:800,config:{dim:10,bright:5,color:"#abcdef"}}],
    tiles:[{_id:"TileOriginal0001",x:40,y:50,width:60,height:70,texture:{src:"assets/tile.webp"}}],
    tokens:[{_id:"TokenOriginal001",actorId:"ActorOriginal001",texture:{src:"assets/token.webp"}}],
    sounds:[{_id:"SoundOriginal001",x:100,y:200,path:"assets/rain.ogg",radius:20}],
    notes:[{_id:"NoteOriginal0001",entryId:"JournalOriginal1",x:250,y:300}],drawings:[{_id:"DrawOriginal0001",text:"Imported drawing",shape:{type:"r",width:200,height:100}}],
    journal:"JournalOriginal1",journalEntryPage:"PageOriginal0001",playlist:"PlaylistOriginal",playlistSound:"TrackOriginal001",
    flags:{vendor:{variant:n,custom:{keep:true}}},thumb:"original-thumbnail",weather:"rain",navName:"Original navigation label"});
  const imports=Object.fromEntries([1,2].map(n=>[json(n),source(n)]));
  const files=[1,2,3,4].map(image).concat(Object.keys(imports));
  const {page,state,errors}=await fixture(browser,{selected:image(1),files,imports});
  assert.equal(await page.locator('[name="importMode"]').count(),0);
  await page.locator('[data-plan="3"]').waitFor();
  assert.equal(await page.locator('[data-plan]').count(),4);
  assert.equal(await page.locator('[name="json-0"]').inputValue(),json(1));
  assert.equal(await page.locator('[name="json-1"]').inputValue(),json(2));
  await page.locator('[name="allVariants"]').check();
  await page.locator('[name="json-2"]').selectOption(json(1));
  await page.locator('[name="json-3"]').selectOption(json(2));
  await page.locator('[name="allVariants"]').check();
  await page.locator('button[type="submit"]').click();await page.locator('[data-scene="3"]').waitFor({state:'attached'});
  const field=name=>page.locator(`[name="scene0-${name}"]`);
  assert.equal(await field("name").inputValue(),source(1).name);
  assert.equal(await field("Color").inputValue(),"#000000","Imported red grids default to black in the editor");
  assert.equal(await page.locator('[name="sharedColor"]').inputValue(),"#000000");
  assert.equal(await field("width").inputValue(),"4000");assert.equal(await field("gridChoice").inputValue(),"128");
  assert.match(await field("gridChoice").locator('option:checked').textContent(),/\(Imported\)/);
  assert.deepEqual(await field("gridType").locator('option').allTextContents(),['Squares (Imported)','Gridless']);
  assert.equal(await field("distance").locator('option:checked').textContent(),'2 m (Imported)');
  assert.equal(await field("darkness").inputValue(),"0.65");assert.equal(await field("globalLight").isChecked(),false);
  assert.equal(await field("fogExploration").isChecked(),false);
  assert.equal(await field("name").isDisabled(),false);
  const markers=await page.locator('[data-scene="0"] canvas').evaluate(canvas=>{
    const ctx=canvas.getContext("2d"), scale=Math.min(canvas.width/4000,canvas.height/3000);
    return [[200,100],[700,700]].map(([x,y])=>Array.from(ctx.getImageData(Math.round(x*scale),Math.round(y*scale),1,1).data));
  });
  assert.deepEqual(markers,[[0,255,255,255],[255,187,68,255]]);
  await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('form'));
  const nativeImports=await page.evaluate(()=>globalThis.nativeImports);
  for(let i=0;i<4;i++) assert.deepEqual(nativeImports[i],source(i%2+1));
  assert.deepEqual((await state()).scenes.map(scene=>scene.background.src),[1,2,3,4].map(image));
  const operations=await page.evaluate(()=>globalThis.sceneOperations);
  for(const id of new Set(operations.map(operation=>operation.id))) assert.equal(operations.find(operation=>operation.id===id).kind,"import");
  assert.deepEqual(operations.filter(operation=>operation.kind==="update").map(operation=>operation.data),[{"grid.color":"#000000"},{thumb:"thumbnail"},{"grid.color":"#000000"},{thumb:"thumbnail"},{"background.src":image(3),"grid.color":"#000000"},{thumb:"thumbnail"},{"background.src":image(4),"grid.color":"#000000"},{thumb:"thumbnail"}]);
  assert.deepEqual((await state()).scenes.map(scene=>scene.thumb),Array(4).fill("thumbnail"));
  assert.equal((await state()).scenes[2].name,source(1).name);
  assert.ok((await state()).scenes.every(scene=>scene.grid.color==="#000000"));
  const migrationSources=await page.evaluate(()=>globalThis.importSources);
  assert.equal(migrationSources[0]._stats.coreVersion,"12.331");
  assert.equal(migrationSources[0].journal,"JournalOriginal1");
  // Failed native imports remove their incomplete destination before retry.
  await page.waitForFunction(()=>!document.querySelector('form'));
  await page.evaluate(()=>openCreator());await page.locator('[data-native-folder] [name="target"]').waitFor();
  await page.locator('[data-native-folder] [name="file"]').fill(image(1));
  await page.locator('[data-folder-next]:enabled').click();await page.locator('[name="variant-0"]').waitFor();
  await page.locator('button[type="submit"]').click();await field("name").waitFor();
  await page.evaluate(()=>globalThis.failNativeImport=true);
  await page.locator('button[type="submit"]').click();await page.locator('[data-error]').filter({hasText:"native import rejection"}).waitFor();
  assert.equal((await state()).scenes.length,4);
  await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('form'));
  assert.equal((await state()).scenes.length,5);assert.equal(await page.evaluate(()=>globalThis.creationAttempts),6);
  assert.deepEqual(errors,[]);await page.close();
  // Make changes starts with JSON values and retains fields outside the editable controls.
  const overlay="maps/SOL-CorporateEateryInt-Map1-OVERLAY-128px-4k.webp";
  const modified=await fixture(browser,{selected:image(1),files:[...files,overlay],imports});
  await modified.page.locator('button[type="submit"]').click();await modified.page.locator('[name="scene0-name"]').waitFor();
  await modified.page.locator('[name="scene0-name"]:enabled').waitFor();
  await modified.page.locator('[name="scene0-name"]').fill("Adjusted Scene");
  await modified.page.locator('[name="scene0-darkness"]').fill("0.2");
  await modified.page.locator('[name="scene0-fogExploration"]').check();
  await modified.page.locator('[data-scene="0"] details summary').filter({hasText:'Imported image paths'}).click();
  await modified.page.locator('[name="scene0-asset-tiles-0"]').selectOption(overlay);
  await modified.page.evaluate(()=>globalThis.failOverrides=true);
  await modified.page.locator('button[type="submit"]').click();
  await modified.page.locator('[data-error]').filter({hasText:"override rejection"}).waitFor();
  assert.equal((await modified.state()).scenes.length,0);
  await modified.page.locator('button[type="submit"]').click();await modified.page.waitForFunction(()=>!document.querySelector('form'));
  const edited=(await modified.state()).scenes[0];assert.equal(edited.name,"Adjusted Scene");assert.equal(edited.environment.darknessLevel,0.2);
  assert.deepEqual(edited.fog,{...source(1).fog,exploration:true});
  assert.equal(edited.tiles.length,1);assert.deepEqual(edited.tiles[0],{...source(1).tiles[0],texture:{...source(1).tiles[0].texture,src:overlay}});
  for(const key of ["walls","lights","tokens","sounds","notes","drawings","flags","journal","playlist","weather","foreground"])
    assert.deepEqual(edited[key],source(1)[key]);
  assert.deepEqual(await modified.page.evaluate(()=>globalThis.nativeImports),[source(1),source(1)]);
  const overrideOperations=await modified.page.evaluate(()=>globalThis.sceneOperations);
  assert.deepEqual(overrideOperations.map(operation=>operation.kind),["import","update","import","update","embedded:Tile","update"]);
  assert.deepEqual(overrideOperations.at(-1).data,{thumb:"thumbnail"});
  assert.deepEqual(overrideOperations[1].data,{name:"Adjusted Scene","grid.color":"#000000","environment.darknessLevel":0.2,"fog.exploration":true});
  assert.equal(await modified.page.evaluate(()=>globalThis.creationAttempts),2);
  assert.deepEqual(modified.errors,[]);
  // Editable review repairs exported asset paths.
  const rematched=await fixture(browser,{selected:image(1),files:[...files,"maps/canopy.webp","maps/tile.webp","maps/token.webp","maps/rain.ogg"],imports});
  await rematched.page.route('https://scene.test/maps/canopy.webp',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000"><rect width="2000" height="3000" fill="#ff00ff"/></svg>'}));
  await rematched.page.locator('button[type="submit"]').click();
  await rematched.page.locator('[name="scene0-name"]:enabled').waitFor();
  await rematched.page.waitForFunction(()=>{
    const pixel=document.querySelector('[data-scene="0"] canvas').getContext('2d').getImageData(100,150,1,1).data;
    return pixel[0]===255 && pixel[1]===0 && pixel[2]===255;
  });
  assert.equal(await rematched.page.locator('[data-scene="0"] [data-foreground-status]').textContent(),'Foreground: maps/canopy.webp');
  await rematched.page.locator('button[type="submit"]').click();
  await rematched.page.waitForFunction(()=>!document.querySelector('form'));
  const repaired=(await rematched.state()).scenes[0];
  assert.equal(repaired.foreground,"maps/canopy.webp");
  assert.equal(repaired.tiles[0].texture.src,"maps/tile.webp");
  assert.equal(repaired.tokens[0].texture.src,"maps/token.webp");
  assert.equal(repaired.sounds[0].path,"maps/rain.ogg");
  assert.deepEqual(repaired.walls,source(1).walls);assert.deepEqual(repaired.lights,source(1).lights);
  assert.deepEqual(await rematched.page.evaluate(()=>globalThis.nativeImports),[source(1)]);
  assert.deepEqual(rematched.errors,[]);await rematched.page.close();
  // A differently named foreground can be selected without hiding other missing assets.
  const replacement='maps/renamed-roof.webp';
  const manual=await fixture(browser,{selected:image(1),files:[image(1),json(1),replacement,'elsewhere/unrelated.webp'],imports});
  await manual.page.locator('button[type="submit"]').click();
  const foreground=manual.page.locator('[name="scene0-foreground"]');
  await foreground.waitFor();
  assert.equal(await foreground.locator('option:checked').textContent(),'Missing foreground — select a file');
  assert.equal(await foreground.locator('option[value="assets/canopy.webp"]:enabled').count(),0);
  assert.equal(await foreground.locator('option').filter({hasText:'canopy.webp'}).count(),0);
  assert.equal(await foreground.locator('option[value="elsewhere/unrelated.webp"]').count(),0);
  await foreground.selectOption(replacement);
  assert.equal(await manual.page.locator('[data-unresolved-path="assets/canopy.webp"]').isVisible(),false);
  assert.equal(await manual.page.locator('[data-unresolved-path="assets/tile.webp"]').isVisible(),true);
  assert.equal(await manual.page.locator('[data-scene="0"] [data-foreground-status]').textContent(),`Foreground: ${replacement}`);
  await manual.page.locator('[data-back]').click();
  await manual.page.locator('[name="variant-0"]').waitFor();
  await manual.page.locator('button[type="submit"]').click();
  await foreground.waitFor();assert.equal(await foreground.inputValue(),replacement);
  await manual.page.locator('button[type="submit"]').click();
  await manual.page.waitForFunction(()=>!document.querySelector('form'));
  assert.equal((await manual.state()).scenes[0].foreground,replacement);
  assert.deepEqual(manual.errors,[]);await manual.page.close();
  // Closing after a failed import cannot strand a partial Scene or duplicate it on reopen.
  const recovery=await fixture(browser,{selected:image(1),files,imports});
  await recovery.page.locator('[name="variant-0"]').waitFor();await recovery.page.locator('button[type="submit"]').click();
  await recovery.page.locator('[name="scene0-name"]').waitFor();
  await recovery.page.evaluate(()=>{globalThis.failNativeImport=true;globalThis.failCleanup=true});
  await recovery.page.locator('button[type="submit"]').click();
  await recovery.page.locator('[data-error]').filter({hasText:"Cleanup failed"}).waitFor();
  assert.equal((await recovery.state()).scenes.length,1);
  await recovery.page.evaluate(()=>globalThis.failCleanup=false);
  // A retry imports into the retained destination when deletion failed, without duplication.
  await recovery.page.locator('button[type="submit"]').click();await recovery.page.waitForFunction(()=>!document.querySelector('form'));
  assert.equal((await recovery.state()).scenes.length,1);
  assert.equal(await recovery.page.evaluate(()=>globalThis.creationAttempts),1);
  assert.deepEqual(recovery.errors,[]);await recovery.page.close();
  for(const failure of ['cancelOverrides','cancelRematch']){
    const cancelled=await fixture(browser,{selected:image(1),files:[...files,overlay,'maps/canopy.webp','maps/tile.webp'],imports});
    await cancelled.page.locator('[name="variant-0"]').waitFor();await cancelled.page.locator('button[type="submit"]').click();
await cancelled.page.locator('[name="scene0-name"]:enabled').waitFor();

    await cancelled.page.evaluate(key=>globalThis[key]=true,failure);
    await cancelled.page.locator('button[type="submit"]').click();
    await cancelled.page.locator('[data-error]').filter({hasText:/did not save|partially saved/}).waitFor();
    assert.equal((await cancelled.state()).scenes.length,0,'Incomplete imports must be cleaned up');
    await cancelled.page.locator('button[type="submit"]').click();await cancelled.page.waitForFunction(()=>!document.querySelector('form'));
    assert.equal((await cancelled.state()).scenes.length,1,'Retry must save exactly one Scene');
    assert.deepEqual(cancelled.errors,[]);await cancelled.page.close();
  }
  const appearance=await fixture(browser,{selected:image(1),files,imports});
  await appearance.page.locator('[name="allVariants"]').check();
  await appearance.page.locator('button[type="submit"]').click();
  await appearance.page.locator('[name="scene0-Padding"]').waitFor();
  assert.equal(await appearance.page.locator('[name="scene0-Padding"]').inputValue(),'25');
  assert.equal(await appearance.page.locator('[name="scene0-Color"]').inputValue(),'#000000');
  await appearance.page.locator('[name="scene0-Thickness"]').fill('2');
  await appearance.page.locator('[name="applyShared"]').check();
  assert.equal(await appearance.page.locator('[name="scene0-Thickness"]').isDisabled(),true);
  await appearance.page.locator('[name="applyShared"]').uncheck();
  assert.equal(await appearance.page.locator('[name="scene0-Thickness"]').inputValue(),'2');
  await appearance.page.locator('[name="applyShared"]').check();
  await appearance.page.locator('[name="sharedPadding"]').fill('10');
  await appearance.page.locator('[name="sharedThickness"]').fill('3');
  await appearance.page.locator('[name="sharedOpacity"]').fill('0.65');
  await appearance.page.locator('[name="sharedColor"]').fill('#abcdef');
  await appearance.page.locator('button[type="submit"]').click();
  await appearance.page.waitForFunction(()=>!document.querySelector('form'));
  for(const scene of (await appearance.state()).scenes){
    assert.equal(scene.padding,0.1);assert.equal(scene.grid.thickness,3);
    assert.equal(scene.grid.alpha,0.65);assert.equal(scene.grid.color,'#abcdef');
    assert.equal(scene.grid.style,'solidLines');
  }
  assert.deepEqual(appearance.errors,[]);await appearance.page.close();
  console.log("JSON import, asset replacements, shared grid appearance/padding, cleanup, retry, and edits passed.");
} finally {await browser.close()}
