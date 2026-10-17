import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:process.env.PNEUMA_BROWSER_CHANNEL});
try{
 const page=await browser.newPage();let originals=0,videoBytes;
 await page.route('https://thumb.test/**',async route=>{
  const path=new URL(route.request().url()).pathname.slice(1);
  if(path.startsWith('scripts/'))return route.fulfill({contentType:'text/javascript',body:await readFile(resolve('dist',path))});
  if(path==='tile.svg'){originals++;return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="2000"><rect width="4000" height="2000" fill="red"/></svg>'});}
  if(path==='clip.webm')return route.fulfill({contentType:'video/webm',body:videoBytes});
  if(path==='broken.png')return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:'text/html',body:'<html><body></body></html>'});
 });
 await page.goto('https://thumb.test');
 const first=await page.evaluate(async()=>{
  const {loadTileThumbnail}=await import('/scripts/modular-thumbnails.js');
  const result=await loadTileThumbnail('tile.svg',new AbortController().signal);
  const img=new Image();img.src=result.src;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);
  return {width:result.width,height:result.height,thumbWidth:img.width,thumbHeight:img.height,red:canvas.getContext('2d').getImageData(50,30,1,1).data[0],src:result.src};
 });
 assert.deepEqual([first.width,first.height,first.thumbWidth,first.thumbHeight],[4000,2000,160,80]);assert.ok(first.red>240);assert.equal(originals,1);
 await page.reload();
 const cached=await page.evaluate(async()=>{const m=await import('/scripts/modular-thumbnails.js');return m.loadTileThumbnail('tile.svg',new AbortController().signal);});
 assert.equal(cached.src,first.src);assert.equal(originals,1,'Reload must use persisted thumbnail and dimensions without loading the original');
 await page.evaluate(async()=>{const m=await import('/scripts/modular-thumbnails.js');await m.clearTileThumbnails(['tile.svg']);await m.loadTileThumbnail('tile.svg',new AbortController().signal);});
 assert.equal(originals,2,'Explicit Refresh regenerates the thumbnail');
 videoBytes=Buffer.from(await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=320;document.body.append(canvas);const ctx=canvas.getContext('2d');ctx.fillStyle='lime';ctx.fillRect(0,0,640,320);
  const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
  const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]);});
  recorder.start();for(let i=0;i<5;i++){ctx.fillStyle=i%2?'lime':'green';ctx.fillRect(0,0,640,320);stream.getVideoTracks()[0].requestFrame();await new Promise(resolve=>setTimeout(resolve,200));}recorder.stop();const bytes=await done;stream.getTracks().forEach(track=>track.stop());return bytes;
 }));
 const video=await page.evaluate(async()=>{const m=await import('/scripts/modular-thumbnails.js');const result=await m.loadTileThumbnail('clip.webm',new AbortController().signal);const img=new Image();img.src=result.src;await img.decode();return {width:result.width,height:result.height,tw:img.width,th:img.height};});
 assert.deepEqual(video,{width:640,height:320,tw:160,th:80});
 assert.equal(await page.evaluate(async()=>{const m=await import('/scripts/modular-thumbnails.js');try{await m.loadTileThumbnail('broken.png',new AbortController().signal);return false;}catch{return m.tileThumbnail('broken.png')===undefined;}}),true,'A failed thumbnail never falls back to the full original');
 console.log('Thumbnail browser checks passed: 4000px image becomes 160px, rendered pixels, persistent cache across reload, explicit regeneration, video still and failed media.');
}finally{await browser.close();}
