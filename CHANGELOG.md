# Changelog

Curated changes to The Library of Babel. Git history contains the full development
record; older entries are grouped milestones rather than released version numbers.

## Unreleased

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
