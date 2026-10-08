import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import Handlebars from "handlebars";
// This fixture tests UI contracts. It does not substitute for a live Foundry persistence check.
export async function fixture(browser, {files, imports = {}, selected, video} = {}) {
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
        this.activateListeners([this.form]);
      }
      activateListeners(){}
      async close(){this.element[0]?.remove();}
    }
    const values=new Map([['defaultGrid',100],['defaultDarkness',0],['defaultGlobalLight',true]]);
    const game={version:"12.343",user:{isGM:true},system:{grid:{distance:2,units:'m'}},folders:[],scenes:new Map(),settings:{get:(_id,key)=>values.get(key)}};
    const foundry={utils:{getProperty:(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object)}};
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
      async createThumbnail(){return {thumb:'thumbnail'}}
      async update(changes){
        (globalThis.sceneOperations??=[]).push({id:this.id,kind:'update',data:structuredClone(changes)});
        if(globalThis.failOverrides){globalThis.failOverrides=false;throw Error('Simulated override rejection')}
        for(const [path,value] of Object.entries(changes)){const keys=path.split('.');let object=this.data;for(const key of keys.slice(0,-1))object=object[key]??={};object[keys.at(-1)]=value;}
        this.name=this.data.name;return this;
      }
      async createEmbeddedDocuments(type,documents){
        (globalThis.sceneOperations??=[]).push({id:this.id,kind:'create:'+type,data:structuredClone(documents)});
        const collection={Tile:'tiles',Token:'tokens',AmbientSound:'sounds'}[type];
        const current=this.data[collection]??=[];
        current.push(...documents.map((document,i)=>({...document,_id:'EmbeddedNew00000'+i})));return documents;
      }
      async updateEmbeddedDocuments(type,updates){
        (globalThis.sceneOperations??=[]).push({id:this.id,kind:'embedded:'+type,data:structuredClone(updates)});
        const collection={Tile:'tiles',Token:'tokens',AmbientSound:'sounds'}[type];
        for(const update of updates){const item=this.data[collection].find(item=>item._id===update._id);for(const [path,value] of Object.entries(update)){if(path==='_id')continue;const keys=path.split('.');let object=item;for(const key of keys.slice(0,-1))object=object[key]??={};object[keys.at(-1)]=value;}}
        return updates;
      }
    }
    const Hooks={on(){}};
  `});
  await page.evaluate(({files,selected})=>{
    globalThis.FilePicker=class {
      activeSource="data";sources={data:{target:"maps"}};
      constructor(options){this.options=options}
      render(){this.options.callback(selected)}
      static async browse(_source,path){return {files,dirs:[]}}
    };
  },{files,selected});
  await page.evaluate(async()=>{const module=await import("/scripts/creator.js");globalThis.openCreator=module.openSceneCreator;module.openSceneCreator();});
  await page.locator('[name="importMode"], [name="variant-0"]').first().waitFor();
  return {page,errors,state:()=>page.evaluate(()=>({scenes:[...game.scenes.values()].map(scene=>scene.data),folders:game.folders.map(folder=>({name:folder.name,parent:folder.folder?.name??null})),notices}))};
}
