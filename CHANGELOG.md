# Changelog

Curated changes to The Library of Babel. Git history contains the full development
record; older entries are grouped milestones rather than released version numbers.

## Unreleased

- Fit all 570 book slots between shelf uprights without changing book identities. Share spacing across detailed meshes, impostors, picking, highlighting and target navigation.

- Extend end-wall irradiance sampling behind the galleries instead of stretching the chasm-edge sample; increase boundary transverse resolution to 128 samples.

- Remove inter-gallery boundary fixtures and emissive LOD marks. Re-bake boundary surfaces from corridor illumination, repeat end-wall lighting per storey, and clamp lighting across the chasm.

- Centre a half-length gallery light over each shelf unit. Increase Cycles sampling
  and filter residual noise offline; keep irradiance probes outside shelf masses
  and inside room walls to prevent black bands and spots.

- Replace ambient offsets and startup room AO with offline Cycles diffuse
  irradiance fields. Preserve shelf models, book interactions and LODs; use
  separate terminal stairwell/boundary bakes and shared periodic sample planes.
  See [baking workflow and limitations](docs/CYCLES_LIGHTING.md).

- Align gallery door heads with shelf crowns at 3.33 m, and standardize wall
  sign dimensions, text size and alignment. Mount two lights on the top
  stairwell ceiling at the usual landing positions and update the static bake.

- Remove the floating fixture beneath the removed top stair landing. Bake the
  final flight from the top ceiling light, with contact shading from its actual
  geometry instead of repeating the normal stairwell lighting.

- Use “Eternity can wait.” in the pause menu with more button spacing. Remove
  the interior bathroom sign, conceal shelf backing behind flat bedroom walls,
  and place headboards close to the walls while retaining side access.

- Move bathroom toilets back to the wall and extend shower floors to the walls
  and divider edge, with matching walking surfaces, LODs and contact shading.

- Simplify the pause menu by removing secondary taglines, subtitle and credit
  text; centre the single-line masthead beside its mark.

- Bind book and ceiling-light detail to Settings: Low uses 32 m and High 100 m.
  Add a rounded Blender ceiling diffuser throughout galleries and rooms, with
  a shared 12-triangle box LOD and unchanged baked illumination.

- Keep solid timber panels at exposed shelf-run ends in every LOD. Extend real
  book detail from 12 to 32 m; retain the 500 m façade relief range.

- Seal gallery walls to the ceiling, flatten stair frontage, and replace the open
  strips above shelves with matching white wall headers. Update baked contacts
  and distant wall radiance while retaining actual ceiling luminaires.

- Centre the book return beneath the biography exit sign, remove the old fountain,
  and move the food dispenser against the wall. Correct rest-area arrows on both
  galleries and add the food label, with matching collisions and contact shading.

- Add bevelled Blender shelf boards with unchanged dimensions and book capacity,
  an after-hours book-return cabinet, and a park-style BBQ food dispenser. Reuse
  shared spatial LODs and static lighting, with matching return collision bounds.

- Install Blender bathroom fittings: closed-lid toilet, rounded partitions, tissue
  dispenser, basin, shower controls and recessed drains; move the mirror above
  the basin and retain static lighting with spatial LODs.

- Enlarge dormitories to 8 × 6.3 m, separate all seven beds with accessible side
  aisles, and move bathrooms with matching doors, collisions and static lighting.

- Replace dormitory block beds with an original Blender model, shared spatial LODs
  and the existing baked room lighting; include editable source and previews.

- Add a standalone static build for GitHub Pages with subpath-aware assets and book workers.
- Add `deploy:github`, PR build checks and automatic Pages deployment from `main`.

- Standardize The Library of Babel across the game, metadata and documentation.
- Replace the accumulated development README with a project overview, implemented
  dimensions, controls, setup, contribution links and MIT licensing.
- Separate architecture, validation guidance and attribution policy into `docs/`.
- Replace author-name branding, story-specific search examples and narrative prompts
  with independent project wording and a factual publisher-linked inspiration credit.
- Establish feature branches, PR review and owner-approved squash merges.

## Existing main milestones

### Static room lighting

- `b53a740`: port geometry-based room AO into the existing Three.js irradiance textures;
  no added per-frame shader samples or GPU textures. Normal/top variants are cached;
  shifted starts and rebuilds preserve the bake. See [validation notes](docs/static-room-ao.md).
- Preserve the isolated Babylon experiment on `prototype/babylon-renderer`; it is not
  part of the production application.

### Books and persistence

- `e34a2b7`: store exact uploaded-book locations once in IndexedDB and use compact
  references in journey/bookmark records.
- `dcf35ef`, `ee731c3`: use book openings as reader headings and remove displayed IDs
  that stretched the layout.
- `cb84c31`, `8eb9f34`: keep Actions open through native file selection and find books
  from normalized text uploads.
- Earlier work added deterministic global book identity, reversible prefix search,
  bookmarks, target guidance, saved journeys, planned walks and debug teleports.

### Exploration and rendering

- Earlier work added view-directed flight, smooth takeoff, falling with terminal
  velocity and 5g braking, procedural footsteps/wind, and menu controls.
- Gallery and room illumination became static bakes. Room fixtures, beds, bathrooms
  and terminal stairs were refined; wall signage moved into an atlas.
- Absolute-distance shelf LOD, detailed shelf support/backing, conservative stair
  culling and a filtered analytic horizon improved distant rendering without an
  unbounded mesh count. Boundary silhouettes and deck overlap were corrected.

- Limit opened-book tint updates to a fixed 24 m radius independently of shelf detail settings, avoiding whole-window colour refreshes at High detail.

- Apply opened-history changes to individual book colours and buffer ranges; unchanged worker replies no longer refresh nearby shelves.

- Improve shelf impostor matching with recessed-gap/contact shading, independently filtered board silhouettes, and continuous texture coordinates at bay boundaries. Geometry counts and detail radii remain unchanged.

- Show fall speed in km/h with a terminal-velocity indicator, persist Low/High detail preference, and clear all app-owned local-storage keys plus coordinates on Start Over.

- Align shelf uprights with the horizontal board fronts and move guardrails 5 cm onto the deck, including distant rendering and collision clearance.

- Match shelf collision to projecting timber fronts and exposed ends; render at native device pixel ratio on both detail settings, including Retina and display-density changes.

## Modular Blender shelves

- Added repeatable shelf bay, start variant, shared end cap and low-poly rounded-spine books, with editable Blender source and preview.
- Replaced nearby shelf frame batches with one shared module mesh per bay; preserved all book positions, capacity, interactions, and 24 m opened-book tint.
- Use rounded books within 24 m and cheaper box books to the existing Low/32 m or High/100 m cutoff. Retain matching textured distant shelves and infinite horizon; no extra lighting or geometry at long range.

- Extend the top and bottom shelf caps to the outer edges of both end panels, removing the stepped corner at exposed shelf ends.

- Remove unused top/bottom stairwell alcoves, seal their gallery entries, remove redundant partitions/landing floors, and mount/rebake the top stairwell ceiling light. Cull shelf bays beyond library ends to remove stray end panels.
