# SiegSim

A static JavaScript remake of the original one-room GameMaker arena. It is playable in a browser and uses no server-side code or external packages.

## Play

Open `index.html`, or visit [SiegSim on GitHub Pages](https://mytriv.github.io/light_pathfinder/SiegSim/).

- **A / D** or **Left / Right:** move.
- **W**, **Up**, or **Space:** jump.
- **J:** punch straight ahead in the direction you face. Left-click also attacks.
- Touch screens get one punch button plus movement and jump buttons.

## Changes

Combat runs through endless escalating waves, with opponent variants rotating between Soviet, China, North Korea, USA, and Britain countryballs. Each wave gets a new arrangement of jumpable platforms. Movement accelerates quickly, eases to a stop, and has buffered jumps and coyote time. The original GameMaker player sprites provide the idle, moving, and straight-punch poses. The page keeps only the game name and controls outside the responsive arena.

The enemy sprites and dusk arena are generated pixel-art assets. The original Windows executable is not included in this browser folder.
