import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
const runtime = process.env.PNEUMA_PLAYWRIGHT_MODULE;
if (!runtime) throw new Error("Set PNEUMA_PLAYWRIGHT_MODULE to a Playwright ESM module URL.");
const {chromium} = await import(runtime);
const browser = await chromium.launch({headless:true,...(process.env.PNEUMA_BROWSER_CHANNEL ? {channel:process.env.PNEUMA_BROWSER_CHANNEL} : {})});
try {
  const page = await browser.newPage(), errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.setContent("<html><body>Video fixture</body></html>");
  // Generate valid fixture media without accessing external files or services.
  const bytes=[...execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-f","lavfi","-i","color=c=gray:s=160x120:r=5","-t","0.6","-c:v","libvpx","-f","webm","pipe:1"],{maxBuffer:1024*1024})];
  const videoCheck=await page.evaluate(async bytes=> {
    const video=document.createElement("video"), url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"video/webm"}));
    const result=await new Promise(resolve=>{video.onloadedmetadata=()=>resolve({width:video.videoWidth});video.onerror=()=>resolve({error:video.error?.message});video.src=url;});
    URL.revokeObjectURL(url);return result;
  },bytes);
  assert.equal(videoCheck.width,160,`Generated video must be valid: ${JSON.stringify(videoCheck)} (${bytes.length} bytes)`);
  const root="maps/Eatery", image=n=>`${root}/SOL-CorporateEateryInt-Map${n}-128px-4k.webp`;
  const video=n=>`${root}/SOL-CorporateEateryInt-Map${n}-128px-VTT4k.webm`;
  const overlay=(n,animated=false)=>`${root}/SOL-CorporateEateryInt-Map${n}-OVERLAY-128px-${animated ? "VTT4k.webm" : "4k.webp"}`;
  const json=n=>`${root}/FoundryScenes/fvtt-Scene-corporate-eatery-interior-floor-${n}-${n===1 ? "BwEiKlwvnmTponYX" : "mGUminkAD0MB4hn5"}.json`;
  const files=[image(1),video(1),overlay(1),overlay(1,true),image(2),video(2),overlay(2),overlay(2,true)];
  const exports=Object.fromEntries([1,2].map(n=>[json(n),{name:`Corporate Eatery Interior Floor ${n}`,width:4000,height:3000,background:{src:image(n)},grid:{type:1,size:128,distance:2,units:"m"},walls:[{c:[n,0,n+10,10]}],lights:[]} ]));
  await page.route("https://scene.test/**",async route=> {
    const path=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    if(path.startsWith("scripts/")) return route.fulfill({contentType:"text/javascript",body:await readFile(resolve("dist",path),"utf8")});
    if(path.endsWith(".json")) return route.fulfill({contentType:"application/json",body:JSON.stringify(exports[path])});
    if(path.endsWith(".webm")) {
      const data=Buffer.from(bytes), range=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
      if(range){const start=Number(range[1]),end=range[2] ? Math.min(Number(range[2]),data.length-1) : data.length-1;return route.fulfill({status:206,contentType:"video/webm",headers:{"accept-ranges":"bytes","content-range":`bytes ${start}-${end}/${data.length}`},body:data.subarray(start,end+1)});}
      return route.fulfill({contentType:"video/webm",headers:{"accept-ranges":"bytes"},body:data});
    }
    if(path.endsWith(".webp")) return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000"><rect width="4000" height="3000" fill="#555"/></svg>'});
    return route.fulfill({contentType:"text/html",body:"<html><body></body></html>"});
  });
  await page.goto("https://scene.test/");
  await page.evaluate(async({root,files,jsonPaths,selected})=> {
    const once=new Map(),defaults=new Map();window.createdScenes=[];
    window.Application=class {};window.FormApplication=class {};
    window.Hooks={once:(name,fn)=>once.set(name,fn),on:()=>{}};
    window.game={user:{isGM:true},folders:[],system:{grid:{distance:2,units:"m"}},settings:{register:(_id,key,config)=>defaults.set(key,config.default),get:(_id,key)=>defaults.get(key)}};
    window.Folder={create:async data=>{const folder={...data,id:`folder-${game.folders.length}`};window.game.folders.push(folder);return folder;}};
    window.ui={notifications:{info:()=>{},warn:()=>{},error:message=>{window.failure=message;}}};
    window.Dialog=class {
      constructor(data){this.data=data;}
      submit(button,event){button.callback?.(this.element,event);this.close();}
      render(){this.element=document.createElement("section");this.element.innerHTML=`<h2>${this.data.title}</h2>${this.data.content}<button data-button="next">Next</button><button data-button="cancel">Cancel</button>`;document.body.append(this.element);this.element.querySelector('[data-button="cancel"]').onclick=()=>this.close();this.element.querySelectorAll("[data-button]").forEach(button=>button.onclick=event=>this.submit(this.data.buttons[button.dataset.button],event));this.element.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();this.submit(this.data.buttons[this.data.default]);}});this.data.render(this.element);}
      close(){this.element.remove();this.data.close();}
    };
    window.FilePicker=class {
      activeSource="data";sources={data:{target:root}};
      constructor(options){this.options=options;}
      render(){if(this.options.type!=="imagevideo") throw new Error("Picker must support videos");this.options.callback(selected);}
      static async browse(_source,path){return path===root ? {files,dirs:[`${root}/FoundryScenes`]} : {files:jsonPaths,dirs:[]};}
    };
    window.Scene=class {
      constructor(data){this.data=data;}
      static fromJSON(text){return new this(JSON.parse(text));}
      toObject(){return this.data;}
      getDimensions(){return {sceneX:100,sceneY:100};}
      static async create(data){window.createdScenes.push(structuredClone(data));return {name:data.name,sheet:{render:()=>{}},createThumbnail:async()=>({thumb:"thumb"}),update:async()=>{}};}
    };
    await import("/scripts/main.js");once.get("init")();
    const {openSceneCreator}=await import("/scripts/creator.js");openSceneCreator();
  },{root,files,jsonPaths:[json(1),json(2)],selected:image(1)});
  await page.locator('[name="allVariants"]').waitFor();
  assert.equal(await page.locator('[name="variant-1"]').isChecked(),true);
  assert.equal(await page.locator('[name="variant-0"]').isChecked(),false);
  assert.equal(await page.locator('[name="static-1"]').inputValue(),image(1));
  assert.equal(await page.locator('[name="static-2"]').inputValue(),image(2));
  await page.locator('[name="allVariants"]').check();
  await page.locator('[name="bothMedia"]').check();
  assert.equal(await page.locator('[name="mode-1"]').inputValue(),"both");
  assert.equal(await page.locator('[name="mode-2"]').inputValue(),"both");
  await page.locator('[data-button="next"]').click();
  for(let i=0;i<4;i++) {
    try { await page.waitForFunction(()=>document.querySelector('[name="gridChoice"]') || window.failure);assert.equal(await page.evaluate(()=>window.failure),undefined); }
    catch(error) { console.log(await page.evaluate(()=>({failure:window.failure,count:window.createdScenes.length,html:document.body.innerText})));throw error; }
    assert.match(await page.locator('[name="name"]').inputValue(),new RegExp(`Floor ${i<2 ? 1 : 2} \\(${i%2 ? "Animated" : "Static"}\\)`));
    await page.locator('[data-button="next"]').click();
    await page.locator('[name="overlay-0"]').waitFor();
    assert.equal(await page.locator("[data-overlay]").count(),2);
    await page.locator(`[name="overlay-${i%2}"]`).check();
    await page.locator('[data-button="next"]').click();
    await page.waitForFunction(count=>window.createdScenes.length===count || window.failure,i+1);
  }
  const result=await page.evaluate(()=>({scenes:window.createdScenes,failure:window.failure}));
  assert.equal(result.failure,undefined);assert.deepEqual(errors,[]);
  assert.deepEqual(result.scenes.map(scene=>scene.background.src),[image(1),video(1),image(2),video(2)]);
  assert.deepEqual(result.scenes.map(scene=>scene.walls[0].c[0]),[1,1,2,2]);
  assert.deepEqual(result.scenes.map(scene=>scene.tiles[0].texture.src),[overlay(1),overlay(1,true),overlay(2),overlay(2,true)]);
  // With no JSON, related map layouts still support bulk selection and cancellation.
  await page.evaluate(async files=> {
    window.FilePicker.browse=async()=>({files,dirs:[]});
    const {openSceneCreator}=await import("/scripts/creator.js");openSceneCreator();
  },files);
  await page.locator('[name="allVariants"]').waitFor();
  assert.equal(await page.locator("[data-plan]").count(),2);
  await page.locator('[name="allVariants"]').check();
  await page.locator('[name="bothMedia"]').check();
  assert.equal(await page.locator('[name="variant-0"]').isChecked(),true);
  assert.equal(await page.locator('[name="variant-1"]').isChecked(),true);
  assert.equal(await page.locator('[name="mode-0"]').inputValue(),"both");
  assert.equal(await page.locator('[name="mode-1"]').inputValue(),"both");
  await page.locator('[data-button="cancel"]').click();
  assert.equal(await page.evaluate(()=>window.createdScenes.length),4);
  console.log("Browser fixture: both floor variants, static + animated scenes, real video metadata, and matching overlays passed.");
} finally {await browser.close();}
