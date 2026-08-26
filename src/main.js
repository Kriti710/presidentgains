/* =========================================================================
   PRESIDENT GAINS  —  a Mario-style platformer
   Eggs and milk make you swole. Built on KAPLAY (MIT).

   Everything runs client-side. No backend, no network calls.
   Progress lives in localStorage under the "pg." prefix.
   ========================================================================= */

kaplay({
  width: 1280,
  height: 720,
  letterbox: true,
  background: [14, 20, 32],
  crisp: true,
  canvas: document.getElementById("game"),
  global: true,
  debug: true,
  logMax: 4,
});

/* ------------------------------------------------------------------ assets */
const CHAR_ANIMS = {
  idle: 0,
  walk: { frames: [1, 2, 3, 2], loop: true, speed: 11 },
  jump: 4,
  squash: 5,
};

for (const t of ["tier1", "tier2", "tier3"]) {
  loadSprite(t, `assets/sprites/${t}.png`, { sliceX: 6, anims: CHAR_ANIMS });
}
for (const s of ["grass", "dirt", "brick", "qblock", "used", "coin", "goomba",
                 "egg", "milk", "pipe", "flag", "castle", "bush", "cloud",
                 "head"]) {
  loadSprite(s, `assets/sprites/${s}.png`);
}
for (const s of ["jump", "coin", "power", "stomp", "hurt", "bump", "brick",
                 "1up", "die", "win"]) {
  loadSound(s, `assets/sounds/${s}.wav`);
}
loadSound("bgm", "assets/sounds/bgm.mp3");

/* --------------------------------------------------------------- constants */
const WALK_SPEED = 290;
const RUN_SPEED  = 440;
const JUMP_FORCE = 1200;
const GRAVITY    = 2900;

const HB_W = 38;            // hitbox stays the same at every tier, so growing
const HB_H = 94;            // muscles can never wedge you inside a wall
const TIERS = 3;

const LEVEL_W = LEVEL[0].length * TILE;
const LEVEL_H = LEVEL.length * TILE;
const DEATH_Y = LEVEL_H + 220;

const START_TIME = 320;
const CAM_ZOOM = 1.3;       // pull the camera in so the character reads big
const TIER_NAME = { 1: "ROOKIE", 2: "EGG-FED", 3: "BEAST MODE" };

setGravity(GRAVITY);

/* ------------------------------------------------------------------- saves */
const SAVE_KEY = "pg.save.v1";
const DEFAULT_SAVE = { hiscore: 0, bestTime: 0, coins: 0, clears: 0, runs: 0, muted: false };

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...DEFAULT_SAVE, ...JSON.parse(raw) } : { ...DEFAULT_SAVE };
  } catch (e) {
    return { ...DEFAULT_SAVE };
  }
}
function writeSave(patch) {
  const next = { ...loadSave(), ...patch };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
  return next;
}

/* ------------------------------------------------------------------- input */
/* Touch buttons feed the same state the keyboard does. */
const touch = { left: false, right: false, space: false, shift: false };
let touchJumpEdge = false;

if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");

