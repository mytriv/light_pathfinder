const assert = require('node:assert/strict');
const { createInputState } = require('../src/engine/input.js');

const input = createInputState({ ArrowUp: 8, ArrowDown: 2, ArrowLeft: 4, ArrowRight: 6 });

input.press('ArrowRight');
assert.equal(input.consume(), 6, 'a quick key tap should retain one movement step');
input.release('ArrowRight');
assert.equal(input.consume(), 0, 'released input should stop repeating');

input.press('ArrowRight');
input.consume();
input.press('ArrowLeft');
input.release('ArrowRight');
assert.equal(input.consume(), 4, 'the latest direction must take priority over an older held key');
input.release('ArrowLeft');
assert.equal(input.consume(), 0, 'releasing the latest direction must not revive a stale earlier direction');

input.press('ArrowUp');
input.release('ArrowUp');
assert.equal(input.consume(), 8, 'a short press during movement should stay queued until the next step');
assert.equal(input.consume(), 0, 'a queued tap should be consumed only once');

console.log('Movement input regression passed: taps, direction changes, release, and queued steps.');
