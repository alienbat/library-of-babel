/** Shared authoring/collision dimensions, in metres from the amenity bay origin. */
export const DORM = {
  left: 16,
  right: 24,
  depth: 6.3,
  doorLeft: 18,
  doorRight: 20,
  bathDoorStart: 2.8,
  bathDoorEnd: 4.0,
};
export const BATH_SHIFT = 2;
export const ROOM_VOLUME = { width: 32, depth: 6.5 };
export const DORM_BEDS = [
  ...[17.2, 19, 20.8, 22.6].map((x) => ({ x, depth: 5.1, head: 1 })),
  ...[17.2, 21, 22.8].map((x) => ({ x, depth: 1.7, head: -1 })),
];

/** Top surface rings match the Blender shower tray; height is above the tiled deck. */
export const SHOWER_TRAY_RINGS = [
  [0.825, 0.875, 0.055],
  [0.785, 0.835, 0.052],
  [0.18, 0.18, 0.044],
  [0.085, 0.085, 0.008],
];
export function showerFloorHeight(x: number, depth: number): number {
  const dx = x - (27 + BATH_SHIFT);
  if (Math.abs(dx) > 0.825) return 0;
  for (const centre of [1.25, 3.75]) {
    const dy = depth - centre;
    if (Math.abs(dy) > 0.875) continue;
    if (Math.abs(dx) <= 0.085 && Math.abs(dy) <= 0.085) return 0.0135; // top of grate
    const rings = SHOWER_TRAY_RINGS.map(([w, d, h]) => [
      [-w, -d, h],
      [w, -d, h],
      [w, d, h],
      [-w, d, h],
    ]);
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 4; i++) {
        const a = rings[r][i],
          b = rings[r][(i + 1) % 4],
          c = rings[r + 1][(i + 1) % 4],
          d = rings[r + 1][i];
        for (const [p, q, s] of [
          [a, b, c],
          [a, c, d],
        ]) {
          const denom =
            (q[1] - s[1]) * (p[0] - s[0]) + (s[0] - q[0]) * (p[1] - s[1]);
          const u =
            ((q[1] - s[1]) * (dx - s[0]) + (s[0] - q[0]) * (dy - s[1])) / denom;
          const v =
            ((s[1] - p[1]) * (dx - s[0]) + (p[0] - s[0]) * (dy - s[1])) / denom;
          if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
            return u * p[2] + v * q[2] + (1 - u - v) * s[2];
        }
      }
  }
  return 0;
}
