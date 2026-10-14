# Next steps

Updated: 2026-10-14

## Implemented in this work session

- Audited the existing HTML5 runtime, exported maps/database, asset inventory, original RPG Maker XP data, and available Ruby script references.
- Added `PORT_STATUS.md` with a feature-by-feature compatibility matrix, evidence, known gaps, checks, and a prioritized continuation plan.
- Added `.nojekyll` and documented the compatibility matrix in `README.md`.
- Extended `tools/validate_project.py` to check map transfers, battle troop references, and interpreter dispatch coverage for every command code present in the nine exported maps.
- Changed unsupported event commands from silent skips to once-per-source-command console diagnostics containing map ID, event ID, page number, command index, code, and parameters. The source location is captured before event transfers so subsequent logs retain the correct origin.

## Files changed

- `app.js`
- `tools/validate_project.py`
- `PORT_STATUS.md`
- `NEXT_STEPS.md`
- `.nojekyll`
- `README.md`

## Checks executed

- `python tools/validate_project.py` using the bundled Python runtime: passed. 23 JSON files, nine maps, nine map-info records, and 889 indexed media paths; current map tileset/autotile/character assets and literal map/troop references resolve; all 29 distinct exported event command codes have a dispatch case.
- `node --check app.js` using the bundled Node runtime: passed.
- Local HTTP browser smoke test: attempted at `http://127.0.0.1:8000/`; unavailable because the sandbox denies socket access (`Invoke-WebRequest` reports “forbidden by its access permissions”; browser reports connection timeout). UI gameplay therefore remains unverified in this environment.

## Known incomplete work

- Event commands 224, 225, 337, and 339 still have explicit diagnostic no-op behavior; other dispatched commands also need full RGSS-compatible semantics and automated progression tests.
- Battle formulas, elements, states, targeting, troop event pages, and reward rules remain approximations.
- Equipment, shop, status, and party menus remain incomplete.
- Saving uses a single localStorage JSON save and does not yet validate versions robustly or migrate `.rxdata` files.
- Full story playthrough, visual fidelity, and GitHub Pages deployment have not been verified.

## Exact next implementation task

Implement and unit-test versioned browser save slots with schema validation and safe recovery from malformed or outdated localStorage data. Keep the existing save key readable through an explicit migration path and document that RPG Maker XP `.rxdata` saves remain unsupported unless a tested converter is added.

## Run commands

From `Light_Pathfinder_HTML5/`:

```powershell
python tools/validate_project.py
node --check app.js
python start-local.py
```

On Windows, `start-local.bat` launches the same local HTTP server.
