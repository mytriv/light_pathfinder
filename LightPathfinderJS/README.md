# Light Pathfinder — clean JavaScript engine slice

Play it on [GitHub Pages](https://mytriv.github.io/light_pathfinder/LightPathfinderJS/).

This is a fresh implementation using the original RPG Maker XP map and asset data. It does not import the previous HTML5 runtime or the MZ project. Those folders and the original XP project remain unchanged.

## Run

On Windows, double-click `start-local.bat`. It uses PowerShell already included
with Windows, starts the local file server, and opens the game in your browser.
Keep the terminal window open while playing; press Ctrl+C there to stop it.

You can also start the server from a terminal:

```powershell
node start-local.js
```

Then use the arrows or WASD to walk around the starting map. Press Esc or X to open the XP-style menu (items, skills, equipment, status, save, clear save, and game end). Use Up/Down plus Enter, or click a menu row. Enter or Z advances dialogue. Map exits load their destination XP map and graphics; event transfer commands, choice branches, save points, and event rewards are supported.

The engine is still a partial XP replacement. Menu inventory and equipment use event-reward data, and saves are stored in the current browser. The menu can delete the saved game; deletion keeps the current session running until reload. The boss encounter has its own scripted first-turn battle. Kidhaus exits through the entrance tile. After the boss defeat, revisiting kidhaus triggers its return scene and Game Over. The orgy map exits to Batya; later attempts to enter it are blocked with a different line of dialogue. A general battle system and many XP event commands are not implemented. The map JSON and graphics for all nine maps are included.
