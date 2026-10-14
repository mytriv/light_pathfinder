# Porting status and next steps

Last updated: 2026-10-14

## Implemented in this milestone

- Native HTML5 Canvas at the original 640×480 logical resolution, scaled responsively.
- Original title image, map tilesheets, autotiles and character sheets.
- XP 32×32 map tile decoding (three map layers; autotile variants assembled from the source quadrants).
- Map camera and tile passability checks driven by the exported `RPG::Tileset` passage/priority tables.
- Player movement, direction/facing, nearby action-triggered events and player-touch events.
- Active event-page selection based on switches, variables and self-switches.
- A JavaScript interpreter for the event commands used in the supplied maps: text/continuation, choices and choice branches, loop/break, self switches, map transfer, wait, inventory changes, save permission, HP changes, actor graphic change, save menu, game over, and battle result branches.
- Browser-local save state via `localStorage`.
- Original BGM selection for maps when a BGM file is available.
- Offline local-server launcher and static-hosting support.

## Known gaps before claiming full parity

- Battle processing (`301`) now loads RPG::Troop / RPG::Enemy data, shows enemy sprites and HP, and supports basic attack, class-learned/state-learned skills, usable items, guard, escape, enemy turns, simple damage calculations and EXP/gold awards. It is still a simplified approximation rather than RGSS1 battle parity: exact hit/critical/variance formulas, elements, states, multiple target selection, battle animations, forced actions, troop page conditions and all victory/drop rules are not complete.
- `Scene_Menu`, `Scene_Item`, `Scene_Skill`, `Scene_Equip`, `Scene_Status`, `Scene_Shop`, and save/load screens are not feature-complete; the current menu is intentionally minimal.
- Some event commands are currently ignored or simplified, including animations, force actions, flash/shake effects, event move routes, shops, and conditional-branch variants not found in the included maps.
- Event concurrency/parallel processes, automatic events across map transfers, character movement routes, scroll/fog/tone/transition effects, random encounters, and save-file compatibility need full implementation and tests.
- Existing XP save files are retained only as source reference. The browser save format is a new JSON structure in `localStorage`.
- This game's root map and event flow were parsed, but a complete manual playthrough across every branch has not yet been QA-tested.

## Suggested implementation order

1. **Battle fidelity:** align the existing battle prototype with RGSS1 formulas, element/state effects, targeting, troop event pages and victory/drop processing.
2. **Common interpreter:** add remaining interpreter commands and nested conditionals with explicit coverage tests for all command codes in map data.
3. **Menu/database UI:** implement item use, skill selection, equipment, status, shop purchases/selling, party/experience/state updates.
4. **Rendering fidelity:** add per-priority/y-sorted tile rendering, character animation timing, moving-event sprites, tone/fog/panorama, and BGM/BGS/SE/ME handling.
5. **Save migration:** decode `Save1.rxdata` and `Save2.rxdata` with an XP Marshal reader and map supported contents to the browser save schema, if continuing old saves is required.
6. **QA:** test each event branch on maps 001–009 in sequence and fix differences from the Windows/RGSS build.

## Regenerate asset index

Run this Python snippet from the project root after adding/removing media assets:

```python
import json, os
idx = {}
for top in ('Graphics', 'Audio'):
    for root, _, files in os.walk(os.path.join('assets', top)):
        for name in files:
            rel = os.path.relpath(os.path.join(root, name), 'assets').replace('\\', '/')
            idx[rel.rsplit('.', 1)[0]] = rel
with open('asset-index.json', 'w', encoding='utf-8') as f:
    json.dump(idx, f, ensure_ascii=False, separators=(',', ':'))
```

## Source data conversion

`tools/export_rxdata.rb` reads the Ruby Marshal `.rxdata` files with minimal placeholder classes and exports JSON. It is a conversion utility, not an RGSS runtime. It needs Ruby 2.7+ and the original `.rxdata` files as input. Always work on backups when editing original XP data.
