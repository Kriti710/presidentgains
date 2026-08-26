# President Gains

A Mario-style platformer. Eggs and milk make you swole.

Runs entirely in the browser. No backend, no accounts, no leaderboard — progress
is kept in `localStorage` on whoever's machine is playing.

```
LV.1  ROOKIE        start
LV.2  EGG-FED       egg   → wider frame
LV.3  BEAST MODE    milk  → arms out, and you can smash bricks
```

---

## Play it locally

The game loads its sprites and sounds over HTTP, so opening `index.html` by
double-clicking it will not work — the browser blocks the file reads. Serve the
folder instead:

```bash
npx serve .            # then open the URL it prints
# or
python3 -m http.server 8000
```

There is no build step, no `npm install`, no bundler. It is plain HTML, CSS and
JavaScript, and what you edit is what runs.

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` or `A` `D` |
| Jump | `Space`, `↑`, or `W` — hold for a higher jump |
| Run | `Shift` |
| Mute | `M` |
| Back to title | `R` |
| Show hitboxes | `F1` |

On phones and tablets an on-screen pad appears automatically.

---

## Deploying to Cloudflare Pages

The whole thing is static files, so there is nothing to build.

**From a GitHub repo (auto-deploys on every push):**

1. Push this folder to a new GitHub repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, and pick the repo.
3. When it asks for build settings:
   - **Framework preset:** `None`
   - **Build command:** *leave empty*
   - **Build output directory:** `/`
4. Save and deploy. Every push to `main` redeploys.

**Or drag-and-drop:** zip this folder, then **Workers & Pages** → **Create** →
**Pages** → **Upload assets**, and drop the zip in.

`_headers` is already set up so the browser caches the sprites and sounds but
always re-checks `index.html` — meaning your friends see new versions
immediately instead of a stale cached game.

---

## Making your own levels

`src/level.js` is the whole level, as an ASCII map. Edit it in any text editor
and reload the page.

```
=  grass (solid)          b  brick — tier 3 smashes these
-  dirt (decorative)      ?  prize block — powerup or coin
!  solid block / stairs   c  coin
P  pipe top-left          g  goomba
p  pipe top-right         ^  bush        ~  cloud
q  pipe body              M  mountain
F  flagpole               C  castle
```

Two rules, and only two:

1. **Every row must be exactly the same length.** Pad short rows with spaces.
2. **A pipe is `P` `p` on its top row, with `q` `q` under it** for each row of
   its height. The game measures the height from the `q` column.

Some things worth knowing while you build:

- A full jump rises about **4.8 tiles**, so blocks more than 4 tiles above the
  floor need stairs or a platform to reach.
- Prize blocks give a powerup every third one and a coin otherwise
  (`prizeIndex % 3` in `src/main.js`), so their **order in the file** decides
  which are which.
- Goombas walk off ledges, exactly like the originals.

To add a second level, copy `LEVEL` into a `LEVEL2`, and pass it into the
`"game"` scene the way `carry` already passes lives and score between runs.

## Tuning the feel

The numbers that matter are all at the top of `src/main.js`:

```js
const WALK_SPEED = 290;
const RUN_SPEED  = 440;
const JUMP_FORCE = 1200;   // higher = floatier and taller
const GRAVITY    = 2900;   // higher = snappier and shorter
const START_TIME = 320;
const CAM_ZOOM   = 1.3;    // higher = closer in
```

`HB_W` / `HB_H` are the player's collision box. It stays **the same size at
every tier on purpose** — if the box grew with the muscles, powering up inside
a tight gap would wedge you into a wall.

---

## How it is put together

```
index.html          page shell, touch controls, styling
src/level.js        the ASCII level map
src/main.js         the entire game — one file, commented throughout
vendor/kaplay.js    KAPLAY 3001.0.19, vendored so there is no CDN dependency
assets/sprites/     cut out of the concept art
assets/sounds/      generated square/triangle-wave chiptune
```

Some notes on decisions that are not obvious from the code:

- **Runs of identical terrain are merged into single wide objects.** One game
  object per tile cost about 5fps, because every object pays for an update pass
  and a collision entry whether or not anything about it changes. Only the
  pieces that actually do something — bricks, prize blocks, coins, enemies —
  stay individual.
- **Those merged strips are emitted in 16-tile chunks.** KAPLAY's `offscreen`
  culls on an object's origin point, not its bounds, so a single 3000px-wide
  ground strip vanishes the moment its left edge leaves the view — taking the
  visible ground with it.
- **Headbutt detection is geometric, not velocity-based.** By the time the
  collision callback runs, the physics step has already resolved the player
  against the block and zeroed `vel.y`, so testing `vel.y < 0` misses the hit.
- **Nothing calls `unuse("area")` or `unuse("body")`.** KAPLAY's collision pass
  walks the object afterwards and throws. Dead enemies and the death animation
  use flags and `collisionIgnore` instead.
- **The mountains are drawn, not cropped.** In the concept art they sit behind
  the goomba and the pipe, so there is no clean rectangle to cut out.

## Credits

- Character art and the whole concept: the original pixel-art concept sheet
  (`concept.png`), sliced up in `tools/extract_sprites.py`.
- Engine: [KAPLAY](https://kaplayjs.com) — MIT, the maintained fork of
  Kaboom.js. Licence in `vendor/KAPLAY-LICENSE.md`.
- Level structure follows the ASCII-map pattern used by the open-source
  Kaboom Mario clones ([kubowania/mario](https://github.com/kubowania/mario),
  [ramchaik/mario-kaboom](https://github.com/ramchaik/mario-kaboom)).
- Everything else — sprites, sounds, level, game code — is original to this
  project. No Nintendo assets are used or included.
