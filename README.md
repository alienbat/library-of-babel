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
- **Esc:** pause and release the mouse.
- **Settings:** field of view, sensitivity, walking motion, detail, return to arrival.
- Touch devices have directional buttons and drag-to-look.

To find the nearest stairs from arrival, walk left along the gallery for approximately 20 metres. Enter either end of the stair passage behind the shelving; walk along the flight to change levels. Follow the same passage back to descend. Levels are relative to arrival.

## Modeling notes

The text describes 12-foot corridors, 4-foot brown-red pipe railings, gray carpet, a 100-foot chasm, matching floors, identical light-brown bindings with gilt page edges, and periodic rest areas with seven beds, clocks, and food kiosks. These guide the model. Reference: [story text](https://studylib.net/doc/28486607/pudge), arrival and first book examination passages.

Stair layout, fixtures, precise shelf construction, and lighting are interpretations. The game fixes the time at daytime, omits bathroom interiors, and keeps players behind railings. The finite but unthinkably large library is represented by a moving window of repeated geometry; there is no reachable end, top, or bottom in this prototype. Distant books use a patterned facade; nearby books are individual volumes. Books and kiosks cannot be used.

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
