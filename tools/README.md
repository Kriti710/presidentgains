# tools/

One-shot scripts used to build the assets from `concept.png`. You do not need to
run these to play or change the game — the results are already committed in
`assets/`. They are here so the art pipeline is reproducible if the concept
sheet is ever redrawn.

Needs `pillow`, `numpy` and `scipy`.

| script | what it does |
| --- | --- |
| `extract_sprites.py` | keys the background out of each region of `concept.png` and writes trimmed PNGs |
| `make_frames.py` | turns the three standing poses into 6-frame animation strips (idle / walk ×3 / jump / squash) by splitting the sprite at the knee and scissoring the legs |
| `make_level.py` | paints the ASCII level map and writes `src/level.js` |

Paths inside them point at the original working directory; fix those before
re-running.
