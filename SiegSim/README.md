# SiegSim

A static JavaScript remake of the original one-room GameMaker arena. It is playable in a browser and uses no server-side code or external packages.

## Play

Open `index.html`, or visit [SiegSim on GitHub Pages](https://mytriv.github.io/light_pathfinder/SiegSim/).

- **A / D** or **Left / Right:** move.
- **W**, **Up**, or **Space:** jump.
- **J** or **F:** attack in the direction you face. Left-click also attacks.
- Touch players get one **BONK** button plus movement and jump buttons.

## Changes

Combat now runs through endless escalating waves, with the opponent variants rotating between Soviet, China, North Korea, USA, and Britain countryballs. Movement accelerates quickly, eases to a stop, and has buffered jumps and coyote time. A single attack button faces the current movement direction and uses a readable swing animation. The game scales its canvas and playfield for desktop, phone, and landscape layouts.

The enemy sprites and dusk arena are newly generated pixel-art assets. The player is a hand-drawn, code-native pixel sprite. The original Windows executable and extracted files are not included in this browser folder.
