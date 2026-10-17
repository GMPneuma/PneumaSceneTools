import {MODULE_ID} from "../settings.js";
import {hazardsAvailable} from "./dependency.js";
let queue: Promise<unknown> = Promise.resolve();
export function enqueue(work: () => Promise<unknown>): Promise<unknown> {
  queue = queue.catch(() => {}).then(() => hazardsAvailable() ? work() : undefined).catch(error => {console.error(`${MODULE_ID} | Hazards`, error); ui.notifications?.error(`Hazards: ${error instanceof Error ? error.message : String(error)}`);});
  return queue;
}
