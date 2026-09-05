// Dimensions are metres. The corridor and chasm follow Peck's description.
export const GAP = 30.48;
export const INNER = GAP / 2;
export const OUTER = INNER + 3.6576;
export const HEIGHT = 3.96;
export const BAY = 22.86;
export const PERIOD = BAY * 12;
export const EYE = 1.68;
export const RADIUS = 0.22;
export type Position = { x: number; y: number; z: number };
export const mod = (n: number, d: number) => ((n % d) + d) % d;
export function floorAt(x: number, z: number, previousY: number): number {
  const t = mod(x, PERIOD);
  if (Math.abs(z) > OUTER + 0.48 && t >= 4 && t <= 12) {
    const ramp = (t - 4) / 8 * HEIGHT;
    return Math.round((previousY - ramp) / HEIGHT) * HEIGHT + ramp;
  }
  return Math.round(previousY / HEIGHT) * HEIGHT;
}
export function allowed(x: number, z: number): boolean {
  const a = Math.abs(z), t = mod(x, PERIOD);
  if (a < INNER + RADIUS || a > OUTER + 5 - RADIUS) return false;
  // Stairs sit behind the shelves. Their side wall prevents stepping off mid-flight.
  if (a <= OUTER - RADIUS) {
    // Food kiosk, set back from the rail.
    return !(t > 17.4 - RADIUS && t < 18.3 + RADIUS && a < INNER + 1.3 + RADIUS);
  }
  if (t > 1 + RADIUS && t < 15 - RADIUS) {
    if (a > OUTER + 3.7 - RADIUS) return false;
    if (t > 4 && t < 12 && a < OUTER + 0.5 + RADIUS) return false;
    return true;
  }
  // Dormitory doorway and room, with solid bed furniture.
  if (t > 16 + RADIUS && t < 22 - RADIUS) {
    if (a < OUTER + 0.3 && !(t > 18 && t < 20)) return false;
    for (let i = 0; i < 4; i++) {
      if (t > 16.3 + i * 1.4 - RADIUS && t < 17.3 + i * 1.4 + RADIUS && a > OUTER + 2.7 - RADIUS) return false;
    }
    for (let i = 0; i < 3; i++) {
      if (t > 16.3 + [0,3.5,4.7][i] - RADIUS && t < 17.3 + [0,3.5,4.7][i] + RADIUS && a < OUTER + 2 + RADIUS) return false;
    }
    return true;
  }
  return false;
}
export function move(p: Position, dx: number, dz: number): Position {
  let { x, y, z } = p;
  // Substeps prevent tunnelling through shelves at low frame rates.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps;
    if (allowed(nx, z)) {
      const ny = floorAt(nx, z, y);
      if (Math.abs(ny - y) < 0.18) { x = nx; y = ny; }
    }
    const nz = z + dz / steps;
    if (allowed(x, nz)) {
      const ny = floorAt(x, nz, y);
      if (Math.abs(ny - y) < 0.18) { z = nz; y = ny; }
    }
  }
  return { x, y, z };
}
