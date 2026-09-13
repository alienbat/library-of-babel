# Architecture

The Library of Babel uses Three.js for rendering, React for the interface and Vinext
for the existing application build. A separate Vite static entry in `static/` reuses
the same game for GitHub Pages, including its module worker; no server is required.
See [static hosting](GITHUB_PAGES.md). The production renderer is Three.js. The separate
`prototype/babylon-renderer` branch is an unmerged experiment, not a runtime option.

## Source map

| Area                                    | Source                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Menus, reader and settings              | `app/page.tsx`, `components/game/`                                               |
| Renderer, input, audio and lifecycle    | `lib/game/engine.ts`                                                             |
| Repeated architecture and furnishings   | `lib/game/world.ts`                                                              |
| Dimensions, collision, flight and falls | `lib/game/physics.ts`, `lib/game/stairs.ts`                                      |
| Shelf selection and distant appearance  | `lib/game/shelf-lod.ts`                                                          |
| Global book identity and search         | `lib/game/global-books.ts`, `lib/game/search.ts`, `lib/game/portable-books.ts`   |
| Compact persistent address references   | `lib/game/location-store.ts`                                                     |
| Gallery/room/boundary light baking      | `lib/game/lighting.ts`, `room-lighting.ts`, `baked-light-field.ts`, `boundary-lighting.ts` |
| Distant horizon                         | `lib/game/horizon.ts`                                                            |
| Stair visibility                        | `lib/game/landing-occlusion.ts`                                                  |

Paths without a directory in the lighting row are also under `lib/game/`.

## Books and global addresses

The [README](../README.md#the-library-we-model) defines the alphabet, book length
and exact global dimensions. The v2 generator maps the complete canonical book
ordinal to its content through two reversible triangular base-95 permutations.
Each per-digit multiplier is invertible modulo 95. This is a bijection, not a
finite hash seed: all 95^1,312,000 possible contents occur exactly once.

Do not change v2 permutation constants or rules without introducing a new book
version. A content change also affects search inversion and saved locations.

Every twelfth section contains amenities rather than books. One partially occupied
floor is placed at floor(F / 3), keeping both terminal floors complete. Storage
rows are permuted around that partial floor; surplus slots are rejected. Both
sides, shelf row and book index contribute to the ordinal.

A frame holds an exact anchor and arbitrary-precision floor/section offsets.
New journeys use a seeded interior origin. Search destinations can use a persistent
reference to an exact address. Debug destinations anchor to actual boundaries;
original arrival returns to the journey’s starting region. Display labels are not
identity keys. Changing a local reference frame must never change a book’s content
or move its opened/bookmarked state to a different book.

The renderer recenters around 4 km horizontally or 2 km vertically. Exact global
arithmetic runs in the worker; the render loop uses small local coordinates. Native
BigInt radix conversions are divided into bounded chunks for browser compatibility;
GMP/WASM handles the large arithmetic where appropriate.

## Search and navigation

Prefix search accepts 1–3,200 printable ASCII characters. It completes the remaining
characters deterministically, inverts the v2 mapping and converts the resulting
ordinal to an exact location. It finds one match without scanning the collection;
it does not find the nearest match and does not change shelf contents.

Text-file search removes tabs and pads source lines with spaces to the next 80-character book line (preserving blank lines), validates the
allowed characters, then truncates or pads with spaces to 1,312,000 characters.
Validation happens before truncation. An empty file therefore finds the all-space
book. The file is processed in the browser, not sent to a book-search server.

Navigation subtracts exact addresses in the worker, sending the renderer a unit
direction and logarithmic distance, or a nearby local point. The HUD shows metres
below 1 km, kilometres below 1 light year, then light years, using scientific
notation as needed. It reports straight-line distance, not walking-route length.
At enormous distances ordinary movement may not change the rounded display.

## Progress and storage

Progress is local to the browser, with no account sync. The journey record includes
its frame, local position, view, flight/fall state, lifetime distance, artificial
elapsed time and first-entry timestamp. Autosave runs every five minutes; explicit
save and certain lifecycle/actions also request saves. Page-exit saves are best
effort, not a guarantee against browser termination.

Local storage holds lightweight journey/history/bookmark metadata. IndexedDB holds
exact large location records; compact references are used by bookmarks and frames.
Uploaded source text is not needed in new saved references after its book is found.
An exact location can still require substantial storage: a compact reference does
not make the underlying enormous address disappear. Browser quotas, eviction,
private browsing and storage availability vary. There is no cloud backup.

A bookmark has one user-supplied name and page per book. Re-saving updates that
bookmark. Opened history colors visited books using their global identity. A
book’s complete contents are cached in worker memory for page turns, not saved as
a page corpus. Legacy readers remain for old formats; they do not define the
current write format.

Journey distance includes normal movement and planned walking, but not debug
teleports. LEVEL is relative to the current local destination reference. Elapsed
library time combines real time since first entry (including offline time) with
artificial planned-walk time. Planned walks use 365-day years, ten hours of walking
per day and exact address arithmetic; boundaries truncate travel and elapsed time.
Vertical destinations align to a gallery floor within one floor height.

## Geometry, shelf LOD and horizon

Instanced geometry represents a moving detail window. Distant repeated structures
use much cheaper batches. The window can translate vertically during flight;
book identity and detailed shelf cells are tracked separately.

Whole shelf bays receive individual books, horizontal boards and plain backing
within a 12 m distance to their bounds, with selection snapped to a 1 m grid.
This selection uses 3D distance, including adjacent floors. Further shelves use a
shared atlas and a cheap 6 cm analytical relief layer out to 500 m, blending at
450–500 m and earlier when board edges become subpixel. It is not a 500 m sphere
of individual book meshes.

A full-screen background triangle supplies the extreme-distance gallery appearance.
Opaque screen-door coverage hands geometry over around 3.5–6.5 km. Projected floor
spacing also controls the handover. There is no atmospheric fog or extra walkable
geometry behind this background.

A 513-entry half-float profile (4,104 bytes) integrates 512 vertical phases of the
repeated deck/rail/shelf cross-section. It uses the actual six-sided rail silhouette
and baked illumination. Pixel-footprint filtering blends unresolved floors in
linear light, including rays parallel to the galleries; four directional samples
handle the limiting pixel. Horizontal textures and lighting are averaged. This is
a geometric-optics approximation, not full light transport or infinite meshes.

Corner boundaries clip both meshes and the analytic horizon. Floor/ceiling planes
stop inside gallery edges, with clipping beyond visible deck faces to avoid
coplanar flicker. Boundary finish patterns remain visible beyond the geometry
window. The existing conservative stair visibility system suppresses hidden
geometry without changing visible pixels in the tested views.

## Static lighting and sound

MeshBasicMaterial with custom shader hooks samples precomputed diffuse irradiance.
Offline Blender Cycles bakes six directional luminance lobes with six diffuse
bounces and zero world illumination. Gallery and room fields use separate repeating
cells, including top, bottom and final-flight stair variants. No room AO multiplier
is applied over the Cycles results. See [the bake workflow](CYCLES_LIGHTING.md) for
resolution, transport approximations and regeneration instructions.

Boundary lamps use nearby instanced housings/lenses and a repeated 32 × 32 field
with separate floor, ceiling and wall channels. Wall directions and instructions
share an atlas projected
onto wall faces. Fixtures remain self-lit. There are no real-time scene lights,
moving shadows or screen-space AO passes.

Materials, furnishings and these bakes are approximations. The mirror panel is
not a reflection camera. Procedural audio provides footsteps and falling wind;
no microphone or camera input is requested.
