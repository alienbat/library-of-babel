# Development and validation

See the [README](../README.md#run-locally) for installation and player controls.
Node.js 22.13 or newer is required. Dependencies are locked; use `npm ci`.

## Checks

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The build checks that the production book-worker URL resolves correctly. Full lint
has a known pre-existing unbound-method finding in `tests/location-store.test.ts`;
report it separately rather than hiding new warnings or claiming full lint passes.

For geometry/material changes, use the actual WebGL scene fixture:

```sh
npm run test:scene
```

Open the printed local URL. Check fresh arrival, shelf transitions, views up/down
the chasm, every corner, both galleries, and top/bottom stairs. The pixel-comparison
controls compare existing stair culling on/off; they are not an image-quality score.
Run browser checks in addition to Node tests. Safari and Chrome have previously
exposed different worker/graphics issues, so test both when changing those paths.

When benchmarking, stop other GPU workloads, warm each view, measure more than once
and reverse comparison order. Distinguish CPU submission, GPU time and actual frame
rate. Do not generalize a single-device result into an engine-wide speed claim.

## Build and hosting

`npm run dev` starts the development server. `npm run build` produces the application
and worker output. `npm run start` runs Wrangler against the built server config.
Hosting configuration lives in `.openai/hosting.json` and the build/tooling files;
merging a PR does not itself establish that a production deployment happened.

## Optional browser integration

The engine registers `read_walk_state`, `pause_walk` and `reset_walk` when the
optional WebMCP interface is available. These are not required to play; live WebMCP
integration has not been comprehensively verified.

## Technical history

See [CHANGELOG.md](../CHANGELOG.md) for curated milestones and Git history for exact
changes. The Babylon experiment remains isolated on `prototype/babylon-renderer`.
