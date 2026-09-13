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
  ...[17.2, 19, 20.8, 22.6].map((x) => ({ x, depth: 5.299, head: 1 })),
  ...[17.2, 21, 22.8].map((x) => ({ x, depth: 1.401, head: -1 })),
];

/** Top surface rings match the Blender shower tray; height is above the tiled deck. */
export function showerFloorHeight(x: number, depth: number): number {
  const dx = x - (27 + BATH_SHIFT);
  if (dx < -1-1e-8 || dx > .9+1e-8) return 0;
  for (const centre of [1.25, 3.75]) {
    const dy = depth - centre;
    const [lo,hi]=centre===1.25?[-.75,1.2]:[-1.2,1.15];
    if (dy < lo-1e-8 || dy > hi+1e-8) continue;
    if (Math.abs(dx) <= 0.085 && Math.abs(dy) <= 0.085) return 0.0135;
    const rings = [
      [-1,.9,lo,hi,.055],[-.96,.86,lo+.04,hi-.04,.052],
      [-.18,.18,-.18,.18,.044],[-.085,.085,-.085,.085,.008]
    ].map(([x0,x1,y0,y1,h])=>[[x0,y0,h],[x1,y0,h],[x1,y1,h],[x0,y1,h]]);
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
