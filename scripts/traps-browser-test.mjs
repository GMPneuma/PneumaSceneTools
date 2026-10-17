import Handlebars from "handlebars";
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:process.env.PNEUMA_BROWSER_CHANNEL});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://traps.test/**',async route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/systems/cyberpunk-red-core/modules/system/config.js')return route.fulfill({contentType:'text/javascript',body:'export default {skillList:{evasion:"Evasion",perception:"Perception",demolitions:"Demolitions"}};'});
   if(p==='/')return route.fulfill({contentType:'text/html',body:'<html><body></body></html>'});
   if(p.startsWith('/modules/pneuma-combattools/'))return route.fulfill({contentType:'text/javascript',body:await readFile(resolve('../PneumaCombatTools/dist',p.replace(/^\/modules\/pneuma-combattools\//,'')))});
   if(!p.startsWith('/modules/pneuma-scenetools/'))return route.fulfill({status:404,body:''});
   await route.fulfill({contentType:'text/javascript',body:await readFile(resolve('dist',p.replace(/^\/modules\/pneuma-scenetools\//,'')))});
 });
 const partialNames=['hazard-field','hazard-button','hazard-controls','hazard-sidebar','hazard-effects','hazard-access-point','hazard-trigger-summary','hazard-effect-editor','hazard-trigger-editor'];
 for(const name of partialNames) Handlebars.registerPartial(`modules/pneuma-scenetools/templates/${name}.hbs`,await readFile(`dist/templates/${name}.hbs`,'utf8'));
 const templates=Object.fromEntries(await Promise.all(['hazard-editor','hazard-popup'].map(async name=>[name,Handlebars.compile(await readFile(`dist/templates/${name}.hbs`,'utf8'))])));
 await page.exposeFunction('loadTemplates',paths=>{for(const path of paths) assert.ok(Handlebars.partials[path],`Missing partial: ${path}`);});
 await page.exposeFunction('renderHazardTemplate',(path,data)=>templates[path.split('/').pop().replace('.hbs','')](data));
 await page.goto('https://traps.test/');
 if(process.env.PNEUMA_FOUNDRY_CSS)await page.addStyleTag({content:await readFile(process.env.PNEUMA_FOUNDRY_CSS,'utf8')});
 await page.addStyleTag({content:`body{font:14px Arial;background:#333;color:#222}.dialog{background:#eee;padding:12px;margin:10px;max-height:1050px;overflow:auto}.form-group{display:flex;align-items:center;margin:5px 0}.form-group label,.form-fields{flex:1}input:not([type=checkbox]),select{width:100%;box-sizing:border-box}button{padding:5px}summary{font-size:15px}textarea{box-sizing:border-box}.notes{font-size:12px}`} );
 // Foundry's native form hint rule must not consume the entire sidebar column.
 await page.addStyleTag({content:'form .notes, form .hint {flex:0 0 100%;}'});
 await page.addStyleTag({content:await readFile('dist/styles/traps.css','utf8')});
 await page.evaluate(async()=>{
   const M='pneuma-scenetools';window.M=M;window.settings={trapPresets:{presets:[]}};window.dialogs=[];
   class Collection extends Array{get(id){return this.find(v=>v.id===id)}has(id){return !!this.get(id)}delete(id){const i=this.findIndex(v=>v.id===id);if(i>=0)this.splice(i,1)}}
   const path=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
   const apply=(o,changes)=>{for(const [k,v]of Object.entries(changes)){const keys=k.split('.');let p=o;for(const key of keys.slice(0,-1))p=p[key]??={};const last=keys.at(-1);if(last.startsWith('-='))delete p[last.slice(2)];else p[last]=structuredClone(v)}};
   window.foundry={utils:{getProperty:path,randomID:()=>crypto.randomUUID(),deepClone:v=>structuredClone(v)}};
   window.game={system:{id:'cyberpunk-red-core'},modules:new Map([["pneuma-combattools",{active:true,api:{}}]]),user:{id:'gm',isGM:true},users:new Collection(),settings:{get:(_m,k)=>settings[k],set:async(_m,k,v)=>settings[k]=v},i18n:{localize:v=>v}};
   window.CONST={REGION_VISIBILITY:{LAYER:0,GAMEMASTER:1,ALWAYS:2}};window.CONFIG={statusEffects:[{id:'prone',name:'Prone'}]};
   window.Hooks={callbacks:{},on(h,f){(this.callbacks[h]??=[]).push(f)},fire(h,...a){for(const f of this.callbacks[h]??[])f(...a)}};
   window.notices=[];window.ui={controls:{initialize:v=>window.lastControl=v},notifications:{info(){},error:message=>notices.push(message)}};
   function jq(nodes){const a=Array.from(nodes);a.find=s=>jq(a.flatMap(n=>[...n.querySelectorAll(s)]));a.on=(event,fn)=>{a.forEach(n=>n.addEventListener(event,fn));return a};a.append=n=>a.forEach(e=>e.append(n));return a}
   window.Dialog=class{constructor(data,options){this.data=data;this.options=options;dialogs.push(this)}get element(){return jq([this.el])}render(){this.el?.remove();this.el=document.createElement('section');this.el.className='app window-app dialog';this.el.style.width=(this.options.width??500)+'px';this.el.innerHTML=`<header class="window-header"><h4>${this.data.title}</h4></header><section class="window-content"><div class="dialog-content">${this.data.content}</div><div class="dialog-buttons"></div></section>`;document.body.append(this.el);this.data.render?.(jq([this.el]));return this}async close(){this.data.close?.();this.el?.remove()}setPosition(position){if(position.width){this.options.width=position.width;if(this.el)this.el.style.width=position.width+"px";}}static async confirm(){return true}static prompt(data){return new Promise((resolve,reject)=>{const modal=new this({title:data.title,content:data.content,render:html=>{const controls=document.createElement('footer');controls.innerHTML='<button type="button" data-picker-action="save">Save</button><button type="button" data-picker-action="cancel">Cancel</button>';html[0].append(controls);controls.querySelector('[data-picker-action=save]').addEventListener('click',()=>{try{resolve(data.callback(html));}catch(error){reject(error);}void modal.close();});controls.querySelector('[data-picker-action=cancel]').addEventListener('click',()=>{resolve(null);void modal.close();});}},{});modal.render();});}};
   window.FormDataExtended=class {
     constructor(form,{dtypes={}}={}){
       this.object={};
       for(const field of form.elements){
         if(!field.name||field.disabled||field.type==='file'||field.type==='submit'||field.type==='button')continue;
         const type=dtypes[field.name]??field.dataset.dtype??(field.type==='number'?'Number':field.type==='checkbox'?'Boolean':'String');
         const value=type==='Boolean'?field.checked:type==='Number'?Number(field.value):field.value;
         if(field.name in this.object)this.object[field.name]=[this.object[field.name],value].flat();else this.object[field.name]=value;
       }
     }
   };
   window.FormApplication=class {
     static get defaultOptions(){return {classes:[],width:500};}
     constructor(object,options={}){this.object=object;this.options={...this.constructor.defaultOptions,...options};this.data={title:this.options.title};this.rendered=false;dialogs.push(this);}
     get element(){return jq(this.el?[this.el]:[]);}
     render(){this.rendering=this._render();return this;}
     async _render(){
       const content=await renderHazardTemplate(this.options.template,this.getData());
       this.el?.remove();this.el=document.createElement('section');this.el.className='app window-app dialog '+this.options.classes.join(' ');
       this.el.style.width=this.options.width+'px';
       this.el.innerHTML=`<header class="window-header"><h4>${this.options.title}</h4></header><section class="window-content">${content}</section>`;
       document.body.append(this.el);this.form=this.el.querySelector('form');this.rendered=true;
       this.form.addEventListener('submit',event=>{event.preventDefault();void this._updateObject(event,new FormDataExtended(this.form).object);});
       this.activateListeners(jq([this.form]));
     }
     activateListeners(){}
     setPosition(position){if(position.width){this.options.width=position.width;if(this.el)this.el.style.width=position.width+'px';}}
     async close(){this.rendered=false;this.el?.remove();}
   };
   window.saveDataToFile=(text)=>window.exported=text;
   const scene={id:'scene',uuid:'Scene.scene',flags:{},async update(changes){const before=JSON.stringify(this.flags);apply(this,changes);return JSON.stringify(this.flags)===before?undefined:this},grid:{size:100},regions:new Collection(),tokens:new Collection()};
   window.scene=scene;Object.defineProperty(window,'hazardId',{get:()=>Object.keys(scene.flags[M]?.hazards??{}).filter(id=>id!=='other').at(-1)});
   window.canvas={scene,animatePan:async point=>window.lastPan=point,tokens:{controlled:[],activate(){},get(id){return {control(options){window.located=id;window.locateOptions=options}}}},regions:{get(id){return {center:{x:150,y:150},control(){window.located=id}}},activate(){},releaseAll(){window.released=true},controlled:[]}};
   window.region={shapes:[{type:'rectangle',x:100,y:100,width:100,height:100}],id:'trap',uuid:'Scene.scene.Region.trap',parent:scene,x:100,y:100,name:'Hazard Region',elevation:{bottom:null,top:null},behaviors:new Collection(),async createEmbeddedDocuments(type,data){this.behaviors.push(...data);return data},sheet:{render(){window.nativeEditorOpened=true}},flags:{},async delete(){scene.regions.delete(this.id)},async update(changes){apply(this,changes);return this},updateSource(changes){apply(this,changes)}};
   scene.regions.push(region);
   const root={id:'root',name:'SceneTools',type:'Actor',folder:null,flags:{[M]:{SceneToolsFolder:'root'}}};
   game.folders=new Collection(root,{id:'hazardTemplates',name:'Hazard Actor Templates',type:'Actor',folder:root,flags:{[M]:{SceneToolsFolder:'Hazard Actor Templates'}}},{id:'hazards',name:'Hazard Actors',type:'Actor',folder:root,flags:{[M]:{SceneToolsFolder:'Hazard Actors'}}});
   game.actors=new Collection();game.scenes=new Collection(scene);game.documentTypes={Actor:['mook','character'],Item:['armor']};
   let seq=0;
   window.Actor={createDocuments:async data=>data.map(entry=>{
     const actor={...entry,system:entry.system??{derivedStats:{hp:{value:40,max:40}}},id:'actor'+(++seq),folder:game.folders.get(entry.folder),items:new Collection(...(entry.items??[]).map(i=>({...i,id:i._id}))),effects:new Collection(),toObject(){return structuredClone({...entry,system:this.system})},async update(changes){apply(this,changes);return this},async delete(){game.actors.delete(this.id)},async getTokenDocument(position){return {toObject:()=>({...position,actorId:this.id,name:this.name,width:position.width??1,height:position.height??1})}}};game.actors.push(actor);return actor;
   })};
   scene.createEmbeddedDocuments=async(type,data)=>data.map(entry=>{if(type==='Region'){const created={...region,...entry,id:'hazard'+(++seq),flags:{},behaviors:new Collection()};created.uuid='Scene.scene.Region.'+created.id;scene.regions.push(created);window.region=created;return created;}const token={...entry,id:'token'+(++seq),actor:game.actors.get(entry.actorId),async update(changes,options){window.lastTokenUpdateOptions=options;apply(this,changes);return this},async delete(){scene.tokens.delete(this.id)}};token.uuid='Scene.scene.Token.'+token.id;scene.tokens.push(token);return token;});
   const drone={id:'drone',name:'Separate drone',actor:{items:new Collection({id:'weapon',type:'weapon',name:'Custom gun'}),system:{derivedStats:{hp:{value:20,max:20}}}}};scene.tokens.push(drone);
   await Actor.createDocuments([{name:'Condition template',type:'mook',system:{derivedStats:{hp:{value:5,max:5}}}}]);
   await Actor.createDocuments([{name:'Turret template',type:'mook',folder:'hazardTemplates',items:[{_id:'weapon',type:'weapon',name:'Custom gun',system:{}}],system:{derivedStats:{hp:{value:15,max:15}}}}]);
   window.trapsUI=await import('/modules/pneuma-scenetools/scripts/traps/ui.js');trapsUI.registerTrapUI();trapsUI.openTraps();
 });
 await page.locator('[data-action=newHazard]').waitFor();
 assert.deepEqual(await page.evaluate(()=>{const controls=[{name:'token',tools:[]},{name:'regions',tools:[]}];Hooks.fire('getSceneControlButtons',controls);return controls.map(group=>group.tools.find(tool=>tool.name==='pneuma-traps').icon);}),['fas fa-triangle-exclamation','fas fa-triangle-exclamation']);
 assert.equal(await page.evaluate(()=>dialogs.findLast(d=>d.data.title==='Scene Tools - Hazards').options.width),280);
 assert.equal(await page.locator('.hazard-editor').isVisible(),false);
 assert.equal(await page.locator('.hazard-native-panel').count(),1);
 assert.equal(await page.locator('.hazard-native-panel .window-content').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 let windowSidebarColor;
 const savePopup=async()=>{if(await page.locator('[data-action=popupSave]').count())await page.locator('[data-action=popupSave]').click();};
 await savePopup();await page.locator('[data-action=newHazard]').click();
 await page.locator('.hazard-top [aria-label="Hazard"] [name=name]').fill('Saved without drawing');
 await savePopup();await page.locator('[data-action=save]').click();
 assert.equal(await page.locator('[data-action=selectScene]').count(),1);
 assert.match(await page.locator('.hazard-library-list').textContent(),/Saved without drawing/);
 await page.screenshot({path:'docs/hazards-scene-list-preview.png'});
 assert.equal(await page.locator('[data-action=selectScene]').isVisible(),true);
 assert.equal(await page.locator('[data-action=locate]').isEnabled(),true);await page.locator('[data-action=locate]').click();
 assert.equal(await page.evaluate(()=>located),await page.evaluate(()=>scene.flags[M].hazards[hazardId].bodyId));assert.equal(await page.evaluate(()=>locateOptions.pan),false);

 await page.locator('[data-action=toggleEditor]').click();assert.equal(await page.locator('.hazard-editor').isVisible(),false);assert.equal(await page.locator('.hazard-row-controls').isVisible(),true);assert.equal(await page.locator('.hazard-native-panel').count(),1);windowSidebarColor=await page.locator('.hazard-library-entry > button').first().evaluate(el=>getComputedStyle(el).backgroundColor);await page.screenshot({path:'docs/hazards-control-panel-preview.png'});assert.equal(await page.evaluate(()=>dialogs.findLast(d=>d.data.title==='Scene Tools - Hazards').options.width),280);
 const compactCard=await page.locator('.hazard-library-entry').first().evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
 const compactStrip=await page.locator('.hazard-editor-collapsed').evaluate(form=>{const panel=form.querySelector('.hazard-library');return form.getBoundingClientRect().right-panel.getBoundingClientRect().right;});assert.ok(Math.abs(compactStrip)<2,'Collapsed form must not reserve a strip beside the sidebar');

 await page.locator('[data-action=toggleEditor]').click();assert.equal(await page.locator('.hazard-editor').isVisible(),true);assert.equal(await page.locator('.hazard-library [data-action=activate]').isVisible(),true);assert.equal(await page.locator('.hazard-native-panel').count(),1);
 const expandedCard=await page.locator('.hazard-library-entry').first().evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});assert.deepEqual(expandedCard,compactCard);
 const editRight=await page.locator('.hazard-row-actions:not(.hazard-visibility-actions)').evaluate(el=>Math.abs(el.getBoundingClientRect().right-el.querySelector('[data-action=toggleEditor]').getBoundingClientRect().right));assert.ok(editRight<2);


 await savePopup();await page.locator('[data-action=selectScene]').click();
 await savePopup();await page.locator('[data-action=save]').click();assert.equal(await page.locator('[data-action=selectScene]').count(),1);
 await page.evaluate(()=>{window.region=scene.regions.get(scene.flags[M].hazards[hazardId].triggerRegionId);region.shapes=[{type:'rectangle',x:100,y:100,width:100,height:100}];Hooks.fire('updateRegion',region);});
 assert.equal(await page.locator('[name=triggerRegionId]').count(),0);
 await page.evaluate(()=>{region.color='#3366cc';Hooks.fire('updateRegion',region,{color:region.color});});
 assert.equal(await page.locator('.hazard-library-entry > button[aria-current=true]').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(51, 102, 204)');
 await page.evaluate(()=>{region.color='#cc6633';Hooks.fire('updateRegion',region,{color:region.color});});
 assert.equal(await page.locator('.hazard-library-entry > button[aria-current=true]').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(204, 102, 51)');

 assert.equal(await page.evaluate(()=>scene.regions.length),2);
 await page.locator('[data-action=save]').waitFor();
 assert.equal(await page.locator('.hazard-top, .hazard-second, .hazard-third').count(),3);
 assert.equal(await page.locator('[name=hazardType], [data-action=next], [data-action=back], [data-action=step]').count(),0);
 const boxes=await page.locator('.hazard-top, .hazard-second, .hazard-third').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y}}));
 assert.ok(boxes[0].x<boxes[1].x&&Math.abs(boxes[0].y-boxes[1].y)<1&&boxes[2].y>boxes[1].y);
 const stages=await page.locator(".hazard-second > section").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));assert.ok(stages[0]<stages[1]&&stages[1]<stages[2]);
 for(const title of ['Triggers','Targets / Area']){const stage=await page.locator(`.hazard-second > section[aria-label="${title}"]`).evaluate(el=>{const header=el.querySelector('h3').getBoundingClientRect(),options=el.querySelector('.hazard-stage-options').getBoundingClientRect();return {right:options.left>header.right,aligned:Math.abs(options.top-header.top)<2};});assert.equal(stage.right,true);assert.equal(stage.aligned,true);}
 assert.equal(await page.locator('.hazard-second > section[aria-label="Effects"] .hazard-stage-options').count(),0);
 const dataAlignment=await page.evaluate(()=>({triggers:document.querySelector('.hazard-trigger-summary').getBoundingClientRect().left,targets:document.querySelector('[name=targetMode]').getBoundingClientRect().left}));assert.ok(Math.abs(dataAlignment.triggers-dataAlignment.targets)<2);

 assert.equal(await page.locator('.hazard-incoming').count(),0);assert.doesNotMatch(await page.locator('.hazard-trigger-summary').textContent(),/Activated By/);
 assert.equal(await page.locator('.hazard-stage-header [data-action=editTriggers]').count(),1);
 const editHeader=await page.locator('.hazard-stage-header').evaluate(el=>({header:el.querySelector('h3').getBoundingClientRect().bottom,button:el.querySelector('button').getBoundingClientRect().top}));assert.ok(editHeader.button>=editHeader.header);
 const arrowCenters=await page.locator('.hazard-second > section:not(:last-child)').evaluateAll(nodes=>nodes.map(el=>{const style=getComputedStyle(el,'::after');return Math.abs(parseFloat(style.top)-(el.getBoundingClientRect().height+13))<2;}));assert.ok(arrowCenters.every(Boolean));

 assert.equal(await page.locator('.hazard-second > section[aria-label="Targets / Area"] .hazard-stage-options label').count(),0);
 assert.ok(await page.locator('.hazard-editor-expanded').evaluate(el=>el.getBoundingClientRect().height)<800,'Editor should fit its initial contents instead of reserving 820px');


 for(const field of ['spotDV','disarmDV','disarmSeconds','apType'])assert.equal(await page.locator(`.hazard-top [name=${field}]`).isVisible(),true);
 assert.equal(await page.locator('fieldset[data-trigger-options]').count(),0);
 assert.equal(await page.locator('.hazard-third [data-action=save]').count(),1);
 assert.equal(await page.locator('[name=hazardActorTemplateId]').count(),1);
 assert.equal(await page.locator('[data-action=tokenIcon]').isVisible(),true);
 await page.evaluate(()=>window.FilePicker=class{constructor(options){this.options=options}browse(){this.options.callback('custom/hazard.webp')}});
 await page.locator('[data-action=tokenIcon]').click();
 assert.equal(await page.locator('.hazard-token-icon img').getAttribute('src'),'custom/hazard.webp');
 await savePopup();await page.locator('[data-action=save]').click();
 assert.equal(await page.evaluate(()=>scene.tokens.get(scene.flags[M].hazards[hazardId].bodyId).texture.src),'custom/hazard.webp');
 await page.locator('[data-action=editTriggers]').click();
 assert.equal(await page.locator('.hazard-trigger-options').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
 assert.equal(await page.locator('[name=hazardTrigger][value=move]').isChecked(),false);assert.equal(await page.locator('.hazard-move-trigger [name=distance]').isVisible(),true);
 const movement=await page.locator('.hazard-move-trigger').evaluate(el=>{const label=el.querySelector('label').getBoundingClientRect(),input=el.querySelector('[name=distance]').getBoundingClientRect();return input.left>=label.right;});assert.equal(movement,true);
 await page.locator('[name=distance]').fill('4');await savePopup();await page.locator('[data-action=save]').click();assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].distance),4);

 assert.equal(await page.locator('[name=armed]').count(),0);assert.equal(await page.locator('.hazard-row-actions [data-action=toggleActivated] i.fa-power-off').count(),1);
 assert.equal(await page.locator('[data-action=activate]').textContent(),'Trigger now');
 assert.equal(await page.locator('.hazard-library-heading .notes').textContent(),'On this scene');
 assert.equal(await page.locator('[data-action=trigger]').count(),0);
 assert.equal(await page.locator('.hazard-library [data-action=activate]').count(),1);
 assert.equal(await page.locator('.hazard-second > section').count(),3);
 assert.equal(await page.locator('.hazard-second [name=hazardTrigger]').count(),0);
 assert.equal(await page.locator('.hazard-second [name=targetMode]').count(),1);
 assert.equal(await page.locator('.hazard-second [name=targetMode]').count(),1);
 assert.equal(await page.locator('.hazard-second [aria-label=Effects]').count(),1);
 assert.equal(await page.locator('.hazard-preset-bar [name=preset]').count(),1);
 const presetRow=await page.locator('.hazard-preset-bar').evaluate(el=>{const children=[el.querySelector('h3'),el.querySelector('select'),...el.querySelectorAll('button')];return children.map(child=>{const r=child.getBoundingClientRect();return {top:r.top,bottom:r.bottom};});});assert.equal(presetRow.length,4);assert.ok(Math.max(...presetRow.map(r=>r.top))<Math.min(...presetRow.map(r=>r.bottom)));
 assert.equal(await page.locator('.hazard-preset-bar .notes, .hazard-preset-bar p, .hazard-preset-bar label').count(),0);

 assert.equal(await page.locator('.hazard-third .hazard-save-panel [data-action=save]').count(),1);
 const bottomLayout=await page.evaluate(()=>{const blue=document.querySelector('.hazard-top [aria-label="Hazard"]').getBoundingClientRect(),footer=document.querySelector('.hazard-third').getBoundingClientRect(),requirements=document.querySelector('.hazard-draft-requirements').getBoundingClientRect(),save=document.querySelector('.hazard-save-panel').getBoundingClientRect();return {blue:blue.bottom,footer:footer.bottom,left:requirements.right,right:save.left};});assert.ok(Math.abs(bottomLayout.blue-bottomLayout.footer)<2);assert.ok(bottomLayout.left<bottomLayout.right);

 assert.equal(await page.locator('[data-action=save] i.fa-save').count(),1);assert.equal(await page.locator('[data-action=deleteHazard] i.fa-trash').count(),1);
 const checks=await page.locator('.hazard-check-column input').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));assert.ok(checks[0]<checks[1]&&checks[1]<checks[2]);
 assert.equal(await page.locator('.hazard-header-columns > div').count(),3);

 await page.locator('[data-action=presetFiles]').click();assert.equal(await page.locator('.hazard-library [name=presetFile]').isVisible(),true);
 await page.locator('[data-action=presetFiles]').click();assert.equal(await page.locator('.hazard-preset-files').isVisible(),false);
 assert.equal(await page.locator('[name=disarmSkill]').count(),0);await page.locator('[name=disarmDV]').fill('15');
 // Incomplete saves persist and visibly warn while retaining their automatic body.
 await savePopup();await page.locator('[data-action=save]').click();assert.equal(await page.locator('[role=alert]').textContent(),'');
 assert.equal(await page.locator('.hazard-warning').count(),1);assert.ok(await page.evaluate(()=>scene.flags[M].hazards[hazardId].bodyId));
 assert.equal(await page.locator('.hazard-library > [data-action=locate]').count(),0);assert.equal(await page.locator('.hazard-library-entry [data-action=locate]').count(),1);
 await page.locator('.hazard-row-actions [data-action=locate]').click();assert.equal(await page.evaluate(()=>located),await page.evaluate(()=>scene.flags[M].hazards[hazardId].bodyId));
 assert.equal(await page.locator('.hazard-row-controls .hazard-requirements, .hazard-row-controls ul, .hazard-row-controls p').count(),0);
 const cardWarning=await page.locator('.hazard-library-entry').first().evaluate(el=>{const title=el.querySelector('.hazard-card-title').getBoundingClientRect(),warning=el.querySelector('.hazard-warning');return {right:warning.getBoundingClientRect().left>=title.right,size:parseFloat(getComputedStyle(warning).fontSize)};});assert.equal(cardWarning.right,true);assert.ok(cardWarning.size>=26);

 await page.locator('[data-action=editTriggers]').click();
 assert.deepEqual(await page.locator('[name=hazardTrigger]').evaluateAll(nodes=>nodes.map(n=>n.value)),['enter','move','deviceTurn','turnStart']);
 await page.locator('.hazard-top [aria-label="Hazard"] [name=name]').fill('Camera <custom>');await page.evaluate(()=>{const actor=scene.tokens.get(scene.flags[M].hazards[hazardId].bodyId).actor;if(!actor.items.some(i=>i.name==='Custom gun'))actor.items.push({id:'gun',type:'weapon',name:'Custom gun',system:{}});});await page.locator('[name=spotDV]').fill('12');
 await page.locator('[name=hazardTrigger][value=turnStart]').check();
 await page.locator('[name=hazardTrigger][value=deviceTurn]').check();assert.equal(await page.locator('[name=turnActorId]').count(),0);
 await savePopup();
 await page.locator('[name=targetMode]').selectOption('region');
 assert.equal(await page.locator('[name=minElevation], [name=maxElevation]').count(),0);
 assert.equal(await page.locator('[data-action=region], [data-action=targetRegion], [data-action=createTriggerRegion], [data-action=createTargetRegion]').count(),0);await page.evaluate(()=>region.elevation={bottom:2,top:8});
 await savePopup();await page.locator('[data-action=add]').click();
 let effect=page.locator('[data-effect-index="0"]');
 await effect.locator('[name=formula]').selectOption('2d6');await effect.locator('[name=halfArmor]').check();await effect.locator('[name=resistSkill]').selectOption('Evasion');await effect.locator('[name=resistDV]').fill('13');
 await savePopup();await page.locator('[data-action=add]').click();effect=page.locator('[data-effect-index="1"]');await effect.locator('[name=kind]').selectOption('spawnCondition');
 await effect.locator('[name=actorTemplateId]').selectOption('actor1');
 await savePopup();await page.locator('[data-action=add]').click();effect=page.locator('[data-effect-index="2"]');await effect.locator('[name=kind]').selectOption('attack');assert.equal(await effect.locator('[name=actorId]').count(),0);await effect.locator('[name=weapon]').selectOption('Custom gun');
 await savePopup();await page.locator('[data-action=editEffect][data-id="0"]').click();
 assert.equal(await page.locator('[data-effect-index]').count(),1);assert.equal(await page.locator('[data-action=editEffect]').first().textContent(),'');assert.equal(await page.locator('[data-action=remove] i.fa-trash').count(),3);assert.equal(await page.locator('[name=resistSkill]').inputValue(),'Evasion');assert.equal(await page.locator('[name=halfArmor]').isChecked(),true);
 await savePopup();await page.locator('[data-action=save]').click();
 assert.equal(await page.locator('[role=alert]').textContent(),'');
 assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].hp),40);assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].actions[1].actorTemplateId),'actor1');
 assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].actions[0].resistSkill),'Evasion');
 const bodyId=await page.evaluate(()=>scene.flags[M].hazards[hazardId].bodyId);assert.ok(bodyId);assert.notEqual(bodyId,'drone');
 assert.equal(await page.locator('.hazard-library [aria-label="Hazard controls"] [data-action=reveal]').count(),1);
 const activeBeforeVisibility=await page.evaluate(()=>scene.flags[M].hazards[hazardId].armed);
 await page.locator('[data-action=regionVisibility]').click();assert.equal(await page.evaluate(()=>region.visibility),0);
 await page.locator('[data-action=regionVisibility]').click();assert.equal(await page.evaluate(()=>region.visibility),1);
 await page.locator('[data-action=playerRegionVisibility]').click();assert.equal(await page.evaluate(()=>region.visibility),2);
 await page.locator('[data-action=playerRegionVisibility]').click();assert.equal(await page.evaluate(()=>region.visibility),1);
 assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].armed),activeBeforeVisibility);
 assert.equal(await page.locator('.hazard-visibility-actions [data-action=reveal], .hazard-visibility-actions [data-action=regionVisibility], .hazard-visibility-actions [data-action=playerRegionVisibility]').count(),3);

 assert.equal(await page.locator('.hazard-library [aria-label="Hazard controls"] [data-action=bodySheet]').count(),1);
 for(const row of ['.hazard-top','.hazard-third']){
   const bottoms=await page.locator(row).evaluate(e=>[...e.children].map(child=>child.getBoundingClientRect().bottom));
   assert.ok(Math.max(...bottoms)-Math.min(...bottoms)<1,`${row} boxes must share a bottom edge`);
 }
 assert.equal(await page.evaluate(id=>scene.tokens.get(id).hidden,bodyId),true);
 await page.locator('[data-action=reveal]').click();assert.equal(await page.evaluate(id=>scene.tokens.get(id).hidden,bodyId),false);
 assert.equal(await page.evaluate(()=>lastTokenUpdateOptions.pneumaSceneToolsHazardVisibility),true);assert.equal(await page.evaluate(()=>lastTokenUpdateOptions.pan),false);
 // A stale label must still perform its stated absolute action.
 assert.equal(await page.locator('[data-action=reveal]').getAttribute('title'),'Hide hazard Actor');
 await page.evaluate(id=>scene.tokens.get(id).hidden=true,bodyId);
 await page.locator('[data-action=reveal]').click();assert.equal(await page.evaluate(id=>scene.tokens.get(id).hidden,bodyId),true);
 assert.equal(await page.locator('[data-action=reveal]').getAttribute('title'),'Show hazard Actor');
 await page.evaluate(id=>scene.tokens.get(id).hidden=false,bodyId);
 await page.locator('[data-action=reveal]').click();assert.equal(await page.evaluate(id=>scene.tokens.get(id).hidden,bodyId),false);
 // Native visibility updates refresh the label without losing unsaved fields.
 await page.locator('[name=notes]').fill('Visibility change preserves draft');
 await page.evaluate(id=>{const token=scene.tokens.get(id);token.hidden=true;Hooks.fire('updateToken',token,{hidden:true});},bodyId);
 assert.equal(await page.locator('[data-action=reveal]').getAttribute('title'),'Show hazard Actor');
 assert.equal(await page.locator('[name=notes]').inputValue(),'Visibility change preserves draft');
 await page.evaluate(id=>{const token=scene.tokens.get(id);token.hidden=false;Hooks.fire('updateToken',token,{hidden:false});},bodyId);
 assert.equal(await page.locator('[data-action=reveal]').getAttribute('title'),'Hide hazard Actor');

 assert.equal(await page.evaluate(()=>scene.tokens.get('drone').actor.system.derivedStats.hp.value),20);
 assert.deepEqual(await page.evaluate(()=>region.elevation),{bottom:2,top:8});
 assert.equal(await page.locator('.hazard-warning').count(),0);
 await page.locator('[data-action=toggleActivated]').click();await savePopup();await page.locator('[data-action=save]').click();
 await page.locator('[name=notes]').fill('Unsaved note survives deactivation');
 await page.evaluate(()=>{scene.tokens.get(scene.flags[M].hazards[hazardId].bodyId).actor.system.derivedStats.hp.value=0;scene.flags[M].hazards[hazardId].armed=false;Hooks.fire('updateScene',scene,{[`flags.${M}.hazards.${hazardId}.armed`]:false});});
 assert.equal(await page.locator('[data-action=toggleActivated]').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('[data-action=toggleActivated]').isDisabled(),true);assert.equal(await page.locator('[data-action=activate]').isDisabled(),true);assert.equal(await page.locator('[name=notes]').inputValue(),'Unsaved note survives deactivation');
 await page.evaluate(()=>{scene.tokens.get(scene.flags[M].hazards[hazardId].bodyId).actor.system.derivedStats.hp.value=40;Hooks.fire('updateActor',scene.tokens.get(scene.flags[M].hazards[hazardId].bodyId).actor);});
 assert.equal(await page.locator('[data-action=toggleActivated]').getAttribute('aria-pressed'),'false');await savePopup();await page.locator('[data-action=save]').click();assert.equal(await page.locator('[role=alert]').textContent(),'');
 await page.locator('[name=notes]').fill('Draft retained while using the control panel');
 await page.locator('[data-action=toggleEditor]').click();assert.equal(await page.locator('.hazard-editor').isVisible(),false);
 await page.locator('[data-action=toggleActivated]').click();await page.waitForFunction(()=>scene.flags[M].hazards[hazardId].armed===true);
 assert.equal(await page.locator('.hazard-library [data-action=activate]').isEnabled(),true);
 await page.locator('[data-action=toggleEditor]').click();assert.equal(await page.locator('[name=notes]').inputValue(),'Draft retained while using the control panel');
 await page.locator('[data-action=save]').click();assert.equal(await page.locator('[role=alert]').textContent(),'');


 assert.equal(await page.locator('[name=effectAreaId], [name=useOtherRegion]').count(),0);
 await page.locator('[data-action=presetSave]').click();
 assert.equal(await page.evaluate(()=>settings.trapPresets.presets[0].actions[1].actorTemplateId),'actor1');
 assert.equal(await page.evaluate(()=>'effectAreaId' in settings.trapPresets.presets[0]),false);
 assert.equal(await page.evaluate(()=>settings.trapPresets.presets[0].tokenIcon),'custom/hazard.webp');
 assert.equal(await page.evaluate(()=>settings.trapPresets.presets[0].bodyId),'');assert.equal(await page.evaluate(()=>settings.trapPresets.presets[0].actions[2].actorId),'');
 await page.evaluate(()=>Dialog.confirm=async()=>false);await page.locator('[name=spotDV]').fill('25');await page.locator('[data-action=presetSave]').click();assert.equal(await page.evaluate(()=>settings.trapPresets.presets[0].hp),40);
 await page.evaluate(()=>Dialog.confirm=async()=>true);await page.evaluate(()=>{const actor=scene.tokens.get(scene.flags[M].hazards[hazardId].bodyId).actor;if(!actor.items.some(i=>i.name==='Custom gun'))actor.items.push({id:'gun',type:'weapon',name:'Custom gun',system:{}});});
 await page.evaluate(()=>{scene.flags[M].hazards.other={...structuredClone(scene.flags[M].hazards[hazardId]),name:'Other hazard',actions:[]};window.other={id:'other'}});
 await savePopup();await page.locator('[data-action=add]').click();effect=page.locator('[data-effect-index="3"]');await effect.locator('[name=kind]').selectOption('triggerHazard');await effect.locator('[name=hazardId]').selectOption('other');await savePopup();await page.locator('[data-action=save]').click();
 await savePopup();await page.locator('[data-action=selectScene][data-id=other]').click();assert.equal(await page.locator('.hazard-trigger-summary li.hazard-incoming').textContent(),'Other hazard: Camera <custom>');assert.doesNotMatch(await page.locator('.hazard-trigger-summary').textContent(),/Activated By/);assert.equal(await page.locator('.hazard-incoming input').count(),0);
 await savePopup();await page.locator('[data-action=selectScene]:not([data-id=other])').click();
 await savePopup();await page.locator('[data-action=add]').click();effect=page.locator('[data-effect-index="4"]');await effect.locator('[name=kind]').selectOption('movePenalty');await effect.locator('[name=formula]').fill('2');await effect.locator('[name=untilExit]').check();
 await page.evaluate(async()=>{
   const {masterStatuses}=await import('/modules/pneuma-combattools/scripts/status-catalog.js');
   CONFIG.statusEffects.push(...['body','head','drugs','pharma'].map(group=>masterStatuses.find(effect=>effect.group===group)));
   game.modules.set('pneuma-combattools',{active:true,api:{statusPicker:{version:1,choose:(...args)=>import('/modules/pneuma-combattools/scripts/damage-status.js').then(module=>module.chooseDamageStatuses(...args))}}});
 });
 await savePopup();await page.locator('[data-action=add]').click();effect=page.locator('[data-effect-index="5"]');await effect.locator('[name=kind]').selectOption('status');await effect.locator('[data-action=chooseStatus]').click();
 await page.locator('.pneuma-damage-status-picker').waitFor();
 for(const title of ['Body Crits','Head Crits','Drugs','Pharma','Misc'])assert.ok((await page.locator('.pneuma-effect-category summary').allTextContents()).some(text=>text.startsWith(title)),title+' category must render from CT');
 await page.locator('.pneuma-effect-category summary').filter({hasText:'Misc'}).click();
 await page.locator('.pneuma-damage-status-picker [value=prone]').check();
 await page.screenshot({path:'docs/hazards-status-picker-preview.png'});
 await page.locator('[data-picker-action=save]').click();assert.equal(await page.locator('[data-effect-index] [name=status]').inputValue(),'prone');
 await page.locator('[data-action=chooseStatus]').click();await page.locator('[data-picker-action=cancel]').click();assert.equal(await page.locator('[data-effect-index] [name=status]').inputValue(),'prone');
 await page.evaluate(()=>game.modules.set('pneuma-combattools',{active:true,api:{statusPicker:{version:1,choose:async(selected,slot,options)=>{window.ctPickerOptions={selected,slot,options};return ['prone'];}}}}));
 await page.locator('[data-action=chooseStatus]').click();assert.ok((await page.evaluate(()=>ctPickerOptions.options.allowedIds)).includes('prone'));
 await page.evaluate(()=>game.modules.set('pneuma-combattools',{active:true,api:{}}));await savePopup();await page.locator('[data-action=save]').click();
 assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].actions[4].formula),'2');assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].actions[5].status),'prone');
 await savePopup();await page.locator('[data-action=editEffect][data-id="0"]').click();
 await page.screenshot({path:'docs/hazards-effect-popup-preview.png'});await savePopup();
 await page.screenshot({path:'docs/hazards-sections-preview.png'});
 await savePopup();await page.locator('[data-action=editEffect][data-id="4"]').click();
 await savePopup();await page.screenshot({path:'docs/hazards-compact-preview.png'});
 // Cancelling or closing popups must never modify the main draft.
 const summaryBefore=await page.locator('.hazard-effect-table').textContent();
 await page.locator('[data-action=add]').click();await page.locator('[name=formula]').selectOption('8d6');await page.locator('[data-action=popupCancel]').click();
 assert.equal(await page.locator('.hazard-effect-table').textContent(),summaryBefore);
 await page.locator('[data-action=editEffect][data-id="0"]').click();await page.locator('[name=formula]').selectOption('8d6');await page.evaluate(()=>dialogs.at(-1).close());
 assert.equal(await page.locator('.hazard-effect-table').textContent(),summaryBefore);
 const triggerBefore=await page.locator('.hazard-trigger-summary').textContent();
 await page.locator('[data-action=editTriggers]').click();await page.locator('[name=hazardTrigger][value=move]').check();await page.locator('[name=distance]').fill('99');await page.locator('[data-action=popupCancel]').click();
 assert.equal(await page.locator('.hazard-trigger-summary').textContent(),triggerBefore);
 assert.equal(await page.locator('.hazard-second [data-effect-index], .hazard-second [name=hazardTrigger]').count(),0);
 assert.equal(await page.evaluate(()=>dialogs.findLast(d=>d.data.title==='Scene Tools - Hazards').options.width),1040);
 assert.ok(await page.locator('.hazard-editor').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Narrow hazard editor must not overflow horizontally');
 await savePopup();await page.locator('[data-action=newHazard]').click();
 await page.locator('.hazard-top [aria-label="Hazard"] [name=name]').fill('Draft saved with no shape');
 await savePopup();await page.locator('[data-action=save]').click();
 assert.equal(await page.locator('[data-action=selectScene]').count(),3);
 assert.equal(await page.locator('[data-action=toggleActivated]').isDisabled(),true);
 assert.equal(await page.locator('[data-action=activate]').isDisabled(),true);
 assert.ok(await page.locator('.hazard-invalid').count()>0);
 assert.match(await page.locator('.hazard-draft-requirements').textContent(),/Draw the trigger area/);
 assert.match(await page.locator('.hazard-library-list [aria-current=true]').textContent(),/Draft saved with no shape/);
 const savedId=await page.evaluate(()=>hazardId);
 await page.evaluate(async id=>{await dialogs.findLast(d=>d.data.title==="Scene Tools - Hazards").close();const {findHazard}=await import("/modules/pneuma-scenetools/scripts/traps/documents.js");await trapsUI.editTrap(findHazard(scene,id));},savedId);
 assert.equal(await page.locator('.hazard-top [aria-label="Hazard"] [name=name]').inputValue(),'Draft saved with no shape');
 assert.equal(await page.locator('[data-action=selectScene]').count(),3);
 await savePopup();await page.locator('[data-action=save]').click();assert.equal(await page.locator('[data-action=selectScene]').count(),3);
 assert.equal(await page.evaluate(()=>scene.regions.length),3);
 const triggerId=await page.evaluate(()=>scene.flags[M].hazards[hazardId].triggerRegionId);
 assert.ok(triggerId);assert.equal(await page.evaluate(id=>scene.regions.get(id).name,triggerId),'Draft saved with no shape-Tigger');
 assert.equal(await page.evaluate(id=>scene.regions.get(id).shapes.length,triggerId),0);
 assert.equal(await page.locator('[data-action=region], [data-action=targetRegion], [data-action=createTriggerRegion], [data-action=createTargetRegion]').count(),0);
 const targetId='trap';
 // AP uses a native template, works without HP, and is only created explicitly.
 await page.evaluate(async()=>{const [a]=await Actor.createDocuments([{name:'Edited camera template',type:'container',flags:{[M]:{templateType:'camera'}},prototypeToken:{texture:{src:'custom-camera.webp'}},system:{}}]);a.getTokenDocument=async p=>({toObject:()=>({...a.prototypeToken,...p,actorId:a.id,name:p.name})});});
 await page.locator('[name=apType]').selectOption('camera');await savePopup();await page.locator('[data-action=save]').click();
 assert.equal(await page.locator('[data-action=createAP]').isEnabled(),true,JSON.stringify(await page.evaluate(()=>({draftType:document.querySelector('[name=apType]').value,config:scene.flags[M].hazards[hazardId],alert:document.querySelector('[role=alert]').textContent}))));
 await page.locator('[data-action=createAP]').click();await savePopup();await page.locator('[data-action=save]').click();
 const apId=await page.evaluate(()=>scene.flags[M].hazards[hazardId].apId);
 assert.ok(apId);assert.equal(await page.evaluate(id=>scene.tokens.get(id).name,apId),'Draft saved with no shape');
 assert.equal(await page.evaluate(id=>scene.tokens.get(id).texture.src,apId),'custom-camera.webp');
 assert.equal(await page.locator('.hazard-ap-artwork img').getAttribute('src'),'custom-camera.webp');
 assert.equal(await page.locator('[data-action=createAP]').isDisabled(),true);
 await page.evaluate(({triggerId,targetId,apId})=>{const r=scene.regions.get(triggerId);scene.regions.splice(scene.regions.indexOf(r),1);Hooks.fire('deleteRegion',r);const target=scene.regions.get(targetId);scene.regions.splice(scene.regions.indexOf(target),1);Hooks.fire('deleteRegion',target);const ap=scene.tokens.get(apId);scene.tokens.delete(apId);Hooks.fire('deleteToken',ap);},{triggerId,targetId,apId});
 assert.equal(await page.locator('[name=triggerRegionId]').count(),0);assert.equal(await page.locator('[name=effectAreaId]').count(),0);
 assert.equal(await page.locator('[data-action=createAP]').isEnabled(),true);
 await savePopup();await page.locator('[data-action=save]').click();
 assert.match(await page.evaluate(()=>notices.at(-1)),/Trigger Region no longer exists/);
 assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].triggerRegionId),triggerId);
 await page.evaluate(()=>Dialog.confirm=async()=>false);
 await page.locator('[data-action=deleteHazard]').click();assert.equal(await page.locator('[data-action=selectScene]').count(),3);
 await page.evaluate(()=>Dialog.confirm=async()=>true);
 await page.locator('[data-action=deleteHazard]').click();assert.equal(await page.locator('[data-action=selectScene]').count(),2);
 assert.equal(await page.evaluate(id=>Boolean(scene.flags[M].hazards[id]),savedId),false);
 assert.ok(await page.locator('[data-action=save]').evaluate(el=>el.getBoundingClientRect().height)<55);

 await page.evaluate(()=>{window.hazardId=document.querySelector('[data-action=selectScene][aria-current=true]').dataset.id;});
 await page.locator('[name=hazardActorTemplateId]').selectOption('actor2');
 const imageSize=await page.locator('.hazard-token-preview img').evaluate(el=>({width:el.getBoundingClientRect().width,border:getComputedStyle(el).borderTopWidth}));assert.equal(imageSize.width,64);assert.equal(imageSize.border,'1px');
 await page.locator('[data-action=save]').click();assert.equal(await page.evaluate(()=>scene.flags[M].hazards[hazardId].hazardActorTemplateId),'actor2');
 assert.equal(await page.evaluate(()=>scene.tokens.get(scene.flags[M].hazards[hazardId].bodyId).actor.system.derivedStats.hp.max),15);
 await page.locator('[data-action=presetSave]').click();assert.equal(await page.evaluate(()=>settings.trapPresets.presets.find(p=>p.name===scene.flags[M].hazards[hazardId].name).hazardActorTemplateId),'actor2');

 await page.locator('[data-action=newHazard]').click();
 await page.locator('[name=name]').fill('Weapon-ready draft');
 await page.locator('[name=hazardActorTemplateId]').selectOption('actor2');
 const beforeSpawn=await page.evaluate(()=>scene.tokens.size??scene.tokens.length);
 await page.locator('[data-action=add]').click();
 await page.locator('[data-effect-index="0"] [name=kind]').selectOption('attack');
 assert.ok((await page.locator('[name=weapon] option').allTextContents()).includes('Custom gun'));
 assert.equal(await page.evaluate(()=>scene.tokens.size??scene.tokens.length),beforeSpawn+1);
 await page.locator('[data-action=popupCancel]').click();
 await page.locator('[data-action=add]').click();
 assert.equal(await page.evaluate(()=>scene.tokens.size??scene.tokens.length),beforeSpawn+1,'Reopening effects must reuse the saved Actor');
 await page.locator('[data-action=popupCancel]').click();

 await page.locator('[name=hazardActorTemplateId]').selectOption('');
 await page.locator('[data-action=add]').click();
 await page.locator('[data-effect-index="0"] [name=kind]').selectOption('attack');
 const defaultWeapons=await page.locator('[name=weapon] option').allTextContents();
 assert.ok(defaultWeapons.includes('Very Heavy Pistol'));assert.ok(!defaultWeapons.includes('Custom gun'));
 assert.equal(await page.evaluate(()=>scene.tokens.size??scene.tokens.length),beforeSpawn+1,'Template changes replace the body instead of leaving duplicates');
 await page.locator('[data-action=popupCancel]').click();
 const templateOptions=await page.locator('[name=hazardActorTemplateId] option:not([disabled])').allTextContents();
 assert.deepEqual(templateOptions,['Default hazard Actor','Turret template']);
 assert.equal(await page.locator('[name=hazardActorTemplateId] option[value=""]').isDisabled(),false);
 await page.evaluate(()=>{for(const actor of game.actors)actor.folder=null;Hooks.fire('updateActor');});
 await page.waitForFunction(()=>document.querySelector('[name=hazardActorTemplateId]').options.length===1);
 assert.equal(await page.locator('[name=hazardActorTemplateId] option').textContent(),'Default hazard Actor');
 assert.deepEqual(errors,[]);
 console.log('Three hazard sections, effect list and selected properties, incomplete warnings, target toggle, templates and portable presets passed.');
}finally{await browser.close()}
