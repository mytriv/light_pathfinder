# Next steps

Updated: 2026-10-14

## Implemented in this work session

- Rechecked the port against the supplied RGSS1 source scripts and map 001 instead of treating the visual start as passable in every direction.
- Extracted RGSS1 reciprocal map passage and character/event collision rules into `src/engine/passability.js`; the runtime now calls this implementation.
- Added `tools/test_passability.js`, which verifies that map 001 start `(15,10)` rejects the down step into an enclosed tile and keeps the three valid directions open.
- Updated port status documents with the source evidence and the regression result.

## Files changed

- `app.js`
- `src/engine/passability.js`
- `tools/test_passability.js`
- `index.html`
- `PORT_STATUS.md`
- `docs/PORTING_STATUS.md`
- `NEXT_STEPS.md`

## Checks executed

- `node --check app.js`, `node --check src/engine/passability.js`, and `node --check tools/test_passability.js`: passed.
- `node tools/test_passability.js`: passed against the original map 001 and XP passage flags.
- `python tools/validate_project.py` using the bundled Python runtime: passed. 23 JSON files, nine maps, and 889 indexed media references resolve; all 29 distinct map command codes have dispatch cases.
- `git diff --check`: passed.
- Full browser input and story playthrough remain unverified; the previous automated browser control was unreliable.

## Known incomplete work

- Event commands 224, 225, 337, and 339 still have explicit diagnostic no-op behavior; other dispatched commands also need full RGSS-compatible semantics and automated progression tests.
- Battle formulas, elements, states, targeting, troop event pages, and reward rules remain approximations.
- Equipment, shop, status, and party menus remain incomplete.
- Saving uses a single localStorage JSON save and does not yet validate versions robustly or migrate `.rxdata` files.
- Full story playthrough, visual fidelity, and GitHub Pages deployment have not been verified.

## Exact next implementation task

Use the source event-command inventory to port the currently explicit no-op commands (`224`, `225`, `337`, `339`) to RGSS1 semantics. Add focused tests and remove each command from the unsupported list only after its behavior is implemented and verified.

## Run commands

From `Light_Pathfinder_HTML5/`:

```powershell
python tools/validate_project.py
node --check app.js
python start-local.py
```

On Windows, `start-local.bat` launches the same local HTTP server.