for (const btn of document.querySelectorAll("#touch button")) {
  const key = btn.dataset.key;
  const down = (e) => {
    e.preventDefault();
    if (key === "space" && !touch.space) touchJumpEdge = true;
    touch[key] = true;
  };
  const up = (e) => { e.preventDefault(); touch[key] = false; };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

const heldLeft  = () => isKeyDown("left")  || isKeyDown("a") || touch.left;
const heldRight = () => isKeyDown("right") || isKeyDown("d") || touch.right;
const heldRun   = () => isKeyDown("shift") || touch.shift;
const heldJump  = () => isKeyDown("space") || isKeyDown("up") || isKeyDown("w") || touch.space;
function jumpPressed() {
  if (touchJumpEdge) { touchJumpEdge = false; return true; }
  return isKeyPressed("space") || isKeyPressed("up") || isKeyPressed("w");
}
const anyStart = () => isKeyPressed("space") || isKeyPressed("enter") || jumpPressed();

/* A press is buffered for a moment so a jump entered a hair before landing
   still fires — and so a very fast tap can never be missed between frames.
   `go()` wipes root-level handlers, so the listener is re-registered per scene. */
let jumpBuffer = 0;
const JUMP_BUFFER = 0.13;
function armJumpInput() {
  jumpBuffer = 0;
  onKeyPress(["space", "up", "w"], () => { jumpBuffer = JUMP_BUFFER; });
}
function pollJump() {
  if (touchJumpEdge) { touchJumpEdge = false; jumpBuffer = JUMP_BUFFER; }
  if (isKeyPressed("space") || isKeyPressed("up") || isKeyPressed("w")) jumpBuffer = JUMP_BUFFER;
}

/* ---------------------------------------------------------------- helpers */

/* Enemies live inside the level object, so root-level `onUpdate(tag)` queries
   don't reach them. A component runs no matter how deeply nested it is. */
function patrol(speed) {
  return {
    id: "patrol",
    require: ["pos", "area", "body"],
    dir: -1,
    add() {
      this.onCollide("solid", (o, col) => {
        if (col && (col.isLeft() || col.isRight())) this.dir *= -1;
      });
    },
    update() {
      if (this.squished) return;
      this.move(this.dir * speed, 0);
    },
  };
}

function bob(amp, speed) {
  return {
    id: "bob",
    require: ["pos"],
    add() { this._bobBase = this.pos.y; this._bobT = rand(0, 10); },
    update() {
      this._bobT += dt() * speed;
      this.pos.y = this._bobBase + Math.sin(this._bobT) * amp;
    },
  };
}

/* The concept art's mountains overlap the goomba and the pipe, so there is no
   clean rectangle to crop. They are drawn instead, in the art's own greens. */
function drawMountain(bx, by, w, h, zBase, alpha) {
  const a = alpha ?? 1;
  const parts = [
    add([polygon([vec2(0, 0), vec2(w / 2, -h), vec2(w, 0)]),
         color(26, 104, 80), pos(bx, by), z(zBase), opacity(a)]),
    add([polygon([vec2(0, 0), vec2(w / 2, -h), vec2(w / 2, 0)]),
         color(48, 125, 73), pos(bx, by), z(zBase + 1), opacity(a)]),
    add([polygon([vec2(0, 0), vec2(w * 0.29, -h * 0.29), vec2(w * 0.59, 0)]),
         color(22, 96, 76), pos(bx + w * 0.6, by), z(zBase - 1), opacity(a)]),
  ];
  for (const [sx, sy] of [[0.34, 0.42], [0.46, 0.66], [0.58, 0.34],
                          [0.64, 0.58], [0.40, 0.80], [0.70, 0.76]]) {
    parts.push(add([rect(11, 15), color(20, 92, 70), opacity(0.55 * a),
                    pos(bx + w * sx, by - h * sy), z(zBase + 2)]));
  }
  return parts;
}

function resetCamera() {
  setCamScale(1);
  setCamPos(width() / 2, height() / 2);
}

function textShadow(str, opt) {
  return [text(str, opt), color(255, 255, 255), outline(4, rgb(20, 26, 40))];
}

let music = null;
function startMusic() {
  const save = loadSave();
  if (music) { music.stop(); music = null; }
  if (save.muted) return;
  music = play("bgm", { loop: true, volume: 0.35 });
}
function stopMusic() { if (music) { music.stop(); music = null; } }
function sfx(name, opt) {
  if (loadSave().muted) return null;
  return play(name, opt);
}

/* ==========================================================================
   TITLE
   ========================================================================== */
scene("title", () => {
  resetCamera();
  const save = loadSave();
  add([rect(width(), height()), color(16, 22, 36), fixed(), z(-100)]);

  // parallax-ish backdrop
  for (let i = 0; i < 4; i++) {
    add([sprite("cloud"), pos(120 + i * 330, 90 + (i % 2) * 70), opacity(0.5), z(0)]);
  }
  drawMountain(-40, height(), 420, 300, -60, 0.28);
  drawMountain(950, height(), 460, 340, -60, 0.28);

  add([...textShadow("PRESIDENT", { size: 92, font: "monospace" }),
       pos(width() / 2, 132), anchor("center")]);
  add([...textShadow("GAINS", { size: 128, font: "monospace" }),
       pos(width() / 2, 232), anchor("center"), color(255, 214, 80)]);

  const hero = add([sprite("tier3", { anim: "idle" }), pos(width() / 2, 470), anchor("bot"), scale(1.5)]);
  hero.onUpdate(() => { hero.scale.y = 1.5 + Math.sin(time() * 3) * 0.03; });

  add([sprite("egg"),  pos(width() / 2 - 170, 430), anchor("center"), scale(1.4)]);
  add([sprite("milk"), pos(width() / 2 + 170, 430), anchor("center"), scale(1.4)]);

  const hint = add([...textShadow("PRESS SPACE TO START", { size: 30, font: "monospace" }),
                    pos(width() / 2, 528), anchor("center")]);
  hint.onUpdate(() => { hint.opacity = 0.55 + Math.sin(time() * 5) * 0.45; });

  add([text(
        "←/→ or A/D  move    SPACE / ↑  jump    SHIFT  run    M  mute    R  restart",
        { size: 19, font: "monospace", align: "center" }),
      pos(width() / 2, 584), anchor("center"), color(220, 235, 255), opacity(0.85)]);

  const line = save.clears > 0
    ? `BEST ${save.hiscore}   FASTEST ${START_TIME - save.bestTime}s   CLEARED ${save.clears}x`
    : "EGGS AND MILK MAKE YOU SWOLE";
  add([text(line, { size: 21, font: "monospace" }), pos(width() / 2, 624),
       anchor("center"), color(255, 214, 80)]);

  onKeyPress("m", () => { writeSave({ muted: !loadSave().muted }); });
  onUpdate(() => { if (anyStart()) { writeSave({ runs: loadSave().runs + 1 }); go("game"); } });
});

/* ==========================================================================
   GAME
   ========================================================================== */
scene("game", (carry) => {
  const state = {
    lives: carry?.lives ?? 3,
    score: carry?.score ?? 0,
    coins: carry?.coins ?? 0,
    timeLeft: carry?.timeLeft ?? START_TIME,
    tier: 1,
    invuln: 0,
    finished: false,
    dead: false,
  };

  startMusic();
  armJumpInput();
  setCamScale(CAM_ZOOM);

  /* ---------------------------------------------------------- backdrop */
  // sky: the concept art's blue is a soft vertical gradient, so it is painted
  // as a few screen-space bands rather than one flat fill
  const SKY_TOP = [16, 113, 220], SKY_BOT = [40, 133, 223];
  const BANDS = 10;
  for (let i = 0; i < BANDS; i++) {
    const t = i / (BANDS - 1);
    add([
      rect(width(), Math.ceil(height() / BANDS) + 1),
      pos(0, (i * height()) / BANDS),
      color(...SKY_TOP.map((c, k) => Math.round(c + (SKY_BOT[k] - c) * t))),
      fixed(), z(-200),
    ]);
  }
  // fill under the level so no sky shows below the dirt
  add([rect(LEVEL_W, 600), pos(0, LEVEL_H), color(96, 58, 18), z(-90)]);

  /* ------------------------------------------------------------- level */
  /* The map is ~3000 tiles. One game object per tile costs about 5fps, because
     every object pays for an update pass and a collision entry whether or not
     anything about it ever changes. So runs of identical terrain are merged
     into single wide objects with a tiled sprite, and only the pieces that
     actually DO something — bricks, prize blocks, coins, enemies — stay
     individual. ~570 objects becomes ~150. */
  let prizeIndex = 0;
  let flagPole = null;
  let castleX = LEVEL_W - 300;

  const cull = () => offscreen({ hide: true, distance: 160 });
  const CHUNK = 16;                                    // tiles per merged strip
  const chunkCull = () => offscreen({ hide: true, distance: CHUNK * TILE + 160 });

  // one wide, tiled, solid strip
  function strip(spriteName, x, y, w, h, tags) {
    const comps = spriteName
      ? [sprite(spriteName, { width: w, height: h, tiled: true })]
      : [rect(w, h), opacity(0)];
    return add([...comps, pos(x, y), area(), body({ isStatic: true }), chunkCull(), ...tags]);
  }

  // group each row into runs of the same terrain character
  const TERRAIN = {
    "=": { sprite: "grass", tags: ["solid", "ground"] },
    "-": { sprite: null,    tags: [], decorative: true, drawn: "dirt" },
    "!": { sprite: "used",  tags: ["solid", "ground"] },
    "P": { sprite: null,    tags: ["solid", "ground"] },   // pipe body, drawn below
    "p": { sprite: null,    tags: ["solid", "ground"] },
    "q": { sprite: null,    tags: ["solid", "ground"] },
  };

  for (let row = 0; row < LEVEL.length; row++) {
    const line = LEVEL[row];
    let col = 0;
    while (col < line.length) {
      const ch = line[col];
      if (!(ch in TERRAIN)) { col++; continue; }
      // pipe characters merge together as one collider
      const cls = "Ppq".includes(ch) ? "pipe" : ch;
      let end = col;
      while (end + 1 < line.length) {
        const nxt = line[end + 1];
        const nxtCls = "Ppq".includes(nxt) ? "pipe" : nxt;
        if (nxtCls !== cls) break;
        end++;
      }
      /* Runs are emitted in chunks. `offscreen` culls on an object's origin
         point, not its bounds, so one 3000px-wide strip disappears the moment
         its left edge leaves the view — taking the visible ground with it. */
      const def = TERRAIN[ch];
      const y = row * TILE;
      for (let c = col; c <= end; c += CHUNK) {
        const cEnd = Math.min(end, c + CHUNK - 1);
        const x = c * TILE, w = (cEnd - c + 1) * TILE;
        if (def.decorative) {
          // draw dirt from its topmost row down in one piece: two stacked
          // strips leave a visible hairline seam between them
          if (row > 0 && LEVEL[row - 1][c] === ch) continue;
          let depth = 1;
          while (row + depth < LEVEL.length && LEVEL[row + depth][c] === ch) depth++;
          add([sprite(def.drawn, { width: w, height: depth * TILE, tiled: true }),
               pos(x, y), z(-1), chunkCull()]);
        } else {
          strip(def.sprite, x, y, w, TILE, def.tags);
        }
      }
      col = end + 1;
    }
  }

  /* --------------------------------------- interactive + tall + scenery */
  for (let row = 0; row < LEVEL.length; row++) {
    for (let col = 0; col < LEVEL[row].length; col++) {
      const ch = LEVEL[row][col];
      const x = col * TILE, y = row * TILE;

      if (ch === "b") {
        add([sprite("brick"), pos(x, y), area(), body({ isStatic: true }), cull(),
             "solid", "bumpable", "brick"]);
      } else if (ch === "?") {
        const gives = (prizeIndex++ % 3 === 0) ? "power" : "coin";
        add([sprite("qblock"), pos(x, y), area(), body({ isStatic: true }), cull(),
             "solid", "bumpable", "prize", { gives, spent: false }]);
      } else if (ch === "c") {
        add([sprite("coin"), pos(x + TILE / 2, y + TILE / 2), anchor("center"),
             area(), bob(5, 4), cull(), z(2), "pickup", "coinpickup"]);
      } else if (ch === "g") {
        add([sprite("goomba"), pos(x + TILE / 2, y + TILE), anchor("bot"),
             area({ scale: vec2(0.8, 0.9) }), body(), patrol(72),
             offscreen({ pause: true, unpause: true, distance: 800 }),
             "enemy", { squished: false }]);
      } else if (ch === "^") {
        add([sprite("bush"), pos(x - 12, y + TILE), anchor("bot"), z(-4), cull()]);
      } else if (ch === "M") {
        for (const part of drawMountain(x - 150, y + TILE, 300, 250, -8)) {
          part.use(cull());
        }
      } else if (ch === "~") {
        add([sprite("cloud"), pos(x, y), z(-5), opacity(0.9), cull()]);
      } else if (ch === "P") {
        let h = 1;
        while (row + h < LEVEL.length && LEVEL[row + h][col] === "q") h++;
        add([sprite("pipe", { width: TILE * 2, height: h * TILE }), pos(x, y), z(1), cull()]);
      } else if (ch === "F") {
        flagPole = add([sprite("flag"), pos(x, y), z(1),
                        area({ shape: new Rect(vec2(6, 0), 22, 190) }), "flagpole"]);
      } else if (ch === "C") {
        castleX = x;
        add([sprite("castle"), pos(x, y + TILE), anchor("bot"), z(-2)]);
      }
    }
  }

  /* ------------------------------------------------------------ player */
  const player = add([
    sprite("tier1", { anim: "idle" }),
    pos(3 * TILE, (LEVEL.length - 3) * TILE),
    anchor("bot"),
    // KAPLAY anchors a custom shape itself (using the shape's own size), so
    // this Rect starts at the origin, not at a hand-computed offset.
    area({ shape: new Rect(vec2(0, 0), HB_W, HB_H) }),
    body({ jumpForce: JUMP_FORCE }),
    opacity(1),
    z(5),
    "player",
  ]);

  let animName = "idle";
  function setAnim(name) {
    if (animName === name) return;
    animName = name;
    player.play(name);
  }

  function setTier(n, quiet) {
    const clamped = Math.max(1, Math.min(TIERS, n));
    if (clamped === state.tier) return;
    state.tier = clamped;
    player.use(sprite(`tier${clamped}`, { anim: animName }));
    if (!quiet) {
      const label = add([
        text(TIER_NAME[clamped], { size: 24, font: "monospace" }),
        pos(player.pos.x, player.pos.y - HB_H - 20), anchor("center"),
        color(255, 214, 80), outline(3, rgb(20, 26, 40)), z(20), opacity(1),
      ]);
      label.onUpdate(() => { label.pos.y -= 40 * dt(); label.opacity -= 1.1 * dt(); });
      wait(1, () => destroy(label));
    }
  }

  /* -------------------------------------------------------- player move */
  let facing = 1;
  let jumpCutUsed = true;   // one jump-cut per jump: tap = hop, hold = full jump
  let jumpStart = 0;
  const COYOTE = 0.1;       // brief grace after walking off a ledge
  let coyote = 0;
  let camY = null;

  player.onUpdate(() => {
    if (state.dead) return;

    if (state.invuln > 0) {
      state.invuln -= dt();
      player.opacity = Math.floor(time() * 20) % 2 ? 0.35 : 1;
      if (state.invuln <= 0) player.opacity = 1;
    }

    if (!state.finished) {
      const speed = heldRun() ? RUN_SPEED : WALK_SPEED;
      let moving = false;
      if (heldLeft())  { player.move(-speed, 0); facing = -1; moving = true; }
      if (heldRight()) { player.move(speed, 0);  facing = 1;  moving = true; }
      player.flipX = facing < 0;

      const grounded = player.isGrounded();
      if (grounded) { jumpCutUsed = true; coyote = COYOTE; }
      else coyote = Math.max(0, coyote - dt());

      pollJump();

      if (jumpBuffer > 0 && coyote > 0) {
        player.jump(JUMP_FORCE);
        jumpBuffer = 0;
        coyote = 0;
        jumpCutUsed = false;
        jumpStart = time();
        sfx("jump", { volume: 0.5 });
      } else {
        jumpBuffer = Math.max(0, jumpBuffer - dt());
      }
      // variable jump height: releasing early clips the rise, but never below
      // a minimum hold so a quick tap still clears two tiles
      if (!jumpCutUsed && !heldJump() && player.vel.y < 0 && time() - jumpStart > 0.09) {
        player.vel.y *= 0.45;
        jumpCutUsed = true;
      }

      setAnim(!grounded ? "jump" : (moving ? "walk" : "idle"));
    }

    // keep the player inside the level
    if (player.pos.x < HB_W / 2) player.pos.x = HB_W / 2;
    if (player.pos.x > LEVEL_W - HB_W / 2) player.pos.x = LEVEL_W - HB_W / 2;

    if (player.pos.y > DEATH_Y && !state.finished) die();

    /* Camera. Half-extents shrink with the zoom, so clamp against those.
       Vertically it sits locked to the bottom of the level — like the original
       games — and only lifts when the player's head nears the top of the view,
       so an ordinary jump never scrolls the ground off screen. */
    const halfW = width() / (2 * CAM_ZOOM);
    const halfH = height() / (2 * CAM_ZOOM);
    const camX = clamp(player.pos.x + 90, halfW, Math.max(halfW, LEVEL_W - halfW));

    let wantY = Math.max(halfH, LEVEL_H - halfH);
    const headY = player.pos.y - HB_H;
    const ceiling = wantY - halfH + 110;
    if (headY < ceiling) wantY = clamp(headY + halfH - 110, halfH, LEVEL_H - halfH);
    camY = camY === null ? wantY : lerp(camY, wantY, Math.min(1, dt() * 9));
    setCamPos(camX, camY);
  });

  /* ------------------------------------------------------------- blocks */
  function bumpBlock(block) {
    if (block.bumping) return;
    block.bumping = true;
    const baseY = block.pos.y;
    tween(baseY, baseY - 12, 0.08, (v) => (block.pos.y = v), easings.easeOutQuad)
      .then(() => tween(baseY - 12, baseY, 0.1, (v) => (block.pos.y = v), easings.easeInQuad)
      .then(() => { block.bumping = false; }));
  }

  function popCoin(x, y) {
    state.coins++;
    state.score += 200;
    sfx("coin", { volume: 0.5 });
    const c = add([sprite("coin"), pos(x, y), anchor("center"), z(6), opacity(1)]);
    let vy = -420;
    c.onUpdate(() => { vy += 1800 * dt(); c.pos.y += vy * dt(); c.opacity -= 1.6 * dt(); });
    wait(0.65, () => destroy(c));
  }

  function spawnPowerup(block) {
    const kind = state.tier === 1 ? "egg" : "milk";
    const item = add([
      sprite(kind), pos(block.pos.x + TILE / 2, block.pos.y - 4), anchor("bot"),
      area({ scale: vec2(0.85, 0.85) }), body(), z(4),
      "pickup", "powerpickup", { dir: 1, kind },
    ]);
    // rise out of the block, then wander
    item.paused = false;
    tween(item.pos.y, item.pos.y - TILE + 4, 0.35, (v) => (item.pos.y = v), easings.easeOutQuad);
    wait(0.36, () => {
      item.onUpdate(() => {
        item.move(item.dir * 110, 0);
        if (item.pos.x < TILE / 2 || item.pos.x > LEVEL_W - TILE / 2) item.dir *= -1;
      });
      item.onCollide("solid", (o, col) => {
        if (col && (col.isLeft() || col.isRight())) item.dir *= -1;
      });
    });
    sfx("1up", { volume: 0.4 });
  }

  function breakBrick(block) {
    sfx("brick", { volume: 0.5 });
    state.score += 50;
    for (let i = 0; i < 4; i++) {
      const p = add([
        rect(12, 12), color(150, 88, 44), pos(block.pos.x + 12 + (i % 2) * 20, block.pos.y + 12 + Math.floor(i / 2) * 20),
        outline(2, rgb(60, 32, 12)), rotate(0), anchor("center"), z(7), opacity(1),
      ]);
      const vx = (i % 2 ? 1 : -1) * rand(90, 200);
      let vy = -rand(320, 520);
      p.onUpdate(() => {
        vy += 2000 * dt();
        p.pos.x += vx * dt(); p.pos.y += vy * dt();
        p.angle += 400 * dt(); p.opacity -= 0.9 * dt();
      });
      wait(1.1, () => destroy(p));
    }
    destroy(block);
  }

  player.onCollide("bumpable", (block) => {
    /* Deliberately geometric rather than velocity-based: by the time this
       callback runs the physics step has already resolved the player against
       the block and zeroed vel.y, so `vel.y < 0` misses the hit. Instead:
       the block's underside is level with the head, and the player is under it. */
    const headY = player.pos.y - HB_H;
    const blockBottom = block.pos.y + TILE;
    const underIt = player.pos.x > block.pos.x - 8 && player.pos.x < block.pos.x + TILE + 8;
    if (!underIt || Math.abs(blockBottom - headY) > 22) return;

    if (block.is("prize")) {
      if (block.spent) { sfx("bump", { volume: 0.4 }); return; }
      block.spent = true;
      block.use(sprite("used"));
      bumpBlock(block);
      if (block.gives === "power" && state.tier < TIERS) spawnPowerup(block);
      else popCoin(block.pos.x + TILE / 2, block.pos.y - 10);
    } else if (block.is("brick")) {
      if (state.tier >= 3) breakBrick(block);
      else { bumpBlock(block); sfx("bump", { volume: 0.4 }); }
    }
  });

  /* ------------------------------------------------------------ pickups */
  player.onCollide("coinpickup", (c) => {
    destroy(c);
    popCoin(c.pos.x, c.pos.y);
  });

  player.onCollide("powerpickup", (item) => {
    destroy(item);
    sfx("power", { volume: 0.55 });
    state.score += 1000;
    setTier(state.tier + 1);
  });

  /* ------------------------------------------------------------ enemies */
  player.onCollide("enemy", (e) => {
    if (e.squished || state.finished || state.dead) return;
    const stomped = player.vel.y > 0 && player.pos.y < e.pos.y - 18;
    if (stomped) {
      // never unuse("area"/"body") — KAPLAY's collision pass walks the object
      // afterwards and blows up. Neutralise it with flags instead.
      e.squished = true;
      e.collisionIgnore = ["player", "enemy", "pickup"];
      e.scale = vec2(1, 0.35);
      e.pos.y += 2;
      state.score += 100;
      sfx("stomp", { volume: 0.55 });
      player.vel.y = -JUMP_FORCE * (heldJump() ? 0.72 : 0.5);
      wait(0.45, () => destroy(e));
    } else {
      hurt();
    }
  });

  /* ------------------------------------------------------- damage/death */
  function hurt() {
    if (state.invuln > 0 || state.finished || state.dead) return;
    if (state.tier > 1) {
      sfx("hurt", { volume: 0.5 });
      setTier(state.tier - 1, true);
      state.invuln = 2;
    } else {
      die();
    }
  }

  function die() {
    if (state.dead) return;
    state.dead = true;
    stopMusic();
    sfx("die", { volume: 0.55 });
    setAnim("squash");
    player.collisionIgnore = ["solid", "enemy", "bumpable", "pickup", "flagpole", "ground"];
    player.gravityScale = 0;
    player.vel = vec2(0, 0);
    let vy = -640;
    player.onUpdate(() => { vy += 1800 * dt(); player.pos.y += vy * dt(); });
    wait(1.6, () => {
      state.lives -= 1;
      persist();
      if (state.lives <= 0) go("lose", { score: state.score, coins: state.coins });
      else go("game", { lives: state.lives, score: state.score, coins: state.coins, timeLeft: START_TIME });
    });
  }

  /* ------------------------------------------------------------- finish */
  player.onCollide("flagpole", () => {
    if (state.finished) return;
    state.finished = true;
    stopMusic();
    sfx("win", { volume: 0.55 });

    player.collisionIgnore = ["solid", "enemy", "bumpable", "pickup", "flagpole", "ground"];
    player.gravityScale = 0;
    player.vel = vec2(0, 0);
    setAnim("idle");
    player.flipX = false;

    const groundY = (LEVEL.length - 2) * TILE;
    const slideFrom = player.pos.y;
    player.pos.x = flagPole.pos.x + 16;

    tween(slideFrom, groundY, 0.8, (v) => (player.pos.y = v), easings.linear).then(() => {
      setAnim("walk");
      const walkTo = castleX + 70;
      const dist = Math.max(1, walkTo - player.pos.x);
      tween(player.pos.x, walkTo, dist / 220, (v) => (player.pos.x = v), easings.linear).then(() => {
        tween(1, 0, 0.4, (v) => (player.opacity = v));
        wait(0.6, () => {
          const bonus = Math.floor(state.timeLeft) * 50;
          state.score += bonus;
          persist(true);
          go("win", { score: state.score, coins: state.coins, bonus, timeLeft: Math.floor(state.timeLeft) });
        });
      });
    });
  });

  function persist(cleared) {
    const save = loadSave();
    const patch = {
      hiscore: Math.max(save.hiscore, state.score),
      coins: save.coins + 0,
    };
    if (cleared) {
      patch.clears = save.clears + 1;
      patch.bestTime = Math.max(save.bestTime, Math.floor(state.timeLeft));
      patch.coins = save.coins + state.coins;
    }
    writeSave(patch);
  }

  /* --------------------------------------------------------------- time */
  loop(0.4, () => {
    if (state.finished || state.dead) return;
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) { state.timeLeft = 0; die(); }
  });

  /* ---------------------------------------------------------------- HUD */
  const hudStyle = { size: 26, font: "monospace" };
  const mk = (x, y, str) => add([
    text(str, hudStyle), pos(x, y), fixed(), z(100),
    color(255, 255, 255), outline(4, rgb(20, 26, 40)),
  ]);

  add([sprite("head"), pos(28, 22), fixed(), z(100), scale(0.9)]);
  const livesTxt = mk(64, 26, "x3");
  add([sprite("coin"), pos(190, 22), fixed(), z(100)]);
  const coinTxt  = mk(224, 26, "x00");
  const scoreTxt = mk(430, 26, "SCORE 000000");
  const timeTxt  = mk(width() - 220, 26, "TIME 320");
  const tierTxt  = add([
    text("ROOKIE", { size: 22, font: "monospace" }), pos(width() - 220, 62),
    fixed(), z(100), color(255, 214, 80), outline(4, rgb(20, 26, 40)),
  ]);

  onUpdate(() => {
    livesTxt.text = "x" + state.lives;
    coinTxt.text  = "x" + String(state.coins).padStart(2, "0");
    scoreTxt.text = "SCORE " + String(state.score).padStart(6, "0");
    timeTxt.text  = "TIME " + String(Math.max(0, Math.ceil(state.timeLeft))).padStart(3, "0");
    tierTxt.text  = TIER_NAME[state.tier];
  });

  onKeyPress("r", () => { stopMusic(); go("title"); });
  onKeyPress("m", () => {
    const muted = !loadSave().muted;
    writeSave({ muted });
    if (muted) stopMusic(); else startMusic();
  });
  onKeyPress("f1", () => { debug.inspect = !debug.inspect; });
});

