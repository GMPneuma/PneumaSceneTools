/** Match nested/dotted updates and Foundry deletion keys without inspecting unrelated state. */
export function changesSeatFields(changes: object, fields: readonly string[]): boolean {
  const visit = (value: object, prefix = ""): boolean => Object.entries(value).some(([key, child]) => {
    const path = `${prefix}${key}`.split(".").map(part => part.startsWith("-=") ? part.slice(2) : part).join(".");
    if (fields.some(field => path === field || path.startsWith(`${field}.`))) return true;
    if (!fields.some(field => field.startsWith(`${path}.`))) return false;
    if (child && typeof child === "object" && !Array.isArray(child) && Object.keys(child).length) return visit(child, `${path}.`);
    return true;
  });
  return visit(changes);
}

export const SEAT_GEOMETRY_FIELDS = ["x", "y", "rotation", "width", "height", "elevation", "sort", "lockRotation", "texture.src", "texture.scaleX", "texture.scaleY", "texture.anchorX", "texture.anchorY"];
export const VEHICLE_SEAT_FIELDS = [...SEAT_GEOMETRY_FIELDS, ...["vehicleFootprint", "vehicleSeats", "vehicleSeatLayouts", "vehicleSeatDefault"].map(key => `flags.pneuma-scenetools.${key}`)];
export const PASSENGER_SEAT_FIELDS = [...SEAT_GEOMETRY_FIELDS, "flags.pneuma-scenetools.vehicleSeat"];

export function refreshAffectsSeats(flags: Record<string, unknown> | undefined): boolean {
  return Boolean(flags && ["refresh", "redraw", "refreshTransform", "refreshPosition", "refreshRotation", "refreshSize", "refreshMesh"].some(key => flags[key]));
}
