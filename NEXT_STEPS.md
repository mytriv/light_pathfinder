# Next steps

Updated: 2026-10-14

## Implemented in this work session

- Rechecked the port against the supplied RGSS1 source scripts and map 001 instead of treating the visual start as passable in every direction.
- Extracted RGSS1 reciprocal map passage and character/event collision rules into `src/engine/passability.js`; the runtime now calls this implementation.
- Added `tools/test_passability.js`, which verifies that map 001 start `(15,10)` rejects the down step into an enclosed tile and keeps the three valid directions open.
- Replaced the held-key Set with a single current direction plus a one-step buffer in `src/engine/input.js`, preventing stale earlier keys from resurfacing after a direction change.
- Added `tools/test_input.js` for taps, direction replacement, release, and buffered movement.
- Fixed title startup to accept a single mouse click, show a distinct loading screen, prevent overlapping map loads, and resolve already-failed or delayed image requests instead of waiting indefinitely.
- Updated port status documents with the source evidence and the regression result.

## Files changed

- `app.js`
- `src/engine/passability.js`
- `src/engine/input.js`
- `tools/test_passability.js`
- `tools/test_input.js`
- `index.html`
- `PORT_STATUS.md`
- `docs/PORTING_STATUS.md`
- `NEXT_STEPS.md`

## Checks executed

- `node --check app.js`, `node --check src/engine/passability.js`, `node --check src/engine/input.js`, `node --check tools/test_passability.js`, and `node --check tools/test_input.js`: passed.
- `node tools/test_passability.js`: passed against the original map 001 and XP passage flags.
- `node tools/test_input.js`: passed; changing directions then releasing does not restore the first direction.
- `node --check app.js`: passed after the title startup fix; first-click behavior still needs an in-browser manual check.
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
