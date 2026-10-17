export const HAZARD_DEPENDENCY_MESSAGE = "Hazards requires Pneuma Combat Tools. Enable Combat Tools and reload Foundry.";

export function hazardsAvailable(): boolean {
  return game.modules?.get("pneuma-combattools")?.active === true;
}

export function requireHazards(): void {
  if (!hazardsAvailable()) throw Error(HAZARD_DEPENDENCY_MESSAGE);
}
