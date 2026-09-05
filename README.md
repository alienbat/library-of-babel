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

Each page contains 40 lines of 80 printable ASCII characters (95 symbols including space), following Peck's appendix: https://studylib.net/doc/28486607/pudge. Content is pseudorandom and deterministic, seeded by a versioned location ID and page index. IDs encode relative level, gallery side, shelf (signed bay * 8 + row), and book number. Pages are generated independently, not stored; this finite seeded approximation does not enumerate every possible book in the fictional library. Keep the v1 algorithm unchanged to preserve existing books.

Opened spines turn teal. Their IDs persist in localStorage in this browser; clearing site data clears the color history but never changes the generated text. If storage is unavailable, the reader reports that history lasts only for the session. Nearby instance colors are refreshed when the geometry window moves between floors or bays. Selection uses the exposed spines and rejects shelf gaps, uprights, amenity bays, rear approaches and books beyond 2.2 metres.

Lighting now uses a reusable 192 KiB directional irradiance volume, generated once when the scene starts. The repeating gallery cell includes ceiling-fixture falloff, six diffuse directions and soft shelf-base darkening. All distances sample the same volume using world coordinates; enclosed rooms use a separate static diffuse approximation. MeshBasicMaterial replaces per-pixel PBR shading, and all nine real-time lights (seven moving point lights plus hemisphere/directional fill) have been removed. Lamps remain self-lit. Fog, geometry LOD, view distance, book atlas mapping and opened-book instance colors remain intact. This is an approximate procedural bake, not ray-traced global illumination or accurate occlusion by every fixture. No device-specific FPS gain has been measured.

The infinite horizon uses one full-screen background triangle with analytic repeating gallery bands, the shelf atlas and baked illumination. Pixel-footprint filtering blends subpixel floors into their coverage-weighted color, including rays parallel to the galleries. Distant meshes hand off over 3.5–6.5 km using opaque screen-door coverage; there is no fog or extra geometry beyond the original window. This backdrop is a visual approximation, not additional walkable geometry. Book interaction and nearby architecture retain their original meshes.

Teleport: press T or the Teleport button to open a destination menu; T or Escape cancels. Bottom-left, bottom-right, top-left and top-right select local visual corner frames, with a solid end wall and a floor or ceiling spanning the chasm. Original arrival restores the unbounded interior and original spawn/view. Every teleport resets LEVEL and distance travelled to zero; subsequent levels and distance are relative to that destination. Cancelling preserves position and counters. The corner boundaries clip all gallery geometry and are also represented in the analytic horizon, so infinite background imagery cannot show through an end wall. Walking, flight and falling respect those boundaries. No enormous global coordinate system is introduced; the existing local book IDs and opened-book history are retained.
