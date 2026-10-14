# Changelog

## 0.1.0 — Initial JavaScript port foundation

- Converted RPG Maker XP data to JSON while preserving class names and table dimensions.
- Added original graphics/audio and generated a browser media index.
- Implemented a responsive Canvas runtime, XP autotile composition, tile layers, basic passability, player movement, map events, dialogue, choices, map transfers, self-switches, basic inventory/HP/gold/skill commands, and browser-local saving.
- Added a basic turn-based battle approximation backed by the project's enemy/troop data.
- Added offline local-server launchers, GitHub Pages instructions, a validator, and retained original project data/Ruby scripts for reference.

This is an early port, not an exact RGSS1 reimplementation. See `docs/PORTING_STATUS.md` for known gaps.
