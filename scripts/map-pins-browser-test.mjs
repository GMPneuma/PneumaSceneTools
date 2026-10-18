import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:process.env.PNEUMA_BROWSER_CHANNEL});
try {
  const page=await browser.newPage({viewport:{width:1050,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://pins.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(['/original.svg','/first.svg','/second.svg','/icons/svg/book.svg'].includes(path))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="white"/></svg>'});
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<html><body></body></html>'});
    const relative=path.replace(/^\/modules\/pneuma-scenetools\//,'');
    await route.fulfill({contentType:relative.endsWith('.js')?'text/javascript':relative.endsWith('.svg')?'image/svg+xml':'text/plain',body:await readFile(resolve('dist',relative))});
  });
  await page.goto('https://pins.test/');
  await page.addScriptTag({content:await readFile('node_modules/handlebars/dist/handlebars.js','utf8')});
  await page.addStyleTag({content:await readFile('dist/styles/map-pins.css','utf8')});
  await page.addStyleTag({content:'.window-app .window-content > *{flex:1}body{font:14px system-ui;background:#15191e;color:#ddd}.dialog{width:700px;background:#282c32;padding:20px;margin:15px;border:1px solid #777;border-radius:5px}.form-group{display:flex;align-items:center;gap:12px;margin:10px 0}.form-group > label{min-width:0}.form-fields{display:flex;flex:1;min-width:0}.sheet-footer{display:flex}.sheet-footer button{flex:1}.window-app .window-content{background:#282c32;color:#ddd}input,select,button{background:#3c424b;color:#eee;border:1px solid #727b89;border-radius:3px;padding:5px}button{cursor:pointer}h3{border-bottom:1px solid #666;padding-bottom:5px}.pin-create>button{width:100%}.notes{font-size:12px;color:inherit}.pin-error{color:#ffb6b6!important}'});
  await page.evaluate(async()=>{
    const ID='pneuma-scenetools';
    class Collection extends Array {get(id){return this.find(x=>x.id===id)}has(id){return Boolean(this.get(id))}get contents(){return this}get size(){return this.length}}
    window.foundry={utils:{getProperty:(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj)}};
    window.CONST={JOURNAL_ENTRY_PAGE_FORMATS:{HTML:1},DOCUMENT_OWNERSHIP_LEVELS:{NONE:0,OBSERVER:2,INHERIT:-1}};
    window.CONFIG={JournalEntry:{noteIcons:{Original:'original.svg'}}};
    const makePage=(id,type)=>({id,type,name:id==='image'?'Image':'Description',src:'',text:{content:'<h2>Description</h2><p>Public location</p><section class="secret"><h2>Factions</h2><p>Hidden faction</p></section><h2>Factions</h2><p>Public faction</p>'},allowed:true,testUserPermission(){return this.allowed},toObject(){return {_id:this.id,type:this.type,name:this.name,src:this.src,text:this.text,sort:1,ownership:{default:3}}}});
    window.template={id:'template',name:'Custom locations',pages:new Collection(makePage('image','image'),makePage('description','text')),allowed:true,testUserPermission(){return this.allowed}};
    let defaults;let settings={journalId:'template',imagePageId:'image',descriptionPageId:'description',sections:'["Description","Factions"]'};
    window.FormApplication=class {};
    window.game={user:{id:'gm',isGM:true},journal:new Collection(template),folders:new Collection(),settings:{registerMenu(scope,key,data){window.pinMenu=data;},register(_scope,key,config){if(key==="pinDefaults")defaults=config.default},get(_scope,key){return key==="pinDefaults"?defaults:settings},async set(_scope,key,value){if(key==="pinDefaults")defaults=value;else settings=value}},scenes:new Collection()};
    window.Hooks={events:new Map(),on(name,callback){const list=this.events.get(name)??[];list.push(callback);this.events.set(name,list)},fire(name,...args){for(const cb of this.events.get(name)??[])cb(...args)}};
    window.Dialog=class {
      constructor(data,options){this.data=data;this.options=options;this.rendered=false;(window.dialogs??=[]).push(this)}
      render(){this.el=document.createElement('section');this.el.className='dialog';this.el.style.width=this.options.width+'px';this.el.innerHTML=`<h2>${this.data.title}</h2>${this.data.content}`;if(this.options.classes?.includes('pneuma-poi-icon-picker')){this.el.classList.add('window-app',...this.options.classes);this.el.style.height=this.options.height+'px';this.el.style.display='flex';this.el.style.flexDirection='column';this.el.innerHTML=`<h2>${this.data.title}</h2><section class="window-content" style="flex:1;min-height:0"><div class="dialog-content">${this.data.content}</div><div class="dialog-buttons"></div></section>`;}document.body.append(this.el);this.rendered=true;this.data.render?.([this.el]);return this}
      async close(){this.el?.remove();this.rendered=false;this.data.close?.()}
      bringToTop(){}
      static async confirm(){return false}
    };
    window.scene={id:'scene',name:'Night City',width:2000,height:1500,flags:{[ID]:{mapPinning:true}},notes:new Collection(),async createEmbeddedDocuments(){throw Error('Simulated pin write failure')}};
    game.scenes.push(scene);
    window.canvas={scene,stage:{pivot:{x:800,y:600}},notes:{activate(){}},animatePan:async()=>{}};
    window.ui={controls:{initialize(){}},notifications:{error:console.error,info(){}}};
    window.Folder={async create(data){const folder={...data,id:'folder-'+game.folders.length,folder:game.folders.get(data.folder)};game.folders.push(folder);return folder}};
    window.copied=0;window.deleted=0;
    window.JournalEntry={async create(data){copied++;const journal={...data,id:'copy',pages:new Collection(),async createEmbeddedDocuments(type,rows){const pages=rows.map((p,i)=>({...p,id:'copy-'+i}));this.pages.push(...pages);return pages;},async deleteEmbeddedDocuments(type,ids){deleted++;this.pages.splice(0,this.pages.length);}};game.journal.push(journal);return journal;}};
    window.TextEditor={async enrichHTML(content){return content}};
    const hbs=await (await fetch('/modules/pneuma-scenetools/templates/map-pins.hbs')).text();
    window.renderTemplate=async(path,data)=>Handlebars.compile(path.endsWith("map-pins.hbs")?hbs:await (await fetch("/"+path)).text())(data);
    window.FontConfig={getAvailableFontChoices:()=>({Signika:"Signika",Arial:"Arial"})};
    window.NoteDocument=class {
      constructor(data,{parent}){Object.assign(this,data);this.parent=parent;this.id=null;this.text??='';this.elevation??=0;this.sort??=0;}
      get entry(){return game.journal.get(this.entryId)}
      updateSource(data){for(const [path,value] of Object.entries(data)){const keys=path.split('.');let obj=this;for(const key of keys.slice(0,-1))obj=obj[key]??={};obj[keys.at(-1)]=value;}}
    };
    window.NoteConfig=class {
      constructor(object,options){this.object=object;this.options=options;this.position={width:options.width};this.data={title:options.title};(window.dialogs??=[]).push(this);}
      render(){
        this.el=document.createElement('section');this.el.className='dialog';this.el.style.width=this.options.width+'px';
        const n=this.object;
        this.el.innerHTML=`<form class="native-create"><div class="form-group"><label>Journal Entry</label><select name="entryId"><option value="${n.entryId}">${n.entry.name}</option></select></div><div class="form-group"><label>Page</label><select name="pageId"><option value="${n.pageId}">Page</option></select></div><div class="form-group"><label>Icon</label><select name="icon.selected"><option value="">Custom</option></select><input name="icon.custom" value="${n.texture.src}"></div><div class="form-group"><label>Text label</label><input name="text" value=""></div>`+
          ['x','y','elevation','sort','iconSize','fontSize'].map(key=>`<div class="form-group"><label>${key}</label><input type="number" name="${key}" value="${n[key]}"></div>`).join('')+
          `<input name="texture.tint" value="${n.texture.tint}"><select name="fontFamily"><option value="Signika">Signika</option></select><input name="textColor" value="${n.textColor}"><select name="textAnchor"><option value="1">Bottom</option><option value="2">Top</option></select><div class="form-group"><label>Globally Visible</label><input type="checkbox" name="global" checked></div><footer><button type="submit">Create</button></footer><p class="pin-error"></p></form>`;
        document.body.append(this.el);this.rendered=true;this.form=this.el.querySelector('form');this.activateListeners([this.el]);return this;
      }
      activateListeners(){this.form.addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(this.form));for(const field of this.form.querySelectorAll('input[type="checkbox"]'))data[field.name]=field.checked;data['texture.src']=data['icon.selected']||data['icon.custom'];void this._updateObject(event,data).then(()=>this.close()).catch(error=>{this.form.querySelector('.pin-error').textContent=error.message;});});}
      setPosition(){}
      async close(){this.el.remove();this.rendered=false;}
    };
    window.pins=await import('/modules/pneuma-scenetools/scripts/map-pins.js');
    window.hover=await import('/modules/pneuma-scenetools/scripts/map-pins-hover.js');
    pins.registerMapPins();
    const {groupFeatureSettings}=await import('/modules/pneuma-scenetools/scripts/settings-layout.js');
    const {groupRevealSettings}=await import('/modules/pneuma-scenetools/scripts/netarch/settings.js');
    for(const scannerFirst of [false,true]){
      const settingsForm=document.createElement('form');
      settingsForm.innerHTML='<div class="form-group"><button data-key="pneuma-scenetools.mapPinDefaultsMenu">Map POI Defaults</button></div><div class="form-group"><button data-key="pneuma-scenetools.manageTypes">Types</button></div><div class="form-group"><button data-key="pneuma-scenetools.skillClassificationsMenu">Skills</button></div>'+['defaultGrid','defaultDarkness','defaultGlobalLight','confirmPurgeGear','retainWeaponAmmunition','revealStyle','visionRadius','scannerRadius','showRevealAll','autoPulse','pulseCount','pulseDuration','autoScanner'].map(key=>`<div class="form-group"><input name="pneuma-scenetools.${key}" value="vision"></div>`).join('')+'<div class="form-group" id="other-module"><input name="other.setting"></div>';
      const original=settingsForm.querySelector('[name="pneuma-scenetools.defaultGrid"]');
      if(scannerFirst)groupRevealSettings(settingsForm);
      groupFeatureSettings(settingsForm);
      if(!scannerFirst)groupRevealSettings(settingsForm);
      groupFeatureSettings(settingsForm);
      const groups=[...settingsForm.querySelectorAll('.pneuma-feature-settings')];
      if(groups.map(g=>g.querySelector('legend').textContent).join('|')!=='Quick Scene Importer|Map POI|MookMaker|NetArch Scanner')throw Error('Wrong feature group order');
      if(!groups[0].contains(original)||!groups[1].querySelector('[data-key$="mapPinDefaultsMenu"]')||!groups[2].querySelector('[data-key$="skillClassificationsMenu"]')||!groups[3].querySelector('[data-key$="manageTypes"]'))throw Error('Setting/menu outside its feature');
      if(settingsForm.querySelector('.pneuma-ap-template-settings'))throw Error('Removed template restore control returned');
      if(settingsForm.querySelector('#other-module').closest('fieldset'))throw Error('Other module changed');
      if(new FormData(settingsForm).get('pneuma-scenetools.defaultGrid')!=='vision')throw Error('Form value lost');
    }
    const config=document.createElement('form');
    config.innerHTML='<nav class="tabs"><a data-tab="basic">Basics</a><a data-tab="grid">Grid</a><a data-tab="lighting">Lighting</a><a data-tab="ambience">Ambience</a></nav><div class="tab" data-tab="basic"><input name="name" value="Night City"></div><div class="tab" data-tab="grid"></div><footer><button type="submit">Save</button></footer>';
    document.body.append(config);
    const nav=config.querySelector('nav'),originalNav=nav.innerHTML,originalHeight=nav.getBoundingClientRect().height;
    Hooks.fire('renderSceneConfig',{object:scene},[config]);
    Hooks.fire('renderSceneConfig',{object:scene},[config]);
    if(nav.innerHTML!==originalNav || nav.getBoundingClientRect().height!==originalHeight)throw Error('Scene navigation changed');
    if(config.querySelectorAll('.tab[data-tab="basic"] > .pneuma-scene-pinning').length!==1)throw Error('Setting not in Basics content or duplicated');
    const checkbox=config.querySelector('[name="flags.pneuma-scenetools.mapPinning"]');
    if(!checkbox.checked || !new FormData(config).has(checkbox.name))throw Error('Enabled scene setting not in form');
    checkbox.checked=false;
    if(new FormData(config).has(checkbox.name))throw Error('Unchecked checkbox still submitted');
    config.remove();
    const unknown=document.createElement('form');unknown.innerHTML='<nav><a data-tab="basic">Basics</a></nav>';
    Hooks.fire('renderSceneConfig',{object:scene},[unknown]);
    if(unknown.querySelector('.pneuma-scene-pinning'))throw Error('Inserted into navigation when panel missing');
    const controls=[{name:'notes',tools:[]}];scene.flags[ID].mapPinning=false;Hooks.fire('getSceneControlButtons',controls);
    if(controls[0].tools.length)throw Error('Unmarked scene changed');
    scene.flags[ID].mapPinning=true;Hooks.fire('getSceneControlButtons',controls);
    if(controls[0].tools.length!==1)throw Error('Missing scoped control');
    if(!controls[0].tools[0].button || !controls[0].tools[0].onClick)throw Error('Manager must be a dialog button');
    if(Object.keys(CONFIG.JournalEntry.noteIcons).length!==1)throw Error('Native icons changed');
    let placement,noteDoubleClick;
    window.libWrapper={register(_module,path,callback){if(path==='NotesLayer.prototype._onClickLeft')placement=callback;else if(path==='Note.prototype._onClickLeft2')noteDoubleClick=callback;else throw Error('Wrong placement target');}};
    pins.installPinPlacement();
    let nativeCalls=0;
    const native=()=>nativeCalls++;
    ui.controls.activeTool='select';
    await placement(native,{interactionData:{origin:{x:91,y:92}}});
    if(nativeCalls!==1 || document.querySelector('.pin-create'))throw Error('Other tools must keep native behavior');
    ui.controls.activeTool='select';
    scene.flags[ID].mapPinning=false;
    await placement(native,{interactionData:{origin:{x:91,y:92}}});
    if(nativeCalls!==2)throw Error('Unmarked scene did not use native behavior');
    scene.flags[ID].mapPinning=true;
    game.activeTool='journal';canvas.grid={getCenterPoint:point=>({x:Math.floor(point.x/100)*100+50,y:Math.floor(point.y/100)*100+50})};
    await placement(native,{getLocalPosition:()=>({x:212,y:331})});
    if(nativeCalls!==2||!document.querySelector('.native-create .pneuma-pin-editor'))throw Error('Native Create Map Note did not open the POI form');
    if(document.querySelector('[name="x"]').value!=='250'||document.querySelector('[name="y"]').value!=='350')throw Error('Native centered placement changed');
    for(const dialog of dialogs)if(dialog.rendered)await dialog.close();
    scene.flags[ID].mapPinning=false;await placement(native,{getLocalPosition:()=>({x:1,y:2})});
    scene.flags[ID].mapPinning=true;game.user.isGM=false;await placement(native,{getLocalPosition:()=>({x:1,y:2})});game.user.isGM=true;
    if(nativeCalls!==4)throw Error('Native creation override leaked outside enabled GM scenes');
    nativeCalls=2;game.activeTool='select';
    let edits=0,stopped=0;
    const existing={visible:true,bounds:{contains:(x,y)=>x===91&&y===92},document:{parent:scene,sheet:{render(){edits++;}}}};
    canvas.notes.placeables=[existing];game.activeTool='journal';
    await placement(native,{interactionData:{origin:{x:91,y:92}},stopPropagation(){stopped++;}});
    if(document.querySelector('.native-create')||nativeCalls!==2)throw Error('Clicking an existing pin opened creation');
    canvas.notes.active=true;
    noteDoubleClick.call(existing,native,{stopPropagation(){stopped++;}});
    if(edits!==1||stopped!==2)throw Error('Double-click did not edit the existing pin');
    let journals=0;
    existing.document.pageId='linked-page';existing.document.entry={pages:new Map([['linked-page',{testUserPermission:()=>true}]]),sheet:{render(_force,options){if(options.pageId!=='linked-page')throw Error('Wrong journal page');journals++;}}};
    canvas.notes.active=false;canvas.tokens={active:true};
    for(const isGM of [true,false]){game.user.isGM=isGM;noteDoubleClick.call(existing,native,{stopPropagation(){}});}
    if(journals!==2||edits!==1)throw Error('Token layer double-click must open the journal for GM and player');
    canvas.notes.active=true;canvas.tokens.active=false;
    noteDoubleClick.call(existing,native,{stopPropagation(){}});
    if(edits!==1||journals!==2)throw Error('Player opened unauthorized Note configuration');
    game.user.isGM=true;
    scene.flags[ID].mapPinning=false;noteDoubleClick.call(existing,native,{});scene.flags[ID].mapPinning=true;
    if(edits!==1||nativeCalls!==3)throw Error('Double-click override changed unmarked-scene behavior');
    nativeCalls=2;canvas.notes.placeables=[];game.activeTool='select';

    await pins.openMapPins(scene);
    if(!document.querySelector('[data-action="place"]')||document.querySelector('[name="x"]'))throw Error('Manager must show defaults instead of creation');
    document.querySelector('[data-action="place"]').click();await new Promise(resolve=>setTimeout(resolve,0));
    await placement(native,{interactionData:{origin:{x:123.5,y:456.25}}});
    if(copied!==0)throw Error('Opening placement must not create a journal');
    if(document.querySelector('[name="x"]').value!=='124'||document.querySelector('[name="y"]').value!=='456')throw Error('Clicked canvas coordinates not filled in');
    for(const dialog of dialogs)if(dialog.rendered)await dialog.close();
    if(copied!==0)throw Error('Cancelled placement created a journal');
    await pins.openMapPins(scene);document.querySelector('[data-action="place"]').click();await new Promise(resolve=>setTimeout(resolve,0));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
    await placement(native,{interactionData:{origin:{x:1,y:2}}});
    if(nativeCalls!==3||document.querySelector('.pin-create'))throw Error('Escape did not cancel placement');
    await pins.openMapPins(scene);document.querySelector('[data-action="place"]').click();await new Promise(resolve=>setTimeout(resolve,0));
    await placement(native,{interactionData:{origin:{x:734,y:921}}});
    if(document.querySelector('[name="x"]').value!=='734'||document.querySelector('[name="y"]').value!=='921')throw Error('Next placement reused old coordinates');
  });
  assert.equal(await page.locator('.pin-icon').count(),61);
  assert.equal(await page.locator('.pin-icon-category[open]').count(),0);
  assert.equal(await page.locator('.pin-icon-folders').isVisible(),false);
  await page.locator('[data-action="choose-city-icon"]').click();
  assert.equal(await page.locator('.pin-icon-popup:visible').count(),1);
  assert.ok((await page.locator('.pneuma-poi-icon-picker').boundingBox()).height>=700);
  const pickerSpace=await page.locator('.pneuma-poi-icon-picker').evaluate(dialog=>{
    const content=dialog.querySelector('.window-content').getBoundingClientRect();
    const list=dialog.querySelector('.pin-icon-choices').getBoundingClientRect();
    return {gap:content.bottom-list.bottom,height:list.height};
  });
  assert.ok(pickerSpace.gap<4,'Icon list must reach the bottom of the window content');
  await page.locator('.pneuma-poi-icon-picker').evaluate(dialog=>dialog.style.height=(parseFloat(dialog.style.height)+100)+'px');
  assert.ok((await page.locator('.pin-icon-choices:visible').boundingBox()).height>=pickerSpace.height+98,'List grows with the picker');

  const search=page.getByRole('searchbox',{name:'Search POI icons'});
  await search.fill('street economy');
  assert.equal(await page.locator('.pin-icon:visible').count(),5);
  await search.fill('no-such-poi-icon');
  assert.equal(await page.locator('.pin-icon:visible').count(),0);
  assert.equal(await page.locator('.pin-icon-empty').isVisible(),true);
  await search.fill('');
  assert.equal(await page.locator('.pin-icon-empty').isVisible(),false);
  assert.equal(await page.locator('.pin-icon-category[open]').count(),0);

  const street=page.locator('.pin-icon-category').filter({has:page.locator('summary',{hasText:'Street economy'})});
  await street.locator('summary').click();
  assert.equal(await street.locator('.pin-icon:visible').count(),5);
  await street.locator('.pin-icon').filter({hasText:'Night'}).click();
  assert.equal(await page.locator('.pin-icon-folders').isVisible(),false);
  assert.match(await page.locator('.pin-icon-current img').getAttribute('src'),/city-icons/);
  assert.equal(await street.locator('.pin-icon:visible').count(),0);
  assert.equal(await street.locator('[aria-pressed="true"]').count(),1);
  await page.locator('[name="text"]').fill('Watson Night Market');
  await page.screenshot({path:'docs/map-pins-ui-preview.png',fullPage:true});
  await page.locator('.native-create [type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('.pin-error').textContent.includes('Simulated pin write failure'));
  assert.equal(await page.locator('[name="text"]').inputValue(),'Watson Night Market');
  assert.deepEqual(await page.evaluate(()=>({copied,deleted})),{copied:1,deleted:1});
  await page.evaluate(()=>pins.openPinTemplate());
  await page.locator('.pneuma-pin-template .pin-section-list input[value="Factions"]').check();
  assert.equal(await page.locator('.pneuma-pin-template select').count(),1,'Defaults only needs the template journal selector');
  await page.locator('.pin-create [type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('.pneuma-pin-template'));
  assert.deepEqual(JSON.parse(await page.evaluate(()=>game.settings.get().sections)),['Factions']);
  await page.evaluate(async()=>{
    for(const dialog of dialogs)if(dialog.rendered)await dialog.close();
    window.nativeOpened=0;
    game.users=[{id:'player',isGM:false}];
    window.permissionPage={ownership:{default:2},testUserPermission(user){return (this.ownership[user.id]??this.ownership.default)>=2},async update(changes){for(const [key,value] of Object.entries(changes))this.ownership[key.split('.')[1]]=value;}};
    scene.notes.push({id:'existing',parent:scene,pageId:'page',entry:{pages:new Map([['page',permissionPage]])},text:'Existing native pin',sheet:{render(){nativeOpened++}}});
    await pins.openMapPins(scene);
  });
  assert.equal(await page.locator('.pin-row').count(),1);
  await page.locator('.pin-row [data-action="permissions"]').click();
  await page.waitForFunction(()=>permissionPage.ownership.player===0);
  assert.equal(await page.locator('.pin-row [data-action="permissions"]').getAttribute('aria-label'),'Allow player read access');
  await page.locator('.pin-row [data-action="permissions"]').click();
  await page.waitForFunction(()=>permissionPage.ownership.player===2);
  assert.equal(await page.locator('.pin-row [data-action="permissions"]').getAttribute('aria-label'),'Remove player read access');
  await page.evaluate(async()=>{
    const wrappers=new Map();libWrapper.register=(_id,path,fn)=>wrappers.set(path,fn);
    window.$=element=>[element];
    window.ContextMenu=class {
      constructor(element,selector,items,options){this.element=element[0];this.items=items;this.options=options;this.element.addEventListener('contextmenu',()=>{window.pinContext=this;});}
      async close(){this.options.onClose();}
    };
    const {installPinContextMenu}=await import('/modules/pneuma-scenetools/scripts/map-pin-permissions.js');installPinContextMenu();
    if(wrappers.has('Note.prototype._onClickRight'))throw Error('Menu must not open on pointer-down');
    const rightClick=wrappers.get('Note.prototype._onUnclickRight');
    let native=0,stopped=0;
    const event={clientX:1040,clientY:940,stopPropagation(){stopped++;}};
    rightClick.call({document:scene.notes[0]},()=>native++,event);
    if(document.querySelector('.pneuma-pin-context'))throw Error('Menu opened before release events finished');
    document.body.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2}));
    await new Promise(resolve=>setTimeout(resolve,0));
    if(stopped!==1||native!==0||!pinContext)throw Error('Pin context menu did not open');
    document.body.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,button:2}));
    if(!document.querySelector('.pneuma-pin-context'))throw Error('Menu closed on release');
    let journals=0;scene.notes[0].entry.sheet={render(_force,options){if(options.pageId!=='page')throw Error('Wrong context journal page');journals++;}};
    pinContext.items.find(item=>item.name==='Open Journal').callback();
    if(journals!==1)throw Error('Context menu did not open journal');
    pinContext.items.find(item=>item.name==='Remove player read access').callback();await new Promise(resolve=>setTimeout(resolve,0));
    if(permissionPage.ownership.player!==0)throw Error('Context permission action failed');
    await pinContext.close();
    if(document.querySelector('.pneuma-pin-context'))throw Error('Context anchor leaked');
    game.user.isGM=false;rightClick.call({document:scene.notes[0]},()=>native++,event);game.user.isGM=true;
    if(native!==1)throw Error('Player native right-click was intercepted');
    permissionPage.ownership.default=2;permissionPage.ownership.player=2;
    game.user.isGM=false;
    const canHUD=wrappers.get('Note.prototype._canHUD');
    if(!canHUD.call({document:scene.notes[0],visible:true},()=>false))throw Error('Readable player pin cannot receive right-click');
    if(canHUD.call({document:scene.notes[0],visible:false},()=>false))throw Error('Hidden pin received right-click permission');
    rightClick.call({document:scene.notes[0]},()=>native++,event);
    await new Promise(resolve=>setTimeout(resolve,0));
    const readable=pinContext.items.filter(item=>item.condition);
    if(readable.length!==1||readable[0].name!=='Open Journal')throw Error('Player context actions incorrect');
    readable[0].callback();if(journals!==2)throw Error('Player journal action failed');
    permissionPage.ownership.default=0;permissionPage.ownership.player=0;
    readable[0].callback();if(journals!==2)throw Error('Journal action did not recheck permissions');
    await pinContext.close();game.user.isGM=true;
  });
  await page.evaluate(()=>{
    window.bulkUpdates=[];
    scene.updateEmbeddedDocuments=async(type,updates)=>{if(type!=="Note")throw Error('Wrong batch type');bulkUpdates.push(updates);return updates.map(update=>({id:update._id}));};
  });
  assert.equal(await page.locator('[data-action="bulk-style"]').isDisabled(),true);
  await page.locator('[data-select-all]').check();
  assert.equal(await page.locator('.pin-select').isChecked(),true);
  await page.locator('[data-action="bulk-style"]').click();
  await page.locator('.pin-bulk-style').waitFor();
  assert.equal(await page.locator('.pin-bulk-style .pin-icon-picker').count(),0);
  assert.deepEqual(await page.locator('.pin-bulk-targets li').allTextContents(),['Existing native pin']);
  const targetsBox=await page.locator('.pin-bulk-targets').boundingBox(),controlsBox=await page.locator('.pin-bulk-controls').boundingBox();
  assert.ok(targetsBox.x<controlsBox.x);assert.ok(Math.abs(targetsBox.y-controlsBox.y)<2);
  await page.locator('.pin-bulk-style').screenshot({path:'docs/map-pins-bulk-preview.png'});
  await page.locator('.pin-bulk-style [name="size"]').fill('64');
  await page.locator('.pin-bulk-style [name="hover"]').selectOption('false');
  await page.locator('.pin-bulk-style [type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('.pin-bulk-style'));
  assert.deepEqual(await page.evaluate(()=>bulkUpdates),[[{_id:'existing',iconSize:64,'flags.pneuma-scenetools.mapPin.hover':false}]]);
  await page.locator('.pin-select').uncheck();
  assert.equal(await page.locator('[data-select-all]').isChecked(),false);
  assert.equal(await page.locator('[data-action="bulk-style"]').isDisabled(),true);
  await page.screenshot({path:'docs/map-pins-manager-preview.png',fullPage:true});
  await page.locator('.pin-row [data-action="edit"]').click();
  assert.equal(await page.evaluate(()=>nativeOpened),1);
  assert.equal(await page.locator('.pin-create').count(),0);
  await page.locator('[data-action="defaults"]').click();
  await page.waitForSelector('[name="size"]');
  assert.equal(await page.locator('.pin-create .pin-icon-folders').count(),0);
  assert.equal(await page.locator('.pin-create').evaluate(form=>form.closest('.dialog').style.width),'560px');
  await page.locator('[data-pin-color="tint"]').fill('#123456');
  assert.equal(await page.locator('[name="tint"]').inputValue(),'#123456');
  await page.locator('.pin-create').evaluate(form=>form.closest('.dialog').scrollIntoView());
  await page.locator('.pin-create').screenshot({path:'docs/map-poi-defaults-preview.png'});
  await page.locator('[name="size"]').fill('64');
  await page.locator('[name="tint"]').fill('#00ff88');
  await page.locator('[name="fontSize"]').fill('28');
  await page.locator('[name="textColor"]').fill('#ffcc00');
  await page.locator('[name="textAnchor"]').selectOption('2');
  await page.locator('.pin-create [type="submit"]').click();
  await page.waitForFunction(()=>game.settings.get('', 'pinDefaults').size===64);
  assert.equal(await page.evaluate(()=>game.settings.get('', 'pinDefaults').tint),'#00ff88');
  await page.waitForFunction(()=>document.querySelector('[data-action="place"]'));
  await page.locator('[data-action="place"]').click();
  await page.evaluate(async()=>{await pins.openMapPins(scene,undefined,{x:3,y:4})});
  assert.equal(await page.locator('[data-visual-field="iconSize"]').inputValue(),'64');
  assert.equal(await page.locator('[data-visual-field="texture.tint"]').inputValue(),'#00ff88');
  await page.evaluate(async()=>{for(const dialog of dialogs)if(dialog.rendered)await dialog.close()});
  await page.evaluate(async()=>{
    if(!pinMenu.restricted)throw Error('Settings menu must be GM restricted');
    if('icon' in game.settings.get('', 'pinDefaults'))throw Error('Icon was saved as a default');
    const native={parent:scene,x:2.6,y:3.1,flags:{},updates:[],updateSource(data){this.updates.push(data)}};
    Hooks.fire('preCreateNote',native);
    if(native.updates[0].iconSize!==64||native.updates[0]['texture.tint']!=='#00ff88'||native.updates[0].fontSize!==28||native.updates[0].textColor!=='#ffcc00')throw Error('Native creation did not inherit visual defaults');
    if('texture.src' in native.updates[0])throw Error('Native icon was replaced');
    native.parent={flags:{}};native.updates=[];Hooks.fire('preCreateNote',native);if(native.updates.length)throw Error('Unmarked scene changed');
    native.parent=scene;native.flags={'pneuma-scenetools':{mapPin:{hover:true}}};Hooks.fire('preCreateNote',native);
    if(native.updates.some(update=>'fontSize' in update))throw Error('Explicit form choices overwritten');
    const saved=canvas.scene;canvas.scene=null;
    new pinMenu.type().render(true);await new Promise(resolve=>setTimeout(resolve,0));
    if(!document.querySelector('[name="size"]')||document.querySelector('.pin-row'))throw Error('Defaults require an active scene');
    canvas.scene=saved;
  });
  assert.equal(await page.locator('[name="size"]').inputValue(),'64');
  await page.evaluate(async()=>{for(const dialog of dialogs)if(dialog.rendered)await dialog.close()});
  await page.evaluate(()=>{
    window.Tabs=class {
      constructor(options){this.options=options}
      bind(root){this.root=root;root.querySelector(this.options.navSelector).querySelectorAll('[data-tab]').forEach(a=>a.addEventListener('click',()=>this.activate(a.dataset.tab,true)));this.activate(this.options.initial)}
      activate(tab,callback=false){this.root.querySelectorAll('.pneuma-pin-tabs [data-tab],.pneuma-pin-tab-content > .tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));if(callback)this.options.callback?.(null,this,tab)}
    };
    window.colorAssignments=0;
    if(!customElements.get('color-picker'))customElements.define('color-picker',class extends HTMLElement {
      constructor(){super();this.current=this.getAttribute('value')||'#ffffff'}
      get value(){return this.current}
      set value(value){
        if(++colorAssignments>100)throw Error('Native color-picker synchronization loop');
        this.current=value;
        this.dispatchEvent(new Event('input',{bubbles:true}));
        this.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    window.noteForm=document.createElement('form');noteForm.className='dialog';
    noteForm.innerHTML='<div class="form-group"><label>Journal</label><select name="entryId"><option value="template">Template</option><option value="">None</option></select></div><div class="form-group"><label>Page</label><select name="pageId"><option value="description">Description</option></select></div><div class="form-group"><label>Globally Visible</label><input type="checkbox" name="global" checked></div><div class="form-group"><label>Icon</label><select name="icon.selected"><option value="original.svg">Original</option><option value="">Custom</option></select></div><input name="icon.custom" value="" disabled><div class="form-group"><label>Text label</label><input name="text" value="Existing native pin"></div><div class="form-group"><label>X coordinate</label><input type="number" name="x" value="100"></div><div class="form-group"><label>Y coordinate</label><input type="number" name="y" value="200"></div><input name="iconSize" value="40"><color-picker name="texture.tint" value="#ffffff"></color-picker><select name="fontFamily"><option value="Signika">Signika</option></select><input name="fontSize" value="12"><color-picker name="textColor" value="#000000"></color-picker><select name="textAnchor"><option value="1">Bottom</option><option value="2">Top</option></select><button type="submit">Save native note</button>';
    document.body.append(noteForm);
    window.nativeNoteHTML=noteForm.innerHTML;
    window.resizeCalls=[];window.noteApp={object:{id:'native',parent:scene,entry:template,texture:{src:'original.svg'},flags:{}},position:{width:400},setPosition(position){resizeCalls.push(position);}};
    window.nativeField=noteForm.querySelector('[name="text"]');
    window.nativeEvents=0;nativeField.addEventListener('change',()=>nativeEvents++);
    Hooks.fire('renderNoteConfig',noteApp,[noteForm]);Hooks.fire('renderNoteConfig',noteApp,[noteForm]);
    if(noteForm.querySelector('.pneuma-pin-tabs')||noteForm.querySelectorAll('.pneuma-pin-editor').length!==1)throw Error('Editor duplicated or still tabbed');
    if(noteForm.querySelector('[name="text"]')!==nativeField)throw Error('Native field replaced');
    if(!noteForm.querySelector('.pin-icon-config').contains(nativeField))throw Error('Text label not moved under Icon');
    if(noteForm.querySelector('.pneuma-pin-editor').contains(noteForm.querySelector('[type="submit"]')))throw Error('Native save footer moved into editor');
    nativeField.dispatchEvent(new Event('change'));if(nativeEvents!==1)throw Error('Native listener lost');
  });
  assert.equal(await page.locator('.pneuma-pin-hover-config:visible').count(),1);
  await page.locator('.pin-section-list input[value="Factions"]').uncheck();
  await page.locator('[name="text"]').fill('Unsaved POI name');
  await page.evaluate(()=>{const page=template.pages.get('description');page.text.content+='<h3>New heading</h3><p>New details</p>';Hooks.fire('updateJournalEntryPage',{id:page.id,parent:template});});
  assert.equal(await page.locator('.pin-section-list input[value="New heading"]').count(),1);
  assert.equal(await page.locator('.pin-section-list input[value="New heading"]').isChecked(),false);
  assert.equal(await page.locator('.pin-section-list input[value="Factions"]').isChecked(),false);
  assert.equal(await page.locator('[name="text"]').inputValue(),'Unsaved POI name');
  await page.locator('.pin-section-list input[value="New heading"]').check();
  await page.evaluate(()=>{Hooks.fire('updateJournalEntryPage',{id:'unrelated',parent:template});});
  assert.equal(await page.locator('.pin-section-list input[value="New heading"]').isChecked(),true);
  await page.evaluate(()=>{const page=template.pages.get('description');page.text.content=page.text.content.replace('<h3>New heading</h3><p>New details</p>','');Hooks.fire('updateJournalEntryPage',{id:page.id,parent:template});});
  assert.equal(await page.locator('.pin-section-list input[value="New heading"]').count(),0);
  await page.locator('[name="text"]').fill('Existing native pin');
  await page.locator('.pin-section-list input[value="Factions"]').check();

  assert.equal(await page.locator('.pneuma-pin-hover-config fieldset').count(),0);
  assert.equal(await page.locator('.pin-section-list input[value="Image"]').count(),0);
  const shortHeight=await page.locator('form.pneuma-poi-form').evaluate(form=>form.getBoundingClientRect().height);
  await page.evaluate(()=>window.resizeCalls=[]);
  await page.locator('[data-visual-field="iconSize"]').fill('1000');
  await page.waitForFunction(()=>resizeCalls.some(position=>position.height==='auto'));
  assert.ok(await page.locator('form.pneuma-poi-form').evaluate(form=>form.getBoundingClientRect().height)>shortHeight);
  await page.locator('form.pneuma-poi-form').evaluate(form=>form.style.height='600px');
  assert.ok(await page.locator('form.pneuma-poi-form').evaluate(form=>{const submit=form.querySelector('[type="submit"]').getBoundingClientRect();const bounds=form.getBoundingClientRect();return submit.bottom<=bounds.bottom && form.querySelector('.pneuma-pin-editor').scrollHeight>form.querySelector('.pneuma-pin-editor').clientHeight;}));
  await page.locator('form.pneuma-poi-form').evaluate(form=>form.style.removeProperty('height'));
  await page.locator('[data-visual-field="iconSize"]').fill('40');

  assert.equal(await page.locator('[name="iconSize"]:visible').count(),0);
  assert.equal(await page.locator('[data-visual-field="iconSize"]:visible').count(),1);
  await page.locator('[data-visual-field="iconSize"]').fill('76');
  assert.equal(await page.locator('[name="iconSize"]').inputValue(),'76');
  await page.locator('[data-visual-field="textColor"]').fill('#00aaff');
  assert.equal(await page.evaluate(()=>document.querySelector('[name="textColor"]').value),'#00aaff');
  assert.equal(await page.locator('.pin-visual-config [data-action="visual-defaults"]').count(),1);
  await page.locator('[data-action="visual-defaults"]').click();
  assert.equal(await page.locator('[data-visual-field="iconSize"]').inputValue(),'64');
  assert.equal(await page.locator('[data-visual-field="textColor"]').inputValue(),'#ffcc00');
  assert.equal(await page.locator('.pin-visual-controls [name]').count(),0);
  assert.equal(await page.locator('[name="iconSize"]').inputValue(),'64');
  assert.equal(await page.evaluate(()=>document.querySelector('[name="texture.tint"]').value),'#00ff88');
  assert.equal(await page.locator('[name="fontSize"]').inputValue(),'28');
  assert.equal(await page.evaluate(()=>document.querySelector('[name="textColor"]').value),'#ffcc00');
  await page.evaluate(()=>{document.querySelector('[name="texture.tint"]').value='#112233';});
  assert.equal(await page.locator('[data-visual-field="texture.tint"]').inputValue(),'#112233');
  for(let i=0;i<5;i++)await page.locator('[data-action="visual-defaults"]').click();
  assert.ok(await page.evaluate(()=>colorAssignments<25),'Color synchronization must settle without recursion');
  assert.equal(await page.locator('.pin-visual-controls color-picker').count(),0);
  assert.equal(await page.locator('[name="textAnchor"]').inputValue(),'2');
  assert.equal(await page.locator('[data-action="visual-defaults"]').textContent(),'Load defaults');
  const loadBox=await page.locator('[data-action="visual-defaults"]').boundingBox();
  const applyBox=await page.locator('[data-action="visual-apply"]').boundingBox();
  assert.ok(loadBox.x+loadBox.width<=applyBox.x);
  await page.evaluate(()=>{
    window.appearanceWrites=[];
    noteApp.object.update=async changes=>{
      appearanceWrites.push(changes);
      if(window.cancelAppearance)return;
      for(const [path,value] of Object.entries(changes)){
        const parts=path.split('.');let target=noteApp.object;
        for(const part of parts.slice(0,-1))target=target[part]??=( {} );
        target[parts.at(-1)]=value;
      }
    };
  });
  await page.locator('[data-action="visual-defaults"]').click();
  assert.equal(await page.evaluate(()=>appearanceWrites.length),0);
  await page.locator('[data-visual-field="iconSize"]').fill('80');
  await page.locator('[data-action="visual-apply"]').click();
  await page.locator('.pin-visual-status').filter({hasText:'Appearance applied.'}).waitFor();
  assert.equal(await page.evaluate(()=>noteApp.object.iconSize),80);
  assert.deepEqual(await page.evaluate(()=>Object.keys(appearanceWrites[0]).sort()),['fontFamily','fontSize','iconSize','textAnchor','textColor','texture.tint'].sort());
  await page.evaluate(()=>window.cancelAppearance=true);
  await page.locator('[data-visual-field="iconSize"]').fill('96');
  await page.locator('[data-action="visual-apply"]').click();
  await page.locator('.pin-visual-status').filter({hasText:'did not save'}).waitFor();
  assert.equal(await page.evaluate(()=>noteApp.object.iconSize),80);
  await page.locator('[data-action="visual-defaults"]').click();
  assert.equal(await page.locator('.pin-icon-folders').isVisible(),false);
  await page.locator('[data-action="choose-city-icon"]').click();
  assert.equal(await page.locator('.pin-icon-popup:visible').count(),1);
  const services=page.locator('.pin-icon-category').filter({has:page.locator('summary',{hasText:'Services'})});
  await services.locator('summary').click();
  await services.locator('.pin-icon').first().click();
  assert.match(await page.locator('[name="icon.custom"]').inputValue(),/city-icons/);
  assert.equal(await page.locator('[name="icon.selected"]').inputValue(),'');
  await page.locator('[name="flags.pneuma-scenetools.mapPin.imagePageId"]').selectOption('image');
  await page.locator('[name="flags.pneuma-scenetools.mapPin.descriptionPageId"]').selectOption('description');
  await page.locator('.pin-section-list input[value="Factions"]').uncheck();
  assert.equal(await page.locator('[name="flags.pneuma-scenetools.mapPin.sections"]').inputValue(),'[]');
  await page.locator('.pin-section-list input[value="Factions"]').check();
  assert.equal(await page.locator('.pin-coordinates input').count(),2);
  assert.deepEqual(await page.locator('.pin-icon-config [name]').evaluateAll(fields=>fields.map(field=>field.name)),['icon.custom','text','entryId','pageId']);
  assert.equal(await page.locator('.pin-global-visibility > label').evaluate(label=>getComputedStyle(label).whiteSpace),'nowrap');
  assert.equal(await page.locator('.pin-visual-preview canvas').evaluate(canvas=>canvas.style.width),'32px');
  assert.equal(await page.locator('.pin-visual-preview span').evaluate(label=>label.style.fontSize),'14px');
  const iconBox=await page.locator('.pin-icon-config').boundingBox(),locationBox=await page.locator('.pin-location-config').boundingBox();
  assert.ok(iconBox.x<locationBox.x);assert.ok(Math.abs(iconBox.y-locationBox.y)<2);
  await page.screenshot({path:'docs/map-pins-native-tab-preview.png',fullPage:true});
  await page.locator('[data-action="choose-city-icon"]').click();
  for(const light of [true,false]){
    await page.evaluate(light=>{
      document.getElementById('theme-check')?.remove();
      const style=document.createElement('style');style.id='theme-check';
      style.textContent=light?'.dialog{background:#ccc;color:#222}input,select,button{background:#fff;color:#222}':'.dialog{background:#25282d;color:#eee}input,select,button{background:#353a40;color:#eee}';
      document.head.append(style);
    },light);
    const colors=await page.locator('.pin-icon-category[open] .pin-icon').first().evaluate(button=>{
      const glyph=button.querySelector('.pin-icon-glyph');return {text:getComputedStyle(button).color,icon:getComputedStyle(glyph).backgroundColor,mask:getComputedStyle(glyph).maskImage,folder:getComputedStyle(button.closest('.pin-icon-folders')).backgroundColor};
    });
    const current=await page.locator('.pin-current-glyph').evaluate(glyph=>({color:getComputedStyle(glyph).color,paint:getComputedStyle(glyph).backgroundColor,mask:getComputedStyle(glyph).maskImage}));
    assert.equal(current.paint,current.color);assert.notEqual(current.mask,'none');
    assert.equal(colors.icon,colors.text);assert.notEqual(colors.mask,'none');assert.equal(colors.folder,'rgba(0, 0, 0, 0)');
    await page.screenshot({path:light?'docs/map-poi-light-preview.png':'docs/map-poi-dark-preview.png',fullPage:true});
  }
  await page.evaluate(async()=>{document.getElementById('theme-check')?.remove();for(const dialog of dialogs)if(dialog.rendered&&dialog.data.title==='Choose POI icon')await dialog.close();});
  await page.evaluate(async()=>{
    const data=new FormData(noteForm);
    if(data.get('text')!=='Existing native pin'||data.get('flags.pneuma-scenetools.mapPin.descriptionPageId')!=='description')throw Error('Combined native and special form data missing');
    const entry=noteForm.querySelector('[name="entryId"]');entry.value='';entry.dispatchEvent(new Event('change'));
    if(noteForm.querySelector('[name="flags.pneuma-scenetools.mapPin.imagePageId"]').value!=='')throw Error('Stale mapping after journal change');
    const draftForm=document.createElement('form');draftForm.innerHTML=nativeNoteHTML;
    const draft={...noteApp.object,id:null,updateSource(data){this.source=data}};
    Hooks.fire('renderNoteConfig',{object:draft,position:{width:400},setPosition(){}},[draftForm]);
    if(draftForm.querySelector('[name="fontSize"]').value!=='28'||draft.source.iconSize!==64)throw Error('Native new-pin editor did not inherit defaults');
    noteForm.remove();
    const {addPinJournalButton}=await import('/modules/pneuma-scenetools/scripts/map-pin-journal.js');
    const journalPage={flags:{'pneuma-scenetools':{poi:true}},testUserPermission:()=>true};
    const journalRoot=document.createElement('section');journalRoot.className='journal-entry-page';journalRoot.innerHTML='<h2>Location</h2><div class="journal-page-content">Description</div>';
    addPinJournalButton(journalPage,journalRoot);addPinJournalButton(journalPage,journalRoot.querySelector('.journal-page-content'));
    if(journalRoot.querySelectorAll('.pneuma-pin-journal-action').length!==1||!journalRoot.firstElementChild.classList.contains('pneuma-pin-journal-action'))throw Error('Journal pan button must appear once at the top');
    if(journalRoot.querySelector('button').textContent.trim()!=='Pan to Note')throw Error('Journal pan label mismatch');
    const cleanup=await import('/modules/pneuma-scenetools/scripts/map-pin-template-cleanup.js');
    const oldTemplate='<h2>Description</h2><p>Custom description</p><section class="secret"><h2>GM notes</h2><p>Old note</p></section><h2>Services</h2><p>Custom services</p>';
    const expected='<h2>Description</h2><p>Custom description</p><h2>Services</h2><p>Custom services</p>';
    if(cleanup.removeTemplateGMNotes(oldTemplate)!==expected)throw Error('Template cleanup lost unrelated edits');
    if(cleanup.removeTemplateGMNotes(expected)!==expected)throw Error('Template cleanup is not idempotent');
    if(cleanup.removeTemplateGMNotes('<h2>GM Notes</h2><p>Remove</p><h2>Services</h2><p>Keep</p>')!=='<h2>Services</h2><p>Keep</p>')throw Error('Unwrapped GM Notes cleanup failed');
    let writes=0;
    const legacyPage={type:'text',text:{content:oldTemplate},async update(data){writes++;this.text=data.text;return this;}};
    const legacy={id:'legacy-template',flags:{'pneuma-scenetools':{pinTemplate:true}},pages:[legacyPage]};
    game.user.isGM=false;await cleanup.cleanDefaultPinTemplate(legacy);
    if(writes)throw Error('Player migrated a template');
    game.user.isGM=true;await cleanup.cleanDefaultPinTemplate({...legacy,flags:{}});
    if(writes)throw Error('Custom journal migrated');
    await cleanup.cleanDefaultPinTemplate(legacy);await cleanup.cleanDefaultPinTemplate(legacy);
    if(writes!==1||legacyPage.text.content!==expected)throw Error('Default template migration failed');
    for(const gm of [true,false]){
      game.user.isGM=gm;scene.flags['pneuma-scenetools'].mapPinning=!gm;
      const form=document.createElement('form');form.innerHTML='<input name="text"><button type="submit">Save</button>';
      Hooks.fire('renderNoteConfig',noteApp,[form]);if(form.querySelector('.pneuma-pin-editor'))throw Error('Editor leaked outside GM/enabled scene');
    }
    game.user.isGM=true;scene.flags['pneuma-scenetools'].mapPinning=true;
    if(copied!==1)throw Error('Manager or native edits created a journal');
  });
  const states=await page.evaluate(async()=>{
    const ID='pneuma-scenetools';
    game.user.isGM=false;
    const note={document:{parent:scene,entry:template,text:'Location',flags:{[ID]:{mapPin:{imagePageId:'image',descriptionPageId:'description',sections:'["Factions"]',hover:true}}}}};
    await hover.showPinHover(note);
    const publicText=document.querySelector('.pneuma-pin-hover')?.textContent;
    template.allowed=false;await hover.showPinHover(note);const noJournal=!document.querySelector('.pneuma-pin-hover');
    template.allowed=true;template.pages.get('description').allowed=false;template.pages.get('image').allowed=false;
    await hover.showPinHover(note);const noPages=!document.querySelector('.pneuma-pin-hover');
    template.pages.get('description').allowed=true;
    let finish;TextEditor.enrichHTML=()=>new Promise(resolve=>{finish=resolve});
    const pending=hover.showPinHover(note);hover.hidePinHover();finish('Late content');await pending;
    const noLate=!document.querySelector('.pneuma-pin-hover');
    TextEditor.enrichHTML=async content=>content;
    game.user.isGM=true;await hover.showPinHover(note);
    const gmText=document.querySelector('.pneuma-pin-hover')?.textContent;
    scene.flags[ID].mapPinning=false;await hover.showPinHover(note);const disabled=!document.querySelector('.pneuma-pin-hover');
    return {publicText,noJournal,noPages,noLate,gmText,disabled};
  });
  assert.match(states.publicText,/Public faction/);assert.match(states.publicText,/Public location/);assert.doesNotMatch(states.publicText,/Hidden faction/);
  assert.match(states.gmText,/Hidden faction/);
  assert.ok(states.noJournal&&states.noPages&&states.noLate&&states.disabled);
  const layout=await page.evaluate(async()=>{
    for(const gm of [true,false]){
      const fields=hover.parseHoverPage('<h2>Description</h2><p>Main</p><h2>GM notes</h2><p>Private</p><h2>Services</h2><p>Shop</p>',gm);
      if(fields.some(field=>field.name==='GM notes'||field.html.includes('Private')))throw Error('GM notes remains in hover fields');
      if(fields.length!==2)throw Error('Removing GM notes affected other fields');
    }
    const parsed=hover.parseHoverPage('<h2>Description</h2><p>Main</p><h3>Details</h3><p>Nested detail</p><h2>NPC, Contact</h2><p>Rogue</p>',false);
    if(parsed.length!==3||parsed[1].name!=='Details'||!parsed[1].html.includes('Nested detail')||parsed[2].name!=='NPC, Contact')throw Error('Mixed heading levels lost fields');
    if(hover.selectedHoverFields('["NPC, Contact"]')[0]!=='NPC, Contact')throw Error('Comma in section name lost');
    scene.flags['pneuma-scenetools'].mapPinning=true;game.user.isGM=false;
    template.pages.get('description').allowed=true;template.pages.get('image').allowed=true;
    template.pages.get('image').src='modules/pneuma-scenetools/assets/city-icons/nightclub.svg';
    template.pages.get('description').text.content='<h2>Description</h2><p>A converted power station beneath the elevated rail line. The main floor is crowded with scavengers trading salvage and information.</p><p>Behind the bar, a shuttered freight lift leads to the lower levels. Its controls are still powered.</p><h2>Faction</h2><p>The Mox</p><h2>NPC</h2><p>Vera — bartender and information broker.</p><h2>Plot Point</h2><p>A missing courier was last seen entering the freight lift.</p><h2>Hidden Field</h2><p>Unselected content.</p><section class="secret"><h2>Secret</h2><p>Do not show.</p></section>';
    const info={imagePageId:'image',descriptionPageId:'description',sections:JSON.stringify(['Faction','NPC','Plot Point']),hover:true};
    window.layoutNote={document:{parent:scene,entry:template,text:'The Switchyard',flags:{'pneuma-scenetools':{mapPin:info}}}};
    await hover.showPinHover(layoutNote);
    const card=document.querySelector('.pneuma-pin-hover');
    const image=card.querySelector('.pin-hover-top > img'),fields=card.querySelector('.pin-hover-fields'),description=card.querySelector('.pin-hover-description');
    const result={labels:[...fields.querySelectorAll('dt')].map(el=>el.textContent),description:description.textContent,text:card.textContent,imageLeft:image.getBoundingClientRect().left<fields.getBoundingClientRect().left,bottom:description.getBoundingClientRect().top>=fields.getBoundingClientRect().bottom};
    return result;
  });
  assert.deepEqual(layout.labels,['Faction','NPC','Plot Point']);
  assert.match(layout.description,/Its controls are still powered/);
  assert.doesNotMatch(layout.text,/Unselected content|Do not show/);
  assert.ok(layout.imageLeft&&layout.bottom);
  await page.evaluate(async()=>{
    const native=document.createElement('aside');native.id='players';native.style.cssText='background:rgba(0,0,0,0.5);color:rgb(240,240,224);border:1px solid black;border-radius:5px;';document.body.append(native);
    // Re-render the same hovered note with the native panel available.
    const note={document:{parent:scene,entry:template,text:'Native surface',flags:{'pneuma-scenetools':{mapPin:{hover:true,imagePageId:'image',descriptionPageId:'description',sections:''}}}}};
    await hover.showPinHover(note);
    const card=document.querySelector('.pneuma-pin-hover'),body=card.querySelector('.window-content');
    if(!card.style.backgroundColor.includes('color-mix'))throw Error('Hover readability background missing');
    if(getComputedStyle(body).opacity!=='1'||getComputedStyle(body).backgroundColor!=='rgba(0, 0, 0, 0)')throw Error('Hover content opacity/background incorrect');
    native.remove();
  });
  await page.screenshot({path:'docs/map-pin-crafted-hover-preview.png',fullPage:true});
  const long=await page.evaluate(async()=>{
    const info=layoutNote.document.flags['pneuma-scenetools'].mapPin;info.sections='[]';
    template.pages.get('description').text.content='<h2>Description</h2>'+Array.from({length:80},(_,i)=>'<p>Full paragraph '+i+'</p>').join('')+'<h2>NPC</h2><p>Excluded</p>';
    await hover.showPinHover(layoutNote);
    const card=document.querySelector('.pneuma-pin-hover');card.scrollTop=card.scrollHeight;
    const result={noFields:!card.querySelector('.pin-hover-fields'),full:card.textContent.includes('Full paragraph 79'),scrollable:card.scrollHeight>card.clientHeight&&card.scrollTop>0};
    Hooks.fire('hoverNote',layoutNote,false);card.dispatchEvent(new PointerEvent('pointerenter'));
    await new Promise(resolve=>setTimeout(resolve,230));result.stays=card.isConnected;
    card.dispatchEvent(new PointerEvent('pointerleave'));result.leaves=!card.isConnected;return result;
  });
  assert.ok(long.noFields&&long.full&&long.scrollable&&long.stays&&long.leaves);
  const inline=await page.evaluate(async()=>{
    game.user.isGM=false;
    const info=layoutNote.document.flags['pneuma-scenetools'].mapPin;
    info.imagePageId='description';info.descriptionPageId='description';info.sections='';
    template.pages.get('description').text.content='<section class="secret"><h2>GM notes</h2><img src="/private.svg"><p>Hidden detail</p></section><h2>Description</h2><p><img src="/original.svg">Public location</p><h2>Factions</h2><p>Public faction</p>';
    await hover.showPinHover(layoutNote);
    const card=document.querySelector('.pneuma-pin-hover');
    return {image:card.querySelector('.pin-hover-top > img')?.getAttribute('src'),images:card.querySelectorAll('img').length,text:card.textContent};
  });
  assert.equal(inline.image,'/original.svg');assert.equal(inline.images,1);
  assert.ok(inline.text.includes('Public faction'));assert.ok(!inline.text.includes('Hidden detail'));
  const separate=await page.evaluate(async()=>{
    const ID='pneuma-scenetools';
    const first=template.pages.get('description');first.flags={[ID]:{poi:true}};
    const second={...first,id:'second-poi',name:'Second POI',text:{content:'<h2>Description</h2><p>Second location</p>'},allowed:true};template.pages.push(second);
    const firstNote={document:{parent:scene,entry:template,pageId:first.id,text:'First',flags:{[ID]:{mapPin:{hover:true,imagePageId:second.id,descriptionPageId:second.id,imageSrc:'/first.svg',sections:''}}}}};
    const secondNote={document:{parent:scene,entry:template,pageId:second.id,text:'Second',flags:{[ID]:{mapPin:{hover:true,imagePageId:first.id,descriptionPageId:first.id,imageSrc:'/second.svg',sections:''}}}}};
    await hover.showPinHover(firstNote);
    const firstImage=document.querySelector('.pneuma-pin-hover img')?.getAttribute('src');
    const firstText=document.querySelector('.pneuma-pin-hover')?.textContent;
    await hover.showPinHover(secondNote);
    const secondImage=document.querySelector('.pneuma-pin-hover img')?.getAttribute('src');
    const secondText=document.querySelector('.pneuma-pin-hover')?.textContent;
    second.allowed=false;await hover.showPinHover(secondNote);
    return {firstImage,secondImage,firstText,secondText,hidden:!document.querySelector('.pneuma-pin-hover')};
  });
  assert.equal(separate.firstImage,'/first.svg');assert.equal(separate.secondImage,'/second.svg');
  assert.ok(separate.firstText.includes('Public location'));assert.ok(!separate.firstText.includes('Second location'));
  assert.ok(separate.secondText.includes('Second location'));assert.ok(separate.hidden);
  const journalImage=await page.evaluate(async()=>{
    const {syncPinImage}=await import('/modules/pneuma-scenetools/scripts/map-pins-image.js');
    game.user.isGM=true;
    const page=template.pages.get('description');page.uuid='JournalEntry.template.JournalEntryPage.description';
    const original='<h2>Description</h2><p>Keep description</p><h2>Factions</h2><p>Keep factions</p><h2>NPC&#39;s</h2><p>Keep NPC</p><section class="secret"><h2>GM notes</h2><p>Keep secret</p></section>';
    page.text.content=original;page.update=async data=>{page.text.content=data.text.content;};
    const info={imageSrc:'/first.svg'};
    const note={entry:template,pageId:page.id,text:'First POI',flags:{'pneuma-scenetools':{mapPin:info}}};
    const parse=()=>new DOMParser().parseFromString(page.text.content,'text/html');
    await syncPinImage(note);await syncPinImage(note);
    const first=parse();
    const result={heading:first.querySelector('[data-poi-image] > h2')?.textContent,bottom:first.body.lastElementChild?.hasAttribute('data-poi-image'),count:first.querySelectorAll('[data-poi-image]').length,outsideSecret:!first.querySelector('[data-poi-image]').closest('.secret')};
    info.imageSrc='/second.svg';await syncPinImage(note);
    result.replaced=parse().querySelector('[data-poi-image] img')?.getAttribute('src')==='/second.svg';
    info.imageSrc='';await syncPinImage(note);
    result.cleared=!parse().querySelector('[data-poi-image]');
    result.text=parse().body.textContent;
    page.update=async()=>{};info.imageSrc='/first.svg';
    try{await syncPinImage(note);result.rejected=false;}catch{result.rejected=true;}
    return result;
  });
  assert.ok(journalImage.bottom&&journalImage.outsideSecret&&journalImage.replaced&&journalImage.cleared&&journalImage.rejected);
  assert.equal(journalImage.count,1);
  assert.equal(journalImage.heading,'Image');
  for(const text of ['Keep description','Keep factions','Keep NPC','Keep secret'])assert.ok(journalImage.text.includes(text));
  assert.deepEqual(errors,[]);
  console.log('Map pin browser checks passed: manager/default persistence, native note tabs and listeners, journal remapping, scene scope, placement cancellation, categories/search, creation rollback, template settings, permissions, secret sections, heading checklists, crafted hover layout, full-description scrolling, hover cancellation.');
}finally{await browser.close();}
