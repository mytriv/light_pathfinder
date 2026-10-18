# Light Pathfinder — clean JavaScript engine slice

The **За дзеркалом** story expansion adds the director's office, a cellar quest, sanity, a quest journal, and three endings. See [the walkthrough and implementation notes](STORY_EXPANSION.md). Existing browser saves are supported.
Original Za conversations remain before the new guard-related advice. NPC movement and walking frames follow the original XP event pages; stationary characters stay fixed. The original post-battle and clothing-chest graphic changes are applied and saved.

Play it on [GitHub Pages](https://mytriv.github.io/light_pathfinder/LightPathfinderJS/).
The story expansion build has its own [preview page](https://mytriv.github.io/light_pathfinder/builds/story-expansion/). Its publishing tree keeps the existing site and places this build under a separate path. After committing and pushing the feature branch, run `powershell -ExecutionPolicy Bypass -File tools/publish-preview.ps1` to update that preview. GitHub Pages uses the `gh-pages` branch at `/`.

This is a fresh implementation using the original RPG Maker XP map and asset data. It does not import the previous HTML5 runtime or the MZ project. Those folders and the original XP project remain unchanged.

## Run

On Windows, double-click `start-local.bat`. It uses PowerShell already included
with Windows, starts the local file server, and opens the game in your browser.
Keep the terminal window open while playing; press Ctrl+C there to stop it.
The title screen offers **Нова гра** and **Завантажити гру**. Use the mouse, or Up/Down and Enter. The load screen opens the existing browser save; a new game starts fresh without immediately deleting it. Normal endings show **Гра завершена**; the crash ending opens a 500 page with a restart link.
Choose **Українська** or **English** in the language selector at the top of the page. It works on the title screen and during play, including an open dialogue or choice. The browser remembers the language separately from game saves. Both the original story and expansion are localized, along with menus, items, the quest journal and endings. English keeps the profanity, absurd humor and local character names. The audio switch is labeled **Звукові ефекти / Sound effects**.
If port 8011 is busy, the launcher automatically chooses a free port and prints the actual address. Browser saves belong to each port separately; return to the previous address to use a save made there.

You can also start the server from a terminal:

```powershell
node start-local.js
```

Then use the arrows or WASD to walk around the starting map. Press Esc or X to open the XP-style menu (items, skills, equipment, status, save, clear save, and game end). Use Up/Down plus Enter, or click a menu row. Enter or Z advances dialogue. Map exits load their destination XP map and graphics; event transfer commands, choice branches, save points, and event rewards are supported.

Phones and tablets automatically show touch controls: hold a direction to walk, tap **Дія / Далі / Act / Next** to interact or advance dialogue, and use **Меню / Назад / Menu / Back** to open or leave menus. The same buttons select dialogue answers and inventory entries. Controls move beside the game in landscape. Touch release, cancellation and switching away stop movement. Desktop keyboard controls remain available.

The engine is still a partial XP replacement. Menu inventory and equipment use event-reward data, and saves are stored in the current browser. The menu can delete the saved game; deletion keeps the current session running until reload. The boss encounter has its own scripted first-turn battle. Kidhaus exits through the entrance tile. After the boss defeat, revisiting kidhaus triggers its return scene and Game Over. The orgy map exits to Batya; later attempts to enter it are blocked with a different line of dialogue. A general battle system and many XP event commands are not implemented. The map JSON and graphics for all nine maps are included.
