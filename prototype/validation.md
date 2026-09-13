# Local validation record

13 September 2026, Codex in-app browser, WebGL2, 1248 × 520, both canvases with antialiasing.
The comparison renders five warmup frames per engine/view, reads RGBA framebuffer pixels,
and compares RGB values directly (not screenshots or perceptual similarity scores).

| Preset           | Maximum channel difference (0–255) | Pixels differing by more than 8 |
| ---------------- | ---------------------------------: | ------------------------------: |
| Fresh arrival    |                                  0 |                              0% |
| Shelf detail     |                                  0 |                              0% |
| Adjacent floor   |                                  0 |                              0% |
| Shelf transition |                                  0 |                              0% |
| Chasm up         |                                  0 |                              0% |
| Chasm down       |                                  0 |                              0% |
| Bottom left      |                                  0 |                              0% |
| Bottom right     |                                  0 |                              0% |
| Top left         |                                  0 |                              0% |
| Top right        |                                  0 |                              0% |
| Stair up         |                                  0 |                              0% |
| Rebased arrival  |                                  0 |                              0% |
| Bottom stair     |                                  0 |                              0% |
| Top stair        |                                  0 |                              0% |
| Bedroom          |                                  0 |                              0% |
| Bathroom         |                                  0 |                              0% |

Shader compilation errors: Three 0, Babylon 0. In this run all 16 presets were pixel-identical.
This verifies sampled viewpoints on this browser/GPU, not all camera positions or browsers.
The rebased preset exercises both horizontal and vertical local-origin shifts.

## Commands

- `npm run check:babylon`: pass (strict prototype typecheck and scoped lint).
- `npx tsc --noEmit`: pass (main application's TypeScript project).
- `npm test`: 65 pass, 0 fail.
- `npm run build`: pass, including production book-worker URL verification.
- `git diff --check`: pass.
- Baseline `npm run lint` on unchanged main still reports an unbound-method finding at
  `tests/location-store.test.ts:13`; that unrelated test was not changed.

The main worktree remains clean at `e34a2b74d83e19d472d3b02e425b183f467ac0c5`.
Prototype timing measurements and limitations are in README.md.

## Static AO and cached section queries

Repeated the same 16-view RGB comparison with baked room AO enabled in both engines
and section occlusion enabled only in Babylon. All 16 maximum channel differences
were **0**; shader errors were **0**. This includes every corner, top/bottom stairs,
room interiors, and the view that shifts both local coordinate origins.

The stationary bathroom view discarded 145 hidden sections / 49,890 instances:
submitted triangles fell from 2,954,125 to 2,121,013 without changing a pixel.
Query draws settled to zero after visibility was established. These counts describe
submitted geometry, not a guaranteed proportional reduction in GPU time.

Prototype typecheck, scoped lint, main typecheck, and whitespace checks passed.
The application source and production site were not changed by this experiment.

## Repeat after other GPU workloads were stopped

Final AO texture implementation: visibility is baked into the existing irradiance
texture layout, with independent texture Sources so toggling cannot modify the
original lighting. An isolated CPU regression check verified unchanged original
pixels, darker alternate pixels, and correct on/off texture selection. Bathroom
on/off screenshots were inspected. The effect is deliberately subtle.

The final 16-view comparison again produced zero RGB differences and zero shader
errors with AO on in both engines and occlusion on only in Babylon.

GPU medians in milliseconds, 1248 × 520, WebGL2. Each cell lists forward-order /
reverse-order passes; each mode had 80 warmup frames and 30 measured samples.
These supersede the earlier timings taken while another GPU workload may have run.

| View          | Three         | Babylon       | Babylon + occlusion |
| ------------- | ------------- | ------------- | ------------------- |
| Fresh arrival | 13.71 / 13.79 | 18.16 / 18.41 | 18.16 / 17.89       |
| Shelf detail  | 8.98 / 8.88   | 11.97 / 11.80 | 11.69 / 11.72       |
| Stair up      | 3.21 / 3.18   | 3.84 / 3.84   | 3.58 / 3.62         |
| Top right     | 8.82 / 8.86   | 9.47 / 9.33   | 9.32 / 9.45         |
| Bathroom      | 13.99 / 14.11 | 19.35 / 19.11 | 18.76 / 18.60       |

Occlusion improves the stationary stair GPU time by about 6% and bathroom by about
3%; the other gains are small or within variation. It remains off by default.
Babylon remains slower than the reference in these samples. These are GPU timing
comparisons, not frame-rate promises; CPU submission and live-camera invalidation
still matter. Final prototype/scoped lint, main typecheck and diff checks passed.
