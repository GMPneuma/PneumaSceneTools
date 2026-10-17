import {isVideo} from "./matching.js";

export interface TileThumbnail {width:number; height:number; src:string}
const entries=new Map<string,TileThumbnail>();
const cacheName="pneuma-modular-thumbnails-v1";
const key=(path:string)=>new URL(path,document.baseURI).href;
async function cache():Promise<Cache|undefined>{
  try{return await globalThis.caches?.open(cacheName);}catch{return undefined;}
}
export function tileThumbnail(path:string):TileThumbnail|undefined{return entries.get(path);}
export async function clearTileThumbnails(paths:string[]):Promise<void>{
  const store=await cache();
  for(const path of paths){entries.delete(path);await store?.delete(key(path));}
}
/** Small stills persist in this browser; original dimensions travel with each cached thumbnail. */
export async function loadTileThumbnail(path:string,signal:AbortSignal):Promise<TileThumbnail>{
  const existing=entries.get(path);if(existing)return existing;
  const store=await cache(),saved=await store?.match(key(path));
  if(saved){const result=await saved.json() as TileThumbnail;entries.set(path,result);return result;}
  signal.throwIfAborted();
  const video=isVideo(path),media=video?document.createElement('video'):new Image();
  media.crossOrigin='anonymous';
  if(media instanceof HTMLVideoElement){media.muted=true;media.playsInline=true;media.preload='auto';media.disablePictureInPicture=true;}
  try{
    await new Promise<void>((resolve,reject)=>{
      const finish=(error?:unknown)=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);media.onload=null;media.onerror=null;if(media instanceof HTMLVideoElement)media.onloadeddata=null;error?reject(error):resolve();};
      const abort=()=>finish(signal.reason??new Error('Thumbnail canceled'));
      const timeout=setTimeout(()=>finish(new Error('Thumbnail timed out')),20000);
      signal.addEventListener('abort',abort,{once:true});
      media.onerror=()=>finish(new Error('Unable to load tile thumbnail'));
      if(media instanceof HTMLVideoElement)media.onloadeddata=()=>finish();else media.onload=()=>finish();
      media.src=path;
    });
    signal.throwIfAborted();
    const width=media instanceof HTMLVideoElement?media.videoWidth:media.naturalWidth;
    const height=media instanceof HTMLVideoElement?media.videoHeight:media.naturalHeight;
    if(!width||!height)throw new Error('Invalid tile dimensions');
    const scale=Math.min(1,160/Math.max(width,height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Unable to draw tile thumbnail');
    context.drawImage(media,0,0,canvas.width,canvas.height);
    const result={width,height,src:canvas.toDataURL('image/webp',0.75)};
    if(store)try{await store.put(key(path),new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}}));}catch{/* Browser quota may limit persistence; session thumbnails remain usable. */}
    entries.set(path,result);return result;
  }finally{
    if(media instanceof HTMLVideoElement)media.pause();
    media.removeAttribute('src');if(media instanceof HTMLVideoElement)media.load();
  }
}
