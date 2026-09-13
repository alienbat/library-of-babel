# Repository workflow

- For each new feature or fix, create a new branch from current main before editing.
- Make and verify the change, push the branch and open a PR targeting main.
- Do not merge or enable auto-merge until the user explicitly approves that PR.
- After approval, use a squash merge. Never merge prototype/babylon-renderer into main.
- Follow CONTRIBUTING.md for naming, documentation and attribution conventions.

- After creating or updating a Blender model, replace its in-game counterpart in
  the same change. Include the export, shared LODs, static lighting/contact bounds
  and collision updates as needed; rebuild the local static preview last.
