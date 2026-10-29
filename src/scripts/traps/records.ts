import { hazardsAvailable, requireHazards } from "./dependency.js";
import { MODULE_ID } from "../settings.js";
import { activeGM } from "../netarch/templates.js";
import { validateTrap, type TrapConfig, type Point } from "./model.js";
export function gm(): void { requireHazards(); if (!game.user?.isGM)
  throw Error("Only a GM can manage hazards."); }
/** Scene flag records store hazards independently from optional native Regions. */
export class SceneHazard {
  readonly documentName = "SceneToolsHazard";
  constructor(readonly parent: Scene, readonly id: string) { }
  get uuid(): string { return `${this.parent.uuid}.SceneToolsHazard.${this.id}`; }
  get config(): TrapConfig | undefined { return sceneHazardData(this.parent)[this.id]; }
  get elevation() { return this.parent.regions.get(this.config?.triggerRegionId ?? "")?.elevation ?? { bottom: null, top: null }; }
}
export type Hazard = SceneHazard;
function sceneHazardData(scene: Scene): Record<string, TrapConfig> { return foundry.utils.getProperty(scene, `flags.${MODULE_ID}.hazards`) as Record<string, TrapConfig> ?? {}; }
export function sceneHazard(scene: Scene, id: string): SceneHazard { return new SceneHazard(scene, id); }
export async function updateTrap(d: Hazard, changes: Record<string, unknown>): Promise<void> {
  const prefix = `flags.${MODULE_ID}.hazards.${d.id}`;
  const updates = Object.fromEntries(Object.entries(changes).map(([key, value]) => [`${prefix}.${key}`, value]));
  const result = await d.parent.update(updates as Scene.UpdateData);
  // Native no-diff updates may return undefined; verify the saved values instead.
  const config=d.config;
  const retained = !!config && Object.entries(changes).every(([key, value]) =>
    key.split('.').at(-1)?.startsWith('-=')
      ? foundry.utils.getProperty(config, key.replace(/(^|\.)-=/, '$1')) === undefined
      : JSON.stringify(foundry.utils.getProperty(config, key)) === JSON.stringify(value));
  if (!retained) throw Error(result ? "Foundry did not retain the hazard changes. Your draft is still in the editor." : "Hazard save was cancelled before the changes were stored. Your draft is still in the editor.");
}
export const authority = () => hazardsAvailable() && !!game.user?.isGM && activeGM()?.id === game.user.id;
export function trapData(d: Hazard): TrapConfig | undefined {
  const t = d instanceof SceneHazard ? d.config : undefined;
  if(!t)return;
  try{return { ...validateTrap(t), minElevation: d.elevation.bottom ?? -1e7, maxElevation: d.elevation.top ?? 1e7 };}
  catch(error){throw Error(`Hazard "${t.name||d.id}" on scene "${d.parent.name}": ${error instanceof Error?error.message:String(error)}`);}
}
export const traps = (scene: Scene): Hazard[] => Object.keys(sceneHazardData(scene)).map(id => new SceneHazard(scene, id));
export const hazardForRegion = (region: RegionDocument): Hazard | undefined => traps(region.parent!).find(hazard => hazard.config?.triggerRegionId === region.id);
export const findHazard = (scene: Scene, id: string): Hazard | undefined => traps(scene).find(d => d.id === id);
export async function resolveHazard(uuid: string): Promise<Hazard | null> {
  const match = /^Scene\.([^.]+)\.SceneToolsHazard\.([^.]+)$/.exec(uuid);
  if (match) {
    const scene = game.scenes?.get(match[1]!);
    return scene ? findHazard(scene as Scene, match[2]!) ?? null : null;
  }
  return null;
}
export const center = (t: TokenDocument): Point => ({ x: t.x + (t.width ?? 1) * (t.parent?.grid.size ?? 100) / 2, y: t.y + (t.height ?? 1) * (t.parent?.grid.size ?? 100) / 2 });
export const TRAP_BEHAVIOR = "pneuma-scenetools.trap";
export const regionPosition = (d: RegionDocument): Point => {
  const object = canvas.scene?.id === d.parent?.id ? canvas.regions?.get(d.id!) : undefined;
  if (!object)
    throw Error("Open the hazard's scene before placing a hazard actor.");
  return object.center;
};
/** Regions supply geometry; the Scene record owns all hazard configuration. */
export const triggerRegion = (d: Hazard, t = trapData(d)!) => d.parent.regions.get(t.triggerRegionId);
export const effectRegion = (d: Hazard, t = trapData(d)!) => triggerRegion(d, t);
