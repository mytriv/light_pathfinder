# SiegSim JS

A standalone, static JavaScript rebuild of the original one-room GameMaker game. The web build reuses the extracted player, enemy, floor, and flag sprites and needs no server-side code or external packages.

## Play

Open `index.html`, or publish the contents of this folder as the root of a GitHub Pages site.

- **A / D** or **Left / Right:** move
- **W**, **Up**, or **Space:** jump
- **Q / E:** attack left / right
- On touch devices, use the on-screen buttons.

## What changed from the original

The decompiled GML shows why the original combat did not work: player keys Q/E only changed sprites, no event damaged or destroyed `Enemy_count`, and the enemy's 100 HP was never reduced. Player contact damage was only `0.001` per step. Movement used fixed 4-pixel key actions, so it stopped abruptly.

The browser rebuild adds acceleration and friction, a variable-height jump, contact damage with brief invulnerability, and a directional Q/E attack. Enemy balls take three hits and are removed with a clear hit/death response. A canvas-drawn ball remains visible beneath each enemy sprite as a fallback if an image fails to load. The arena still uses the recovered 1024×500 room layout and original sprites.

## Files

- `game.js`, `style.css`, `index.html` — static web game.
- `assets/` — selected sprite frames from the original game.

The JavaScript is a manual gameplay reconstruction from the recovered GameMaker code and room data, not an automatic GML-to-JavaScript translation. The original Windows executable and extracted files are not included in this published folder.
