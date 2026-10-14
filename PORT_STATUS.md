# RPG Maker XP to HTML5 compatibility status

Updated: 2026-10-14

This matrix describes the supplied conversion, not a claim of RPG Maker XP parity. Evidence comes from the exported JSON, runtime command dispatch in `app.js`, the original project retained under `source/original-project/`, and the checks recorded below.

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Original project and reference data | Complete | `source/original-project/` contains Game.ini, project metadata, all nine map Marshal files, database Marshal files, scripts, and two sample saves; `src/original-ruby-scripts/` contains decompressed script references. |
| Exported data and media inventory | Complete | 23 data JSON files, nine maps, and 889 indexed media files are present. `tools/validate_project.py` parses each data JSON and resolves map tileset, autotile, and character graphics. |
| Browser entry point and offline serving | Complete | `index.html`, `style.css`, and `app.js` use local relative URLs. `start-local.py` serves over loopback using Python's standard library. No CDN/runtime service dependency is present. |
| GitHub Pages subpath hosting | Needs Verification | Page assets and data use relative URLs, which resolve under a repository subpath. Deployment has not been exercised on GitHub Pages. `.nojekyll` is included. |
| Map data decoding and rendering | Partial | Runtime decodes 32×32 three-layer XP map tables, autotile quadrants, tilesets, priorities, and camera. Priority/y sorting, panorama/fog/tone, screen transitions, and all visual effects are not complete. |
| Player movement and collision | Partial | Passability is implemented from the original `Game_Character#passable?` and `Game_Map#passable?` scripts. Input state is isolated in `src/engine/input.js`; regression checks cover the map 001 one-way start tile, key release, direction changes, and buffered taps without stale-key fallback. Custom move routes, vehicles, jumping, and complete terrain behavior remain absent. |
| Events and page selection | Partial | Page conditions, action/touch triggers, and selected commands are implemented. Automatic/parallel processing, full move routes, cancellation, and event concurrency are incomplete. |
| Interpreter coverage for commands in maps 001–009 | Partial | Current map data contains codes 0, 101, 102, 106, 112, 113, 123, 126–128, 134, 201, 224–225, 301, 311, 318, 322, 337, 339, 352–353, 401–404, 411, 413, 601, 603–604. Most have dispatch cases; 224, 225, 337, and 339 are explicitly logged no-ops. Unknown codes now emit map/event/page/index/code/parameter diagnostics rather than silently disappearing. Several supported cases are simplified and require behavioral validation. |
| Battle system | Partial | Troops and enemies drive the battle prototype; basic attacks, learned skills, items, guard, escape, enemy response, and rewards exist. RGSS1 hit/critical/variance, elements, states, targeting, troop pages, drops, forced actions, and documented formula parity remain incomplete. |
| Database progression and menus | Partial | Original actor/class/skill/item/weapon/armor/enemy/troop/state data is exported. Basic HP/SP/EXP/gold/inventory state is used. Full party management, equipment effects, shop, status, and item/skill menus are missing. |
| Browser save/load | Partial | One JSON localStorage save is written and can be loaded. Robust schema/version validation, multiple slots, corruption recovery UI, and old `.rxdata` migration are not implemented. The original XP saves are not compatible. |
| End-to-end story and encounter parity | Needs Verification | The source maps and event content are retained, but a complete playthrough and comparison against RGSS1 have not been performed. |

## Checks executed

- `tools/validate_project.py`: passed; 23 JSON files parsed, nine maps checked, 889 media paths indexed, and current map tileset/autotile/event-character references resolved.
- `node --check app.js`: passed.
- `node tools/test_passability.js`: passed. The original rules reject the down step from map 001 start `(15,10)` and reject movement out of the erroneous destination `(15,11)`; the other three start directions are passable.
- `node tools/test_input.js`: passed. Quick taps are consumed once; changing direction and releasing it does not revive an earlier key.
- `node tools/test_input.js`: passed. Quick taps are consumed once; changing directions cannot fall back to an earlier key after release.
- Event command inventory: all distinct command codes present in the nine exported maps were enumerated; unsupported commands are listed in the interpreter row above and runtime diagnostics include their source context.
- Browser gameplay, battle calculations, localStorage recovery, GitHub Pages deployment, and original-save migration: not verified.

## Prioritized next implementation work

1. Implement complete RPG Maker XP event branch/command semantics for the commands actually present; build automated map/event and interpreter coverage checks.
2. Replace battle approximations with rules read from the original scripts and database, including troop pages, states, elements, hit/evade, and rewards.
3. Implement functional item, skill, equipment, status, shop, and party menus against original database values.
4. Add versioned, validated save slots and corruption recovery; document `.rxdata` incompatibility unless a tested migration is completed.
5. Add browser smoke tests and playthrough regression coverage, then verify a clean deployment at a GitHub Pages repository subpath.

See `docs/PORTING_STATUS.md` for implementation notes and data-conversion details.
