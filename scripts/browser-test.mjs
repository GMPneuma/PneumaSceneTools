import assert from "node:assert/strict";
import {fixture} from "./browser-fixture.mjs";
const {chromium}=await import(process.env.PNEUMA_PLAYWRIGHT_MODULE??"playwright");
const browser=await chromium.launch({headless:true,...(process.env.PNEUMA_BROWSER_CHANNEL?{channel:process.env.PNEUMA_BROWSER_CHANNEL}:{})});
try {
  const {page,errors,state}=await fixture(browser,{selected:"maps/map.svg",files:["maps/map.svg","maps/map-OVERLAY.svg"]});
  await page.locator('button[type="submit"]').click();
  const field=name=>page.locator(`[name="scene0-${name}"]`);
  await field("gridChoice").selectOption("custom");await field("customGrid").fill("10");
  await page.locator('button[type="submit"]').click();assert.equal((await state()).scenes.length,0);
  await field("customGrid").fill("150");await field("name").fill("Import regression");
  await field("foreground").selectOption("maps/map-OVERLAY.svg");
  await page.evaluate(()=>{globalThis.failCreation=true;globalThis.emptySerializedSubmission=true});
  await field("name").press("Enter");await page.locator('[data-error]').filter({hasText:"database rejection"}).waitFor();
  assert.equal((await state()).scenes.length,0);assert.equal(await field("name").inputValue(),"Import regression");
  await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>game.scenes.size===1);
  const saved=(await state()).scenes[0];
  assert.equal(saved.name,"Import regression");assert.equal(saved.grid.size,150);assert.equal(saved.foreground,"maps/map-OVERLAY.svg");
  assert.equal(saved.width,4000);assert.equal(saved.height,3000);assert.equal(saved.grid.distance,2);
  assert.deepEqual((await state()).folders,[{name:"SceneTools",parent:null},{name:"Imported Scenes",parent:"SceneTools"}]);
  await page.waitForFunction(()=>!document.querySelector('form'));
  // A returned document without a persisted collection entry is a failure, never success.
  await page.evaluate(()=>{globalThis.dropPersistence=true;openCreator()});
  await page.locator('[data-native-folder] [name="target"]').waitFor();
  await page.locator('[data-native-folder] [name="file"]').fill('maps/map.svg');
  await page.locator('[data-folder-next]:enabled').click();await page.locator('[name="variant-0"]').waitFor();
  await page.locator('button[type="submit"]').click();await field("name").waitFor();
  await page.locator('button[type="submit"]').click();await page.locator('[data-error]').filter({hasText:"did not confirm"}).waitFor();
  assert.equal((await state()).scenes.length,1);assert.deepEqual(errors,[]);
  console.log("Scene form contract: click/Enter, validation, foreground selection, rejected persistence, retry, and saved-document confirmation passed.");
} finally {await browser.close()}
