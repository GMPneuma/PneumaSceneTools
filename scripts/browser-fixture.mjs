import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
// This fixture tests UI contracts. It does not substitute for a live Foundry persistence check.
export async function fixture(browser, {files, imports = {}, selected, video} = {}) {
  const page = await browser.newPage();
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
        const data=this.getData(),template=await (await fetch(this.options.template)).text();
        const root=document.createElement('section');
        root.innerHTML=template.replace('{{{content}}}',data.content).replace('{{failure}}',data.failure).replace('{{label}}',data.label);
        this.element[0]?.remove();this.element=[root];this.form=root.querySelector('form');document.body.append(root);
        this.form.addEventListener('submit',async event=>{
          event.preventDefault();if(this._submitting||!this.form.reportValidity())return;this._submitting=true;
          const submitted=Object.fromEntries(new FormData(this.form));
          for(const input of this.form.querySelectorAll('input[type=checkbox]'))submitted[input.name]=input.checked;
          try{await this._updateObject(event,submitted);}finally{this._submitting=false;}
        });
        this.activateListeners(this.element);
      }
      activateListeners(){}
      async close(){this.element[0]?.remove();}
    }
    const values=new Map([['defaultGrid',100],['defaultDarkness',0],['defaultGlobalLight',true]]);
    const game={user:{isGM:true},system:{grid:{distance:2,units:'m'}},folders:[],scenes:new Map(),settings:{get:(_id,key)=>values.get(key)}};
    const foundry={utils:{getProperty:(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object)}};
    const notices=[];const ui={notifications:{info:message=>notices.push(message),warn:message=>notices.push(message),error:message=>notices.push(message)}};
    class Folder {static async create(data){const folder={...data,id:'folder-'+game.folders.length,folder:game.folders.find(f=>f.id===data.folder)??null};game.folders.push(folder);return folder}}
    class Scene {
      constructor(data){this.data=structuredClone(data)}
      static fromJSON(json){return new this(JSON.parse(json))}
      toObject(){return structuredClone(this.data)}
      getDimensions(){return {sceneX:100,sceneY:100}}
      static async create(data){
        if(globalThis.failCreation){globalThis.failCreation=false;throw Error('Simulated database rejection')}
        const scene=new this(data);scene.id='scene-'+game.scenes.size;scene.name=data.name;
        if(!globalThis.dropPersistence)game.scenes.set(scene.id,scene);
        return scene;
      }
      async createThumbnail(){return {thumb:'thumbnail'}}
      async update(changes){Object.assign(this.data,changes)}
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
  await page.locator('[name="variant-0"]').waitFor();
  return {page,errors,state:()=>page.evaluate(()=>({scenes:[...game.scenes.values()].map(scene=>scene.data),folders:game.folders.map(folder=>({name:folder.name,parent:folder.folder?.name??null})),notices}))};
}