/* ==========================================================================
   LOSE / WIN
   ========================================================================== */
scene("lose", ({ score, coins }) => {
  stopMusic();
  resetCamera();
  add([rect(width(), height()), color(16, 22, 36), fixed()]);
  add([...textShadow("SKIPPED LEG DAY", { size: 68, font: "monospace" }),
       pos(width() / 2, 200), anchor("center")]);
  add([sprite("tier1"), pos(width() / 2, 400), anchor("bot"), scale(1.4)]);
  add([text(`SCORE ${score}    COINS ${coins}`, { size: 30, font: "monospace" }),
       pos(width() / 2, 452), anchor("center"), color(255, 214, 80)]);
  const hint = add([text("PRESS SPACE", { size: 26, font: "monospace" }),
                    pos(width() / 2, 528), anchor("center"), color(230, 240, 255)]);
  hint.onUpdate(() => { hint.opacity = 0.5 + Math.sin(time() * 5) * 0.5; });
  onUpdate(() => { if (anyStart()) go("title"); });
});

scene("win", ({ score, coins, bonus, timeLeft }) => {
  stopMusic();
  resetCamera();
  const save = loadSave();
  add([rect(width(), height()), color(16, 22, 36), fixed()]);
  add([...textShadow("BEAST MODE", { size: 58, font: "monospace" }),
       pos(width() / 2, 118), anchor("center")]);
  add([...textShadow("ACHIEVED", { size: 86, font: "monospace" }),
       pos(width() / 2, 196), anchor("center"), color(255, 214, 80)]);
  add([sprite("tier3"), pos(width() / 2, 430), anchor("bot"), scale(1.5)]);

  const rows = [
    `COINS        ${coins}`,
    `TIME BONUS   ${bonus}`,
    `FINAL SCORE  ${score}`,
    `BEST         ${save.hiscore}`,
  ];
  rows.forEach((r, i) => add([
    text(r, { size: 25, font: "monospace" }),
    pos(width() / 2, 466 + i * 34), anchor("center"),
    color(i === 2 ? 255 : 220, i === 2 ? 214 : 235, i === 2 ? 80 : 255),
  ]));

  const hint = add([text("PRESS SPACE", { size: 24, font: "monospace" }),
                    pos(width() / 2, 626), anchor("center"), color(230, 240, 255)]);
  hint.onUpdate(() => { hint.opacity = 0.5 + Math.sin(time() * 5) * 0.5; });
  onUpdate(() => { if (anyStart()) go("title"); });
});

go("title");
