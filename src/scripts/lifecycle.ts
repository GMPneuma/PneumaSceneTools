import {MODULE_ID} from "./settings.js";
interface Feature {
  name: string;
  register(): object | void;
  ready(): Promise<unknown>;
}
const features: Feature[] = [];
const initialized: Feature[] = [];
export function registerFeature(feature: Feature) { features.push(feature); }
const supported = () => game.system?.id === "cyberpunk-red-core" && Number(game.release?.generation) === 12;
function report(name: string, error: unknown) {
  console.error(`${MODULE_ID} | ${name}`,error);
  ui.notifications?.error(`SceneTools: ${name} failed. See the console.`);
}
Hooks.once("init", () => {
  if (!supported()) return;
  const module = game.modules?.get(MODULE_ID) as unknown as {api?: object} | undefined;
  for (const feature of features) {
    try {
      const api = feature.register();
      if (module && api) Object.assign(module.api ??= {},api);
      initialized.push(feature);
    } catch (error) { report(feature.name+" registration",error); }
  }
});
Hooks.once("ready", async () => {
  if (!supported()) return;
  await Promise.all(initialized.map(async feature=>{
    try { await feature.ready(); }
    catch (error) { report(feature.name+" startup",error); }
  }));
});
