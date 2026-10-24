# Dungeon Break

A touch-friendly, top-down dungeon crawler built with plain HTML, CSS, and JavaScript. No libraries, build tools, accounts, or ads.

## Play
Open `index.html` in a browser. On a phone, rotate to landscape.

- Drag the left joystick to move; release to stop. Drag farther to move faster.
- Hold **FIRE** to shoot toward groups of nearby monsters. Bullets stop at walls.
- Tap **Pause** to save and take a break. Progress also saves automatically on this browser.
- Explore connected rooms, defeat all monsters, and find the stairs to the next floor.
- Every floor has a new maze. Every fifth floor includes a boss.
- The minimap shows uncleared rooms in gray and cleared rooms in purple.
- Pink pickups restore health.
- The death screen shows your monster count, a **NEW BEST** badge for a new deepest-floor record, and **Try Again**.

Keyboard controls are optional: WASD or arrows to move, Space to fire, P or Escape to pause.

## GitHub Pages
1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/ (root)**, then save.
4. Open the site URL GitHub provides once deployment finishes.

No build step is required. Relative asset paths support repository Pages URLs and custom domains.

## Saves
Progress and personal bests use localStorage on the current browser and site address. Clearing browser data clears saves. Saves from a local file do not automatically transfer to the hosted site. Private browsing or blocked storage may prevent saving.

## Tests
With Node.js installed, run:

```sh
node tests/game.test.cjs
```

Tests cover generated maze connectivity, enemy navigation, combat, projectiles, floor progression, save data, joystick movement and release, and end-of-run behavior. Node is needed only to run tests, not to play or deploy the game.
