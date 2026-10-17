/* RPG Maker XP Game_Character#passable? and Game_Map#passable? rules. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RPGXPPassability = api;
})(globalThis, function () {
  'use strict';

  function tableValue(table, id) {
    return table && Array.isArray(table.data) ? (table.data[id] || 0) : 0;
  }

  function tileAt(map, x, y, z) {
    const data = map.data;
    return data.data[x + data.xsize * (y + data.ysize * z)] || 0;
  }

  function mapPassable(map, tileset, events, x, y, direction, selfEventId = 0) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const bit = (1 << (direction / 2 - 1)) & 0x0f;

    for (const { ev, pg, motion } of events) {
      const tileId = Number(pg.graphic?.tile_id ?? 0);
      if (tileId >= 0 && ev.id !== selfEventId && motion.x === x && motion.y === y && !pg.through) {
        const passage = tableValue(tileset.passages, tileId);
        if ((passage & bit) !== 0 || (passage & 0x0f) === 0x0f) return false;
        if (tableValue(tileset.priorities, tileId) === 0) return true;
      }
    }

    for (let z = 2; z >= 0; z--) {
      const tileId = tileAt(map, x, y, z);
      const passage = tableValue(tileset.passages, tileId);
      if ((passage & bit) !== 0 || (passage & 0x0f) === 0x0f) return false;
      if (tableValue(tileset.priorities, tileId) === 0) return true;
    }
    return true;
  }

  function canPass({ map, tileset, events, player, x, y, direction, movingEventId = 0, through = false }) {
    const dx = direction === 4 ? -1 : direction === 6 ? 1 : 0;
    const dy = direction === 8 ? -1 : direction === 2 ? 1 : 0;
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return false;
    if (through) return true;

    if (!mapPassable(map, tileset, events, x, y, direction, movingEventId)) return false;
    if (!mapPassable(map, tileset, events, nx, ny, 10 - direction)) return false;

    for (const { ev, pg, motion } of events) {
      if (ev.id === movingEventId || motion.x !== nx || motion.y !== ny || pg.through) continue;
      if (movingEventId || pg.graphic?.character_name) return false;
    }
    if (movingEventId && player.characterName && player.x === nx && player.y === ny) return false;
    return true;
  }

  return { canPass, mapPassable };
});
