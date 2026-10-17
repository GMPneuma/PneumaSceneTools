import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import Handlebars from "handlebars";
// This fixture tests UI contracts. It does not substitute for a live Foundry persistence check.
export async function fixture(browser, {files, imports = {}, selected, video, folderTree, stayOnFolder = false} = {}) {
  const page = await browser.newPage();
  const renderTemplate = Handlebars.compile(await readFile("dist/templates/scene-creator.hbs","utf8"));
  await page.exposeFunction("renderSceneTemplate",data=>renderTemplate(data));
  const errors = []; page.on("pageerror", error=>errors.push(error.message));
  await page.route("https://scene.test/**", async route=>{
    const path = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
    if (path.startsWith("scripts/")) return route.fulfill({contentType:"text/javascript",body:await readFile(resolve("dist",path))});
    if (path.endsWith("scene-creator.hbs")) return route.fulfill({contentType:"text/plain",body:await readFile("dist/templates/scene-creator.hbs")});
    if (imports[path]) return route.fulfill({contentType:"application/json",body:JSON.stringify(imports[path])});
    if (/\.(webm|mp4)$/.test(path) && video) return route.fulfill({contentType:"video/webm",body:video});
    if (/\.(svg|webp)$/.test(path)) return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000"><rect width="4000" height="3000" fill="#555"/></svg>'});
    return route.fulfill({contentType:"text/html",body:'<html><body></body></html>'});
  });
  await page.goto("https://scene.test/");
  await page.addScriptTag({content:`
    class FormApplication {
      static get defaultOptions(){return {}}
      constructor(object){this.object=object;this.options=this.constructor.defaultOptions;this.element=[];}
      render(){void this._render();return this;}
      async _render(){
        const root=document.createElement('section');
        root.innerHTML=await renderSceneTemplate(this.getData());
        this.element[0]?.remove();this.element=[root];this.form=root.querySelector('form');document.body.append(root);
        this.form.addEventListener('submit',async event=>{
          event.preventDefault();if(this._submitting||!this.form.reportValidity())return;this._submitting=true;
          const submitted=Object.fromEntries(new FormData(this.form));
          for(const input of this.form.querySelectorAll('input[type=checkbox]'))submitted[input.name]=input.checked;
          try{await this._updateObject(event,globalThis.emptySerializedSubmission?{}:submitted);}finally{this._submitting=false;}
        });
        this.activateListeners([root]);
      }
      activateListeners(){}
      async close(){this.element[0]?.remove();}
    }
    class Dialog {constructor(options){this.options=options} render(){return this} async close(){this.options.close?.()}}
    const values=new Map([['defaultGrid',100],['defaultDarkness',0],['defaultGlobalLight',true]]);
    const game={version:"12.343",user:{isGM:true},system:{grid:{distance:2,units:'m'}},folders:[],scenes:new Map(),settings:{get:(_id,key)=>values.get(key)}};
    const flattenObject=(object,prefix='',result={})=>{for(const [key,value] of Object.entries(object)){const path=prefix?prefix+'.'+key:key;if(value&&typeof value==='object'&&!Array.isArray(value))flattenObject(value,path,result);else result[path]=value;}return result;};
    const foundry={utils:{getProperty:(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object),flattenObject}};
    const notices=[];const ui={notifications:{info:message=>notices.push(message),warn:message=>notices.push(message),error:message=>notices.push(message)}};
    class Folder {static async create(data){const folder={...data,id:'folder-'+game.folders.length,folder:game.folders.find(f=>f.id===data.folder)??null};game.folders.push(folder);return folder}}
    class Scene {
      constructor(data){this.data=structuredClone(data)}
      static fromJSON(json){return new this(JSON.parse(json))}
      static async fromImport(data){(globalThis.importSources??=[]).push(structuredClone(data));return new this(data)}
      async importFromJSON(json){
        const imported=JSON.parse(json);(globalThis.nativeImports??=[]).push(structuredClone(imported));
        (globalThis.sceneOperations??=[]).push({id:this.id,kind:'import',data:structuredClone(imported)});
        if(globalThis.failNativeImport){globalThis.failNativeImport=false;throw Error('Simulated native import rejection')}
        this.data={...imported,_id:this.id,folder:this.data.folder,active:this.data.active,navigation:false};this.name=this.data.name;return this;
      }
      get thumb(){return this.data.thumb}
      toObject(){return structuredClone(this.data)}
      getDimensions(){return {sceneX:100,sceneY:100}}
      static async create(data){
        if(!(Number.isFinite(data.width)&&data.width>0&&Number.isFinite(data.height)&&data.height>0&&Number.isInteger(data.grid?.size)&&data.grid.size>=50&&Number.isFinite(data.grid?.distance)&&data.grid.distance>0))throw Error('Invalid Scene dimensions or grid');
        globalThis.creationAttempts=(globalThis.creationAttempts??0)+1;
        if(globalThis.failCreation||globalThis.creationAttempts===globalThis.failCreationAt){globalThis.failCreation=false;throw Error('Simulated database rejection')}
        const scene=new this(data);scene.id='scene-'+game.scenes.size;scene.name=data.name;
        if(!globalThis.dropPersistence)game.scenes.set(scene.id,scene);
        return scene;
      }
      async delete(){if(globalThis.failCleanup)throw Error('Simulated cleanup rejection');game.scenes.delete(this.id);}
      async createThumbnail(){return {thumb:'thumbnail'}}
      async update(changes){
        (globalThis.sceneOperations??=[]).push({id:this.id,kind:'update',data:structuredClone(changes)});
        if(globalThis.failOverrides){globalThis.failOverrides=false;throw Error('Simulated override rejection')}
        if(globalThis.cancelOverrides){globalThis.cancelOverrides=false;return undefined;}
        for(const [path,value] of Object.entries(changes)){const keys=path.split('.');let object=this.data;for(const key of keys.slice(0,-1))object=object[key]??={};object[keys.at(-1)]=value;}
        this.name=this.data.name;return this;
      }
      async createEmbeddedDocuments(type,documents){
        if(globalThis.cancelOverlay){globalThis.cancelOverlay=false;return [];}
        (globalThis.sceneOperations??=[]).push({id:this.id,kind:'create:'+type,data:structuredClone(documents)});
        const collection={Tile:'tiles',Token:'tokens',AmbientSound:'sounds'}[type];
        const current=this.data[collection]??=[];
        const created=documents.map((document,i)=>({...document,_id:'EmbeddedNew00000'+i}));current.push(...created);return created.map(document=>({...document,id:document._id}));
      }
      async updateEmbeddedDocuments(type,updates){
        if(globalThis.cancelRematch){globalThis.cancelRematch=false;return [];}
        (globalThis.sceneOperations??=[]).push({id:this.id,kind:'embedded:'+type,data:structuredClone(updates)});
        const collection={Tile:'tiles',Token:'tokens',AmbientSound:'sounds'}[type];
        for(const update of updates){const item=this.data[collection].find(item=>item._id===update._id);for(const [path,value] of Object.entries(update)){if(path==='_id')continue;const keys=path.split('.');let object=item;for(const key of keys.slice(0,-1))object=object[key]??={};object[keys.at(-1)]=value;}}
        return updates;
      }
    }
    const Hooks={on(){}};
  `});
  await page.evaluate(({files,selected,folderTree})=>{
    globalThis.FilePicker=class {
      activeSource="data";sources={data:{target:"maps"}};
      constructor(options){this.options=options;this._element=null}
      get target(){return this.sources[this.activeSource].target}
      render(){
        if(this.options.popOut===false){void this.browse(this.target).catch(()=>{});return this;}
        globalThis.pickerWindows=(globalThis.pickerWindows??0)+1;this.options.callback(selected);return this;
      }
      async browse(path=this.target,options){
        const result=await this.constructor.browse(this.activeSource,path,options);
        this.sources[this.activeSource].target=result.target;
        const form=document.createElement('form');form.className='filepicker';
        form.innerHTML='<input name="target"><input name="file"><button type="button" data-action="back">Up</button><ul class="directory"></ul><button type="submit">Select file</button>';
        form.querySelector('[name=file]').value=this.chosenFile??'';
        form.querySelector('[name=target]').value=path;
        for(const dir of result.dirs){const li=document.createElement('li');li.className='directory';li.dataset.path=dir;li.textContent=dir;form.querySelector('ul').append(li);}
        for(const file of result.files){const li=document.createElement('li');li.className='file';li.dataset.path=file;li.textContent=file;form.querySelector('ul').append(li);}
        const html=[form];html.toArray=()=>[form];
        if(this._element)this._replaceHTML(this._element,html);else this._injectHTML(html);
        this.activateListeners(html);return result;
      }
      activateListeners(html){
        globalThis.nativePickerListeners=(globalThis.nativePickerListeners??0)+1;
        const form=html[0];
        form.querySelectorAll('li.file').forEach(row=>row.addEventListener('click',()=>{this.chosenFile=row.dataset.path;form.querySelector('[name=file]').value=this.chosenFile;}));
        form.querySelectorAll('li.directory').forEach(row=>row.addEventListener('click',()=>{void this.browse(row.dataset.path).catch(()=>{});}));
        form.querySelector('[data-action=back]').addEventListener('click',()=>{void this.browse(this.target.slice(0,Math.max(0,this.target.lastIndexOf('/')))).catch(()=>{});});
        form.querySelector('[name=target]').addEventListener('change',event=>{void this.browse(event.target.value).catch(()=>{});});
        form.addEventListener('submit',event=>this._onSubmit(event));
      }
      async close(){this._element?.[0]?.remove();}
      static async browse(source,path,options){
        (globalThis.folderBrowseCalls??=[]).push({source,path,options});
        if(globalThis.failBrowsePath===path)throw Error('Folder unavailable');
        if(globalThis.stallBrowsePath===path)await new Promise(resolve=>{globalThis.finishBrowse=resolve});
        return {target:path,...(folderTree ? folderTree[path] ?? {files:[],dirs:[]} : {files,dirs:[]})};
      }
    };
  },{files,selected,folderTree});
  await page.evaluate(async()=>{const module=await import("/scripts/creator.js");globalThis.openCreator=module.openSceneCreator;module.openSceneCreator();});
  await page.locator('[data-native-folder] [name="target"]').waitFor();
  if (!stayOnFolder) {
    await page.locator('[data-native-folder] [name="file"]').fill(selected ?? files.find(path=>/\.(webp|png|jpg|webm)$/i.test(path)));
    await page.locator('[data-folder-next]:enabled').click();
    await page.locator('[name="variant-0"]').first().waitFor();
  }
  return {page,errors,state:()=>page.evaluate(()=>({scenes:[...game.scenes.values()].map(scene=>scene.data),folders:game.folders.map(folder=>({name:folder.name,parent:folder.folder?.name??null})),notices}))};
}
