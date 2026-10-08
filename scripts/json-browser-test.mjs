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
    grid:{type:1,size:128,distance:2,units:"m",color:"#123456",alpha:0.4},
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
  assert.equal(await page.locator('[name="importMode"][value="json"]').isChecked(),true);
  await page.locator('button[type="submit"]').click();await page.locator('[data-plan="3"]').waitFor();
  assert.equal(await page.locator('[data-plan]').count(),4);
  assert.equal(await page.locator('[name="json-0"]').inputValue(),json(1));
  assert.equal(await page.locator('[name="json-1"]').inputValue(),json(2));
  await page.locator('[name="json-2"]').selectOption(json(1));
  await page.locator('[name="json-3"]').selectOption(json(2));
  await page.locator('[name="allVariants"]').check();
  await page.locator('button[type="submit"]').click();await page.locator('[data-scene="3"]').waitFor();
  const field=name=>page.locator(`[name="scene0-${name}"]`);
  assert.equal(await field("name").inputValue(),source(1).name);
  assert.equal(await field("width").inputValue(),"4000");assert.equal(await field("gridChoice").inputValue(),"128");
  assert.equal(await field("darkness").inputValue(),"0.65");assert.equal(await field("globalLight").isChecked(),false);
  assert.equal(await field("fogExploration").isChecked(),false);
  assert.equal(await field("name").isDisabled(),true);
  const markers=await page.locator('[data-scene="0"] canvas').evaluate(canvas=>{
    const ctx=canvas.getContext("2d");return [Array.from(ctx.getImageData(20,10,1,1).data),Array.from(ctx.getImageData(70,70,1,1).data)];
  });
  assert.deepEqual(markers,[[0,255,255,255],[255,187,68,255]]);
  await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>game.scenes.size===4);
  const nativeImports=await page.evaluate(()=>globalThis.nativeImports);
  for(let i=0;i<4;i++) assert.deepEqual(nativeImports[i],{...source(i%2+1),background:{...source(i%2+1).background,src:image(i+1)}});
  assert.equal((await state()).scenes[2].name,source(1).name);
  const migrationSources=await page.evaluate(()=>globalThis.importSources);
  assert.equal(migrationSources[0]._stats.coreVersion,"12.331");
  assert.equal(migrationSources[0].journal,"JournalOriginal1");
  // A failed native import retries the same destination document.
  await page.waitForFunction(()=>!document.querySelector('form'));
  await page.evaluate(()=>openCreator());await page.locator('[name="importMode"]').first().waitFor();
  await page.locator('button[type="submit"]').click();await page.locator('[name="variant-0"]').waitFor();
  await page.locator('button[type="submit"]').click();await field("name").waitFor();
  await page.evaluate(()=>globalThis.failNativeImport=true);
  await page.locator('button[type="submit"]').click();await page.locator('[data-error]').filter({hasText:"native import rejection"}).waitFor();
  assert.equal((await state()).scenes.length,5);
  await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('form'));
  assert.equal((await state()).scenes.length,5);assert.equal(await page.evaluate(()=>globalThis.creationAttempts),5);
  assert.deepEqual(errors,[]);await page.close();
  // Make changes starts with JSON values and retains fields outside the editable controls.
  const modified=await fixture(browser,{selected:image(1),files,imports});
  await modified.page.locator('[name="importMode"][value="edit"]').check();
  await modified.page.locator('button[type="submit"]').click();await modified.page.locator('[name="variant-0"]').waitFor();
  await modified.page.locator('button[type="submit"]').click();await modified.page.locator('[name="scene0-name"]').waitFor();
  await modified.page.locator('[name="scene0-name"]').fill("Adjusted Scene");
  await modified.page.locator('[name="scene0-darkness"]').fill("0.2");
  await modified.page.locator('[name="scene0-fogExploration"]').check();
  await modified.page.locator('button[type="submit"]').click();await modified.page.waitForFunction(()=>game.scenes.size===1);
  const edited=(await modified.state()).scenes[0];assert.equal(edited.name,"Adjusted Scene");assert.equal(edited.environment.darknessLevel,0.2);
  assert.deepEqual(edited.fog,{...source(1).fog,exploration:true});
  for(const key of ["walls","lights","tiles","tokens","sounds","notes","drawings","flags","journal","playlist","weather","foreground"])
    assert.deepEqual(edited[key],source(1)[key]);
  assert.deepEqual(modified.errors,[]);
  console.log("JSON-first import, four variants/two reusable JSONs, full payload preservation, JSON preview, native-import retry, and edits passed.");
} finally {await browser.close()}
