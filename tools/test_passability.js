const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canPass } = require('../src/engine/passability.js');

const project = path.resolve(__dirname, '..');
const readJson = name => JSON.parse(fs.readFileSync(path.join(project, 'data', name), 'utf8'));
const system = readJson('System.json');
const mapId = Number(system.start_map_id || 1);
const map = readJson(`Map${String(mapId).padStart(3, '0')}.json`);
const tileset = readJson('Tilesets.json')[map.tileset_id];
const events = Object.values(map.events || {}).flatMap(ev => {
  const pages = ev.pages || [];
  const activeIndex = pages.reduce((selected, pg, index) => {
    const c = pg.condition || {};
    const valid = (!c.switch1_valid && !c.switch2_valid && !c.self_switch_valid) &&
      (!c.variable_valid || Number(c.variable_value || 0) <= 0);
    return valid ? index : selected;
  }, -1);
  if (activeIndex < 0) return [];
  const pg = pages[activeIndex];
  return [{ ev, pg, motion: { x: ev.x, y: ev.y } }];
});
const player = {
  x: Number(system.start_x ?? 15),
  y: Number(system.start_y ?? 10),
  characterName: 'test-player',
};
const allowed = direction => canPass({ map, tileset, events, player, x: player.x, y: player.y, direction });

// Map 001's starting tile is one-way. XP checks both the tile being left and
// the tile being entered; omitting the reciprocal flag leads into a trap.
assert.equal(allowed(2), false, 'start tile must not allow movement down into the one-way dead end');
assert.equal(allowed(4), true, 'start tile should allow movement left');
assert.equal(allowed(6), true, 'start tile should allow movement right');
assert.equal(allowed(8), true, 'start tile should allow movement up');
assert.equal(canPass({ map, tileset, events, player, x: player.x, y: player.y + 1, direction: 8 }), false,
  'the one-way dead-end tile must also reject movement back out');

console.log(`RPG Maker XP passability regression passed for map ${mapId} at (${player.x}, ${player.y}).`);
