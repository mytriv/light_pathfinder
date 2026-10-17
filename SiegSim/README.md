# SiegSim

A static JavaScript remake of the original one-room GameMaker arena. It is playable in a browser and uses no server-side code or external packages.

## Play

Open `index.html`, or visit [SiegSim on GitHub Pages](https://mytriv.github.io/light_pathfinder/SiegSim/).

- **A / D** or **Left / Right:** move.
- **W**, **Up**, or **Space:** jump.
- **J:** hold to throw spinning shuriken in the direction you face. Hold left-click to throw too.
- Touch screens get one attack button plus movement and jump buttons.

## Changes

Combat runs through endless escalating waves, with opponent variants rotating between Soviet, China, North Korea, USA, and Britain countryballs. Each wave gets a new arrangement of jumpable platforms that enemies can climb too. Barbed wire appears from wave 5; armed shooters join at wave 10, with more pressure at wave 15. Movement accelerates quickly, eases to a stop, and has buffered jumps and coyote time. The supplied character sheet drives running, jumping, and the three-throw attack animation; cell bleed is trimmed from its firing frames. The arena keeps a 16:9 playable area on every screen size, with bottom spacing matched to the header.

The enemy sprites and dusk arena are generated pixel-art assets. The original Windows executable is not included in this browser folder.
