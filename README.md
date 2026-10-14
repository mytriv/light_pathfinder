# Light Pathfinder — HTML5 JavaScript Port

This folder is a first native-JavaScript port of the supplied RPG Maker XP project. It uses the original maps, database records, graphics, and audio, with an editable browser runtime and no external JavaScript dependencies. It is designed for offline play from a local folder (through the included local server) and static hosting such as GitHub Pages.

## Run offline

**Windows:** double-click `start-local.bat` (Python 3 must be installed).

**macOS / Linux:** run `./start-local.sh` or `python3 start-local.py`.

The launcher starts a local HTTP server and opens `http://127.0.0.1:8000`. This works without an internet connection. Serving the project locally is more reliable than opening `index.html` directly, because browsers often block local JSON `fetch()` requests under `file://`.

## Publish on GitHub Pages

The repository publishes directly from the root of its `main` branch. The `.nojekyll` file keeps GitHub Pages from applying Jekyll processing. Relative asset and data URLs also work at the repository's Pages subpath.

GitHub Pages is case-sensitive: do not change the capitalization of `Graphics`, `Audio`, or the original asset filenames.

## Controls

- **Arrow keys / WASD:** move.
- **Enter / Space / Z:** interact and advance dialogue.
- **Escape / X:** open the menu.
- On the title screen, use **up/down** and **Enter**.

The HTML5 build stores save data in the browser's `localStorage`; it does not read the old `Save1.rxdata` / `Save2.rxdata` files automatically. See `PORT_STATUS.md` for the feature compatibility matrix and `docs/PORTING_STATUS.md` for implementation notes.

## Project layout

- `app.js` — editable JavaScript runtime, tile renderer, movement/collision, event interpreter, dialogs/choices, local save state.
- `data/` — RPG Maker XP `.rxdata` data exported into readable JSON, including all nine maps and database records.
- `assets/Graphics/` and `assets/Audio/` — original game asset folders kept intact.
- `asset-index.json` — generated path index for original media files.
- `src/original-ruby-scripts/` — decompressed original RGSS1 Ruby scripts for reference; these remain Ruby and are not executed in the HTML5 runtime.
- `source/original-project/` — original project metadata and save files, retained for reference.
- `tools/export_rxdata.rb` — Ruby helper used to convert RPG Maker XP Marshal files to JSON (scripts are instead unpacked into readable `.rb` files).
- `tools/validate_project.py` — checks JSON shape and key asset references.
- `docs/PORTING_STATUS.md` — current implementation status and next steps.

## Important status note

This is a playable port foundation, **not yet feature-equivalent to RGSS1**. Walking around maps, rendering layers/autotiles/characters, map transfers, dialogue, choice branches, self-switches, basic item counts, HP changes, saving, and selected event commands are implemented. Battles now use troop/enemy data and support basic attacks, learned skills, consumable items, guarding, escape, enemy turns, EXP/gold rewards, and battle-result branches. Exact RGSS battle formulas, states/elements/targeting, equipment/skill menus, full screen effects, event movement routes, animations, and automatic migration of existing save files still need to be ported and tested. See `docs/PORTING_STATUS.md` before treating it as a release build.

## Editing data

Edit map/database JSON under `data/` and the runtime in `app.js`. The JSON retains `_class` tags and all converted object fields to stay close to the original XP structure. After updating `data/`, ensure referenced media names still exist in `assets/`; if files are added or renamed, regenerate `asset-index.json` using the short helper snippet documented in `docs/PORTING_STATUS.md`.
