export interface HitPointStats {
  body: number;
  will: number;
}

export function getStatsForHitPoints(hitPoints: number): HitPointStats | null {
  if (hitPoints < 20 || hitPoints > 50 || hitPoints % 5 !== 0) return null;
  const body = hitPoints / 5 - 2;
  const will = body - 1;
  if (body > 8 || will > 8) return null;
  return { body, will };
}
