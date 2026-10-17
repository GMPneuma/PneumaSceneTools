import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,channel:process.env.PNEUMA_BROWSER_CHANNEL});
try {
  const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("https://vehicle.test/**",async route=>{
    const path=new URL(route.request().url()).pathname.replace(/^\/modules\/pneuma-scenetools\//,"");
    if(path==="/")return route.fulfill({contentType:"text/html",body:'<html><body><div id="stage"><div id="footprint"><div id="vehicle"></div></div><div id="token-hud"><div class="col middle"></div></div></div></body></html>'});
    await route.fulfill({contentType:path.endsWith(".js")?"text/javascript":"text/plain",body:await readFile(resolve("dist",path))});
  });
  await page.goto("https://vehicle.test/");
  await page.addScriptTag({content:await readFile("node_modules/handlebars/dist/handlebars.js","utf8")});
  await page.addStyleTag({content:await readFile("dist/styles/pneuma-scenetools.css","utf8")});
  await page.addStyleTag({content:`body{background:#181c20;color:#ddd;font:14px Arial}#stage{position:relative;width:550px;height:700px}#footprint{position:absolute;width:200px;height:300px;border:1px dashed #777}#vehicle{position:absolute;width:200px;height:300px}#vehicle:before{content:'FRONT';position:absolute;left:27.5%;top:8.33%;width:45%;height:83.33%;text-align:center;padding-top:30px;box-sizing:border-box;background:#606d79;border-radius:30px 30px 10px 10px}#token-hud{position:absolute;left:140px;top:600px}.control-icon{border:1px solid #777;text-align:center;cursor:pointer}.dialog{position:absolute;left:580px;top:50px;width:360px;background:#303438;padding:15px}.form-group,.form-fields,.flexrow{display:flex;gap:8px}.form-group{margin:12px 0}.form-group label{flex:1}input{width:90px}button{margin:5px 0}.marker{position:absolute;width:16px;height:16px;border:2px solid white;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}`});
  await page.evaluate(async()=>{
    const ID="pneuma-scenetools";
    window.$=input=>{
      let nodes;if(typeof input==="string"){const holder=document.createElement("div");holder.innerHTML=input;nodes=[holder.firstElementChild];}else nodes=Array.isArray(input)?input:[input];
      const wrapper={length:nodes.length,find(selector){return $([...nodes.flatMap(node=>[...node.querySelectorAll(selector)])]);},append(child){for(const node of nodes)for(let i=0;i<child.length;i++)node.append(child[i]);return wrapper;},on(names,callback){for(const node of nodes)for(const name of names.split(" "))node.addEventListener(name,callback);return wrapper;}};
      nodes.forEach((node,i)=>wrapper[i]=node);return wrapper;
    };
    window.Hooks={events:new Map(),on(name,fn){const list=this.events.get(name)??[];list.push(fn);this.events.set(name,list);},off(name,fn){this.events.set(name,(this.events.get(name)??[]).filter(value=>value!==fn));},fire(name,...args){return (this.events.get(name)??[]).map(fn=>fn(...args));}};
    window.foundry={utils:{getProperty:(object,path)=>path.split(".").reduce((value,key)=>value?.[key],object)}};
    window.game={user:{id:"gm",isGM:true},paused:false};window.notices=[];
    window.ui={notifications:{error:message=>notices.push(message),warn:message=>notices.push(message)}};
    window.renderTemplate=async(path,data)=>Handlebars.compile(await(await fetch("/"+path)).text())(data);
    window.Dialog=class {
      constructor(data){this.data=data;}
      render(){this.element=document.createElement("div");this.element.className="dialog";this.element.innerHTML=`<h2>${this.data.title}</h2>${this.data.content}`;document.body.append(this.element);this.data.render($(this.element));return this;}
      bringToTop(){}async close(){this.element.remove();this.data.close();}
    };
    window.PIXI={Graphics:class {
      constructor(){this.element=document.createElement("div");this.element.className="marker";this.position={set:(x,y)=>{this.element.style.left=x+"px";this.element.style.top=y+"px";}};}
      lineStyle(){return this;}drawCircle(){return this;}moveTo(){return this;}lineTo(){return this;}
      destroy(){if(this.destroyed)throw Error("double destroy");this.destroyed=true;this.element.remove();}
    }};
    const scene={id:"scene",documentName:"Scene",grid:{size:100,type:0},tokens:new Map()};
    window.canvas={scene,tokens:{addChild(marker){document.querySelector("#stage").append(marker.element);}}};
    window.token={id:"vehicle",uuid:"Scene.scene.Token.vehicle",parent:scene,isOwner:true,lockRotation:false,x:100,y:200,width:2,height:3,rotation:0,
      flags:{[ID]:{CreatedByVehicleTools:true,vehicleFootprint:{width:2,height:3}}},object:{visible:true,getSize:()=>({width:token.width*100,height:token.height*100})},writes:[],
      async update(change,options={}) {
        if(Hooks.fire("preUpdateToken",this,change,options,game.user.id).includes(false))return;
        if(window.failSave){window.failSave=false;throw Error("Save failed");}
        for(const [key,value] of Object.entries(change)) {
          if(key.startsWith("flags."))this.flags[ID][key.split(".").at(-1)]=value;else this[key]=value;
        }
        this.writes.push(change);window.paint();Hooks.fire("updateToken",this);return this;
      },
    };
    scene.tokens.set(token.id,token);
    window.PrimarySpriteMesh=class {resize(w,h,options) {const scale=Math.min(w/200,h/300);this.width=200*scale*options.scaleX;this.height=300*scale*options.scaleY;}};
    window.libWrapper={register(_id,path,wrapper) {const parts=path.split(".");const key=parts.pop();const object=parts.reduce((value,key)=>value[key],window);const original=object[key];object[key]=function(...args){return wrapper.call(this,original.bind(this),...args);};}};
    token.object.document=token;token.object.mesh=new PrimarySpriteMesh();token.object.mesh.object=token.object;

    window.paint=()=>{const footprint=document.querySelector("#footprint");footprint.style.left=token.x+"px";footprint.style.top=token.y+"px";footprint.style.width=token.width*100+"px";footprint.style.height=token.height*100+"px";
      token.object.mesh.resize(token.width*100,token.height*100,{fit:"contain",scaleX:1,scaleY:1});
      const art=document.querySelector("#vehicle");art.style.width=token.object.mesh.width+"px";art.style.height=token.object.mesh.height+"px";art.style.left=(token.width*100-token.object.mesh.width)/2+"px";art.style.top=(token.height*100-token.object.mesh.height)/2+"px";
      document.querySelector("#vehicle").style.transform=`rotate(${token.rotation}deg)`;};paint();
    const runtime=await import("/modules/pneuma-scenetools/scripts/vehicle-rotation.js");runtime.registerVehicleRotation();
    window.hud={object:{document:token}};
    Hooks.fire("renderTokenHUD",hud,$(document.querySelector("#token-hud")));
    Hooks.fire("renderTokenHUD",hud,$(document.querySelector("#token-hud")));
  });
  assert.equal(await page.locator(".pneuma-vehicle-rotation").count(),0);
  await page.evaluate(async()=>token.update({rotation:token.rotation+15}));await page.waitForFunction(()=>token.rotation===15);
  await page.evaluate(async()=>token.update({rotation:token.rotation-5}));await page.waitForFunction(()=>token.rotation===10);
  await page.evaluate(async()=>token.update({rotation:token.rotation+15}));await page.waitForFunction(()=>token.rotation===25);
  await page.evaluate(async()=>{const {openVehiclePivot}=await import("/modules/pneuma-scenetools/scripts/vehicle-rotation-ui.js");await openVehiclePivot(token);});await page.waitForSelector(".marker");
  assert.equal(await page.locator('[name="pivotY"]').inputValue(),"75");
  await page.locator('[name="pivotY"]').fill("60");
  assert.equal(await page.evaluate(()=>token.flags["pneuma-scenetools"].vehiclePivot),undefined);
  await page.locator('[data-action="cancel"]').click();assert.equal(await page.locator(".marker").count(),0);
  await page.evaluate(async()=>{const {openVehiclePivot}=await import("/modules/pneuma-scenetools/scripts/vehicle-rotation-ui.js");await openVehiclePivot(token);});await page.waitForSelector(".marker");
  await page.locator('[data-action="center"]').click();await page.evaluate(()=>window.failSave=true);
  await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('[role="alert"]').textContent.includes("Save failed"));
  assert.equal(await page.locator(".dialog").count(),1);
  await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector(".dialog"));
  assert.deepEqual(await page.evaluate(()=>token.flags["pneuma-scenetools"].vehiclePivot),{x:0.5,y:0.5});
  const position=await page.evaluate(()=>({x:token.x,y:token.y}));
  await page.evaluate(async()=>token.update({rotation:token.rotation+15}));await page.waitForFunction(()=>token.rotation===40);
  assert.deepEqual(await page.evaluate(()=>({x:token.x,y:token.y})),position);
  const artwork=await page.evaluate(()=>({width:token.object.mesh.width,height:token.object.mesh.height}));
  const center=await page.evaluate(()=>({x:token.x+token.width*50,y:token.y+token.height*50}));
  await page.evaluate(async()=>token.update({rotation:token.rotation+15}));await page.waitForFunction(()=>token.rotation===55);
  assert.deepEqual(await page.evaluate(()=>({width:token.width,height:token.height})),{width:3,height:2});
  assert.deepEqual(await page.evaluate(()=>({width:token.object.mesh.width,height:token.object.mesh.height})),artwork);
  assert.deepEqual(await page.evaluate(()=>({x:token.x+token.width*50,y:token.y+token.height*50})),center);
  await page.evaluate(async()=>{await token.update({rotation:90});});
  const footprintBox=await page.locator("#footprint").boundingBox(),artBox=await page.locator("#vehicle").boundingBox();
  assert.ok(Math.abs(footprintBox.width-302)<0.01);assert.ok(Math.abs(footprintBox.height-202)<0.01);
  assert.ok(Math.abs(artBox.width-300)<0.01);assert.ok(Math.abs(artBox.height-200)<0.01);
  await page.screenshot({path:"docs/vehicle-footprint-preview.png"});
  await page.evaluate(async()=>{await token.update({rotation:135});});
  assert.deepEqual(await page.evaluate(()=>({width:token.width,height:token.height})),{width:2,height:3});
  assert.deepEqual(await page.evaluate(()=>({width:token.object.mesh.width,height:token.object.mesh.height})),artwork);
  await page.evaluate(async()=>{const {openVehiclePivot}=await import("/modules/pneuma-scenetools/scripts/vehicle-rotation-ui.js");await openVehiclePivot(token);});await page.waitForSelector(".marker");
  await page.evaluate(()=>Hooks.fire("deleteToken",token));assert.equal(await page.locator(".marker").count(),0);assert.equal(await page.locator(".dialog").count(),0);
  assert.equal(await page.evaluate(()=>["updateToken","deleteToken","canvasTearDown"].reduce((count,key)=>count+(Hooks.events.get(key)?.length??0),0)),0);
  await page.evaluate(()=>{
    token.parent.grid.type=1;Object.assign(token,{x:100,y:200,width:2,height:3,rotation:0});paint();
    document.querySelector(".pneuma-vehicle-rotation")?.remove();Hooks.fire("renderTokenHUD",hud,$(document.querySelector("#token-hud")));
  });
  assert.equal(await page.locator('[data-action="pivot"]').count(),0);
  for(const [angle,width,height] of [[15,2,3],[30,2,3],[45,3,3],[60,3,2],[75,3,2],[90,3,2]]) {
    await page.evaluate(async()=>token.update({rotation:token.rotation+15}));await page.waitForFunction(angle=>token.rotation===angle,angle);
    assert.deepEqual(await page.evaluate(()=>({x:token.x,y:token.y,width:token.width,height:token.height})),{x:100,y:200,width,height});
    assert.deepEqual(await page.evaluate(()=>({width:token.object.mesh.width,height:token.object.mesh.height})),artwork);
  }
  await page.evaluate(()=>{document.querySelector(".pneuma-vehicle-rotation")?.remove();token.flags={};Hooks.fire("renderTokenHUD",hud,$(document.querySelector("#token-hud")));});
  assert.equal(await page.locator(".pneuma-vehicle-rotation").count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>notices),[]);
  console.log("Vehicle rotation browser fixture passed: no rotation HUD buttons, native turns, pivot preview, cancel, save/retry, center rotation, footprint cutoffs, constant rendered artwork size, and marker/hook cleanup.");
} finally {await browser.close();}
