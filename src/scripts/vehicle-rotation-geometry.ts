export interface VehiclePivot {x: number; y: number}
export interface VehiclePose {x: number; y: number; width: number; height: number; rotation: number}
export interface VehicleSize {width: number; height: number}

/** Nearest cardinal orientation: tick at 45, 135, 225 and 315 degrees. */
export function vehicleFootprintSwapped(angle: number): boolean {
  return Math.floor((normalizeRotation(angle) + 45) / 90) % 2 === 1;
}

export function vehicleFootprintSize(base: VehicleSize, angle: number): VehicleSize {
  return vehicleFootprintSwapped(angle) ? {width: base.height, height: base.width} : {...base};
}

/** 15-degree steps: 0/15/30 stay rectangular, 45 is diagonal, 60/75/90 are sideways. */
export function vehicleGridFootprintSize(base: VehicleSize, angle: number): VehicleSize {
  const step = Math.floor((normalizeRotation(angle) + 7.5) / 15) % 24;
  if (step % 6 === 3) {
    const side = Math.ceil(Math.max(base.width, base.height));
    return {width: side, height: side};
  }
  return vehicleFootprintSize(base, angle);
}

/** Fractions of the unrotated token footprint, including transparent padding. */
export const DEFAULT_VEHICLE_PIVOT: Readonly<VehiclePivot> = {x: 0.5, y: 0.75};

export function vehiclePivot(value: unknown): VehiclePivot {
  const pivot = value as Partial<VehiclePivot> | undefined;
  if (!pivot || typeof pivot.x !== "number" || typeof pivot.y !== "number"
    || !Number.isFinite(pivot.x) || !Number.isFinite(pivot.y)
    || pivot.x < 0 || pivot.x > 1 || pivot.y < 0 || pivot.y > 1) return {...DEFAULT_VEHICLE_PIVOT};
  return {x: pivot.x, y: pivot.y};
}

export function normalizeRotation(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function vehiclePivotPosition(pose: VehiclePose, pivot: VehiclePivot): {x: number; y: number} {
  const angle = normalizeRotation(pose.rotation) * Math.PI / 180;
  const x = (pivot.x - 0.5) * pose.width;
  const y = (pivot.y - 0.5) * pose.height;
  return {
    x: pose.x + pose.width / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    y: pose.y + pose.height / 2 + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

/** Keep the chosen artwork point stationary while changing the native token angle. */
export function pivotedVehicleRotation(pose: VehiclePose, pivot: VehiclePivot, angle: number): {x: number; y: number; rotation: number} {
  if (![pose.x, pose.y, pose.width, pose.height, pose.rotation, angle].every(Number.isFinite)
    || pose.width <= 0 || pose.height <= 0) throw new Error("Vehicle rotation requires valid token dimensions and coordinates.");
  const rotation = normalizeRotation(angle);
  const before = vehiclePivotPosition(pose, pivot);
  const after = vehiclePivotPosition({...pose, rotation}, pivot);
  return {x: pose.x + before.x - after.x, y: pose.y + before.y - after.y, rotation};
}
