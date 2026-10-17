import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import Handlebars from 'handlebars';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:process.env.PNEUMA_BROWSER_CHANNEL});
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await page.route('https://types.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/')return route.fulfill({contentType:'text/html',body:'<body></body>'});
  try {await route.fulfill({contentType:path.endsWith('.svg')?'image/svg+xml':'text/javascript',body:await readFile(resolve('dist',path.replace(/^\/modules\/pneuma-scenetools\//,'')))});}catch{await route.fulfill({status:404,body:''});}
 });
 await page.goto('https://types.test/');
 const types=['computer','camera','turret','door','alarm','generic'].map(id=>({id,label:id[0].toUpperCase()+id.slice(1),img:`modules/pneuma-scenetools/assets/${id}.svg`,enabled:true}));
 const html=Handlebars.compile(await readFile('src/templates/type-manager.hbs','utf8'))({types});
 await page.evaluate(html=>document.body.innerHTML=`<section class="window-app pneuma-scanner pneuma-type-manager"><header>Manage Access Point Types</header><section class="window-content">${html}</section></section>`,html);
 // Foundry v12's notes rule is designed for wrapping row forms, not a column form.
 await page.addStyleTag({content:'body{font:14px Arial;background:#333}.pneuma-type-manager{display:flex;flex-direction:column;width:740px;height:640px;background:#eee;margin:20px}.window-content{display:flex;flex-direction:column;overflow:auto;flex:1;min-height:0}.window-content>*{flex:1}form .notes{flex:0 0 100%}input[type=text]{box-sizing:border-box;width:100%;height:30px}button{height:32px}'});
 await page.addStyleTag({content:await readFile('dist/styles/scanner.css','utf8')});
 await page.evaluate(async types=>{
  window.FormApplication=class{activateListeners(){} render(){}};
  window.game={user:{isGM:true},settings:{get:()=>({entries:types})}};
  window.foundry={utils:{randomID:()=> 'new'}};
  window.FilePicker=class{constructor(options){this.options=options}browse(){this.options.callback('modules/pneuma-scenetools/assets/turret.svg')}};
  const {APTypeManager}=await import('/modules/pneuma-scenetools/scripts/netarch/type-manager.js');
  window.manager=new APTypeManager();manager.activateListeners([document.querySelector('form')]);
 },types);
 assert.equal(await page.locator('.ap-type-preview').count(),6);
 const layout=await page.evaluate(()=>{
  const bounds=selector=>document.querySelector(selector).getBoundingClientRect();
  const notes=bounds('.notes'),head=bounds('.ap-type-head'),list=bounds('.ap-types-list'),footer=bounds('.ap-type-footer'),content=bounds('.window-content');
  return {notesHeight:notes.height,headTop:head.top,listHeight:list.height,footerBottom:footer.bottom,contentBottom:content.bottom,scroll:document.querySelector('.window-content').scrollTop};
 });
 assert.ok(layout.notesHeight<70,'Introduction must not consume the full form height');
 assert.ok(layout.listHeight>300,'All six type rows have room to display');
 assert.ok(layout.footerBottom<=layout.contentBottom+1,'Add and Save are visible without scrolling the window');assert.equal(layout.scroll,0);
 const row=page.locator('[data-type-row=camera]');
 await row.locator('[data-field=img]').fill('modules/pneuma-scenetools/assets/door.svg');
 assert.match(await row.locator('img').getAttribute('src'),/door.svg$/);
 await row.locator('button').click();assert.match(await row.locator('img').getAttribute('src'),/turret.svg$/);
 await page.evaluate(()=>manager.capture(document.querySelector('form')));
 assert.match(await page.evaluate(()=>manager.types[1].img),/turret.svg$/);
 await row.locator('[data-field=img]').fill('modules/pneuma-scenetools/assets/camera.svg');
 await page.screenshot({path:'docs/access-point-types-preview.png'});
 console.log('Access point type layout, preview updates and draft capture passed.');
} finally {await browser.close();}
