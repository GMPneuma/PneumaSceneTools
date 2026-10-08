import test from "node:test";
import assert from "node:assert/strict";
import {bounded} from "../dist/scripts/io.js";
test("stalled reads time out, cancel promptly, and ignore late completion",async()=>{
  const stalled=new Promise(()=>{});
  await assert.rejects(bounded(stalled,new AbortController().signal,5),/timed out/);
  const abort=new AbortController();let finish;
  const waiting=bounded(new Promise(resolve=>finish=resolve),abort.signal);
  abort.abort(new Error("cancelled"));
  await assert.rejects(waiting,/cancelled/);finish("late");
  assert.equal(await bounded(Promise.resolve("next"),new AbortController().signal),"next");
});

test("cancelling media preparation releases handlers and its source",async()=>{
 const {imageDimensions}=await import("../dist/scripts/scene-import.js");let media;
 globalThis.HTMLVideoElement=class {};
 globalThis.Image=class {constructor(){media=this} removeAttribute(){this.src=""}};
 const controller=new AbortController();const loading=imageDimensions("map.webp",controller.signal);
 controller.abort(new Error("closed"));await assert.rejects(loading,/closed/);
 assert.equal(media.onload,null);assert.equal(media.onerror,null);assert.equal(media.src,"");
});
