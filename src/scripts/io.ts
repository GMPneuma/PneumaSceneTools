/** Bound reads even when the underlying Foundry browse API cannot abort its request. */
export function bounded<T>(work: Promise<T>, signal: AbortSignal, milliseconds = 15000): Promise<T> {
  return new Promise((resolve,reject)=>{
    const finish = (callback: () => void) => { clearTimeout(timer); signal.removeEventListener("abort",abort); callback(); };
    const abort = () => finish(()=>reject(signal.reason ?? new Error("Cancelled")));
    const timer = setTimeout(()=>finish(()=>reject(new Error("Read timed out. Narrow the folder or retry."))),milliseconds);
    signal.addEventListener("abort",abort,{once:true});
    work.then(value=>finish(()=>resolve(value)),error=>finish(()=>reject(error)));
    if (signal.aborted) abort();
  });
}
