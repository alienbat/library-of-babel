# GitHub Pages hosting

The game runs entirely in the browser. A separate Vite entry bundles the existing
React interface, Three.js renderer and book worker into `dist/github/`, with no
application server. The existing Vinext/Cloudflare build remains available.

## Build and preview

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run build:github
npm run preview:github
```

Open <http://127.0.0.1:8772/library-of-babel/>. The build checks asset and worker
URLs and includes the bundled GMP notices and source. Its default base path is
`/library-of-babel/`, matching <https://alienbat.github.io/library-of-babel/>.

For another static host serving the game at its root:

```sh
STATIC_BASE_PATH=/ npm run build:github
STATIC_BASE_PATH=/ npm run preview:github
```

Upload the contents of `dist/github/`, preserving directories. Use HTTPS for public
hosting. Browser saves belong to the origin: progress from the previous hosting
address does not migrate to GitHub Pages.

## Deploy

Install the GitHub CLI (`gh`) and authenticate with `gh auth login`. The account
needs access to dispatch Actions and deploy Pages for `alienbat/library-of-babel`.
Initial Pages setup requires repository administration access.

```sh
npm run deploy:github
```

This dispatches `.github/workflows/github-pages.yml` on **remote `main`**, waits for
that specific run and reports its result. It does not publish local edits or the
current feature branch. The workflow must first reach `main` through an approved
PR and squash merge. No credentials are embedded in the static game.

```sh
npm run deploy:github -- --check
npm run deploy:github -- --help
```

`--check` verifies access, the workflow on `main` and the Pages configuration without
starting a deployment. If Pages is absent, the normal deployment command enables
Actions-based Pages. It refuses to replace a conflicting publishing source or
custom domain. A missing workflow or failed Actions run produces a nonzero exit.

The workflow also builds and tests pull requests, without deploying them. Pushes to
`main` automatically deploy after successful tests, type checking and a static
build. GitHub Pages must be configured to use **GitHub Actions** as its publishing
source; this repository has been configured that way. The initial live deployment
occurs after the workflow's PR is approved and merged.

Check the linked Actions run if deployment fails. Only the artifact produced by its
successful build is published; the deployment job has Pages and OIDC permissions.

## Entry points

The site root is a prerendered React landing page (`static/project-page.tsx`), hydrated by `static/landing.tsx`. The game has its own HTML entry at `static/play/index.html`, served at `/library-of-babel/play/`. Both share the same origin and therefore browser storage. `build:github` prerenders the landing HTML after the multi-entry Vite build. The landing module does not import the game.
