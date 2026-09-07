# The Babel Library

A first-person walking game inspired by Steven L. Peck’s *A Short Stay in Hell*. Built in this directory with Three.js, React, and Vinext. No external art assets, book interactions, or characters.

## Play locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open the local address printed by the server. Click **Enter the library** to capture the mouse. If the browser cannot capture it, click and drag to look instead.

- **WASD:** walk; **Shift:** walk faster.
- **Mouse:** look; arrow keys also turn and tilt the view.
- **Space:** toggle flight. In flight, W/S follow your gaze (including up/down); A/D strafe. Shift flies faster. Toggle flight off to fall; toggle it back on to stop falling.
- **Esc:** pause and release the mouse.
- **Settings:** field of view, sensitivity, walking motion, detail, return to arrival.
- Touch devices have directional buttons and drag-to-look.

To find the nearest stairs from arrival, walk left along the gallery for approximately 20 metres. Enter either end of the stair passage behind the shelving; walk along the flight to change levels. Follow the same passage back to descend. Levels are relative to arrival.

## Modeling notes

The text describes 12-foot corridors, 4-foot brown-red pipe railings, gray carpet, a 100-foot chasm, matching floors, identical light-brown bindings with gilt page edges, and periodic rest areas with seven beds, clocks, and food kiosks. These guide the model. Reference: [story text](https://studylib.net/doc/28486607/pudge), arrival and first book examination passages.

Stair layout, fixtures, precise shelf construction, and lighting are interpretations. The game fixes the time at daytime, includes bathrooms attached to the seven-bed sleeping rooms, and keeps walking players behind railings; flight can cross above them. The finite but unthinkably large library is represented by a moving window of repeated geometry; there is no reachable end, top, or bottom in this prototype. Distant books use a patterned facade; nearby books are individual volumes. Kiosks cannot be used. Books can be selected and read.

## Project structure

- `app/page.tsx`: game menu, settings, and controls.
- `lib/game/engine.ts`: rendering, input, audio, and game loop.
- `lib/game/world.ts`: generated library architecture and furnishings.
- `lib/game/physics.ts`: dimensions, collision, and stair movement.
- `tests/movement.test.ts`: movement and collision integration checks.

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The optional WebMCP interface exposes `read_walk_state`, `pause_walk`, and `reset_walk` when supported. No supporting browser validation context was available during implementation; these optional tools have not been verified in a live WebMCP browser.

The production build and movement tests are checked. Interactive browser/rendering QA has not been performed; performance depends on the device. Lower detail reduces rendering resolution. Procedural textures and sound are generated locally; no microphone or camera is used.

Flight uses 8 m/s, or 24 m/s with Shift. Gravity uses quadratic drag approaching 120 mph (53.64 m/s), the speed recalled in the story. Landing restores walking; the open chasm has no reachable bottom. The repeating geometry is reused during vertical travel.

Bathrooms include two showers, a sink and soap pump, a full-length polished mirror panel, and a screened toilet with paper. The toilet and precise layout are interpretations; fixtures are scenery and the mirror does not render a live reflection.

Book reading: approach a shelf, aim at a highlighted spine and left-click. Left/right arrows turn one page, stopping at pages 1 and 410. Right-click or Escape returns the book; movement and falling pause while reading. Touch players can use Open book and the reader buttons.

Each page contains 40 lines of 80 printable ASCII characters (95 symbols including space), following Peck's appendix: https://studylib.net/doc/28486607/pudge. The v2 generator uses the complete canonical book ordinal, not a finite hash seed. Two reversible, triangular base-95 permutations scramble all 1,312,000 digits; each per-digit multiplier is invertible modulo 95, so the complete mapping is bijective. Do not change the v2 constants or rules without introducing a new book version.

Global layout: let Q = 95^656000 and N = Q². The exact section count is S = 12 * floor(Q / 2640). Every twelfth section is an amenity section, so books per floor are B = (S / 12) * 11 * 2 * 8 * 570. The floor count is F = ceil(N / B). This gives nearly equal physical width S * 22.86 m and height F * 3.96 m. The partial floor is placed at floor(F / 3), leaving the top and bottom floors complete. Storage rows are permuted around that partial floor; ordinal values from 0 through N-1 each occur exactly once. Empty slots on the partial floor are rejected by the generator.

The absolute origin is the bottom-left. Arrival is permanently anchored at floor(F / 2), section 12 * floor(S / 24); left/right and bottom/top teleports anchor to the actual corresponding boundaries. Symbolic frame expressions in displayed IDs denote exact global addresses; they are not hashes. Equivalent expressions are resolved and compared using their exact arbitrary-precision ordinal in the worker. Local rendering recenters after roughly 4 km horizontally or 2 km vertically, while BigInt section/floor offsets retain the absolute address. HUD level stays relative to the latest teleport. No million-digit coordinate is calculated per frame.

Opened history uses compact global frame expressions in babel-global-opened-v2. History is projected into the current local frame by exact global coordinate subtraction, so corner visits and origin shifts cannot transfer teal marks to unrelated books. Old v1 marks cannot reveal which teleport produced them; they are migrated to the original arrival region. All page contents change once on migration to v2. The worker generates one complete book and caches it for page turns; local checks took about 0.2–1.2 seconds per book. Storage failures leave in-session history available and show a warning. The worker's global identity arithmetic is separate from display IDs and local color-cache keys.

Lighting now uses a reusable 192 KiB directional irradiance volume, generated once when the scene starts. The repeating gallery cell includes ceiling-fixture falloff, six diffuse directions and soft shelf-base darkening. All distances sample the same volume using world coordinates; enclosed rooms use a separate static diffuse approximation. MeshBasicMaterial replaces per-pixel PBR shading, and all nine real-time lights (seven moving point lights plus hemisphere/directional fill) have been removed. Lamps remain self-lit. Fog, geometry LOD, view distance, book atlas mapping and opened-book instance colors remain intact. This is an approximate procedural bake, not ray-traced global illumination or accurate occlusion by every fixture. No device-specific FPS gain has been measured.

The infinite horizon uses one full-screen background triangle with analytic repeating gallery bands, the shelf atlas and baked illumination. Pixel-footprint filtering blends subpixel floors into their coverage-weighted color, including rays parallel to the galleries. Distant meshes hand off over 3.5–6.5 km using opaque screen-door coverage; there is no fog or extra geometry beyond the original window. This backdrop is a visual approximation, not additional walkable geometry. Book interaction and nearby architecture retain their original meshes.

Teleport: press T or the Teleport button to open a destination menu; T or Escape cancels. Bottom-left, bottom-right, top-left and top-right select local visual corner frames, with a solid end wall and a floor or ceiling spanning the chasm. Original arrival restores the unbounded interior and original spawn/view. Every teleport resets LEVEL and distance travelled to zero; subsequent levels and distance are relative to that destination. Cancelling preserves position and counters. The corner boundaries clip all gallery geometry and are also represented in the analytic horizon, so infinite background imagery cannot show through an end wall. Walking, flight and falling respect those boundaries. Absolute book tracking is maintained separately from these local visual frames.

Corner finishes now reuse the gallery carpet and the gallery slab/wall colors. Recessed strips have instanced housings and lenses nearby; their distant pattern and soft illumination are baked into a reusable 64 x 64 light texture. The horizon uses the same surface shader, so corner planes do not revert to flat gray beyond the camera range. The fixtures add no real-time lights. Spanning planes end just inside the gallery edges; vertical clipping cuts are moved outside the visible deck faces to keep top/bottom slabs stable.

Prefix search: pause with Escape and choose **Search library**, enter the exact beginning (1–3,200 printable ASCII characters), then choose **Find a matching book**. Case and spaces matter. This returns one matching book, not a nearest-match search. A deterministic completion supplies the remaining digits, the existing v2 permutation is inverted, and GMP converts that full base-95 ordinal to its exact floor, occupied section, side, row and book. It never changes existing shelf contents or searches by brute force. Native BigInt conversion is limited to 8,192-digit chunks for Safari compatibility.

The target's full address stays in the worker for the current session and survives teleports and floating-origin rebases. Exact subtraction happens there; the renderer receives only a normalized direction and logarithmic distance (or a nearby local point). The HUD rotates its arrow relative to the player's view, describes above/below, and shows two significant figures in light years. This is straight-line guidance, not route planning; ordinary movement at astronomical distances will not visibly change the rounded readout. Clearing the target removes the HUD; reloading clears this session's target. Search does not mark the book as opened. Tests round-trip the full example book through the unchanged forward generator, cover inverse-layout boundary cases, and check navigation across frames. Search, teleport recalculation, clearing, validation, and Safari search were also exercised in the browser.

The clear-air horizon now uses linear-light averages measured from the existing textures and directional light bake. A quotient-rule pixel footprint replaces the arbitrary 10,000 km intersection cap and remains stable when a pixel crosses the direction parallel to both galleries. Four inexpensive directional samples integrate that limiting pixel. Opaque deck coverage and the union of the two front railing silhouettes determine the distant average; rail undersides can dominate upward grazing views, while lit rail tops dominate downward views. This is a geometric-optics approximation to the repeating scene, not a uniform sky colour or a full light-transport simulation. It assumes steady lighting and no atmospheric attenuation. Subpixel geometry hands over according to projected floor spacing as well as distance, preventing unresolved rails from becoming a sharp artificial seam. No additional distant meshes or real-time lights are added. The GPU review fixture includes central-chasm left, right, up, down and oblique views.

Distant LOD v2: the corner wall visibility test now uses the inner deck lip (15.24 m), not the rear shelf plane (18.8976 m), eliminating the 24% silhouette mismatch. A 513-entry half-float lookup replaces the guessed rail-coverage formula. It integrates 512 vertical phases of the repeating deck/rail/shelf cross-section per direction, solving first-hit intersections with the actual six-sided rail profile and applying its surface normals to the existing directional light bake. Horizontal lighting/textures remain averaged; this is a compact cross-section approximation, not a full 3D transport simulation. Distant rail meshes now use that same six-sided profile. Tests compare intersections against Three.js meshes and lookup coverage against 8,192-phase integration. Genuine rail overlap still produces a warm grazing-angle band; it is not artificially desaturated or removed. The lookup occupies 4,104 bytes and is computed once.
