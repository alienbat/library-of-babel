# Local validation record

13 September 2026, Codex in-app browser, WebGL2, 1248 × 520, both canvases with antialiasing.
The comparison renders five warmup frames per engine/view, reads RGBA framebuffer pixels,
and compares RGB values directly (not screenshots or perceptual similarity scores).

| Preset | Maximum channel difference (0–255) | Pixels differing by more than 8 |
|---|---:|---:|
| Fresh arrival | 0 | 0% |
| Shelf detail | 0 | 0% |
| Adjacent floor | 0 | 0% |
| Shelf transition | 0 | 0% |
| Chasm up | 0 | 0% |
| Chasm down | 0 | 0% |
| Bottom left | 0 | 0% |
| Bottom right | 0 | 0% |
| Top left | 0 | 0% |
| Top right | 0 | 0% |
| Stair up | 0 | 0% |
| Rebased arrival | 0 | 0% |
| Bottom stair | 0 | 0% |
| Top stair | 0 | 0% |
| Bedroom | 0 | 0% |
| Bathroom | 0 | 0% |

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
