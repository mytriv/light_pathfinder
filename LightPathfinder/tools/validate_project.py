#!/usr/bin/env python3
"""Sanity-check the exported JSON and referenced media in this port."""
import json
import os
import re
import collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ASSETS = ROOT / "assets"
index = json.loads((ROOT / "asset-index.json").read_text(encoding="utf-8"))
missing = []
map_errors = []
command_counts = collections.Counter()
unsupported_codes = set()
supported_codes = {0, 101, 102, 106, 112, 113, 123, 125, 126, 127, 128, 134, 201, 224, 225, 301, 311, 318, 322, 337, 339, 352, 353, 401, 402, 403, 404, 411, 413, 601, 602, 603, 604}
for path in sorted(DATA.glob("*.json")):
    json.loads(path.read_text(encoding="utf-8"))

tilesets = json.loads((DATA / "Tilesets.json").read_text(encoding="utf-8"))
mapinfos = json.loads((DATA / "MapInfos.json").read_text(encoding="utf-8"))
map_paths = sorted(DATA.glob("Map[0-9][0-9][0-9].json"))
for path in map_paths:
    m = json.loads(path.read_text(encoding="utf-8"))
    ts = tilesets[m["tileset_id"]]
    if not (m["data"]["xsize"] == m["width"] and m["data"]["ysize"] == m["height"] and m["data"]["zsize"] == 3):
        raise SystemExit(f"Table dimensions are wrong in {path.name}")
    if max(m["data"]["data"], default=0) >= len(ts["priorities"]["data"]):
        raise SystemExit(f"A tile ID exceeds tileset priorities in {path.name}")
    for key, folder in [("tileset_name", "Graphics/Tilesets"), ("autotile_names", "Graphics/Autotiles")]:
        names = ts.get(key, [])
        if isinstance(names, str): names = [names]
        for name in names:
            if name and f"{folder}/{name}" not in index:
                missing.append(f"{path.name}: {folder}/{name}")
    for event in m.get("events", {}).values():
        for page in event.get("pages", []):
            name = page.get("graphic", {}).get("character_name")
            if name and f"Graphics/Characters/{name}" not in index:
                missing.append(f"{path.name}: Graphics/Characters/{name}")
            for command in page.get("list", []):
                code = int(command.get("code", -1))
                command_counts[code] += 1
                if code not in supported_codes:
                    unsupported_codes.add(code)
                params = command.get("parameters", [])
                if code == 201 and params and params[0] == 0 and len(params) > 1:
                    target = int(params[1])
                    if not (DATA / f"Map{target:03}.json").is_file():
                        map_errors.append(f"{path.name}: transfer targets missing map {target}")
                if code == 301 and params and params[0] not in (0, None):
                    troop_id = int(params[0])
                    if troop_id >= len(json.loads((DATA / "Troops.json").read_text(encoding="utf-8"))):
                        map_errors.append(f"{path.name}: battle references missing troop {troop_id}")

print(f"JSON files: {len(list(DATA.glob('*.json')))}")
print(f"Maps: {len(map_paths)}")
print(f"Map database names: {len(mapinfos)}")
print(f"Indexed media files: {len(index)}")
if missing:
    print("Missing asset references:")
    print("\n".join(missing))
    raise SystemExit(1)
if map_errors:
    print("Invalid map/database references:")
    print("\n".join(map_errors))
    raise SystemExit(1)
if unsupported_codes:
    print(f"Event command codes without interpreter dispatch: {sorted(unsupported_codes)}")
    raise SystemExit(1)
print("All map, tileset, autotile, and event-character references resolve.")
print(f"Event command codes covered by dispatch: {len(command_counts)} distinct; counts: {dict(sorted(command_counts.items()))}")
