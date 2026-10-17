/* Directional input with one buffered step and no stale-key fallback. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RPGXPInput = api;
})(globalThis, function () {
  'use strict';
  function createInputState(directions) {
    let activeKey = null;
    let activeDirection = 0;
    let queuedDirection = 0;
    return {
      press(key) {
        const direction = directions[key] || 0;
        if (!direction) return 0;
        activeKey = key;
        activeDirection = direction;
        queuedDirection = direction;
        return direction;
      },
      release(key) {
        if (key === activeKey) {
          activeKey = null;
          activeDirection = 0;
        }
      },
      consume() {
        const direction = activeDirection || queuedDirection;
        queuedDirection = 0;
        return direction;
      },
      reset() {
        activeKey = null;
        activeDirection = 0;
        queuedDirection = 0;
      },
    };
  }
  return { createInputState };
});
