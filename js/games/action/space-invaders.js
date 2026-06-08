// Food Fight Invaders — a juicy, food-themed take on Space Invaders, made
// "10× more powerful". You pilot a launcher at the bottom and fire FIVE kinds
// of food up at a marching alien horde. Each food is its own weapon with an
// independent energy meter that recharges over time — so you toggle between
// cupcakes, pizza, burgers, tacos and explosive chili and keep launching.
// Pure Canvas-2D (no external libs) so it runs anywhere, offline included.
import { el, header, toolbar, status, setStatus } from '../../helpers.js';
import { celebrate } from '../../celebration.js';
import { timers } from '../../timer.js';
import { rngFor } from '../../rng.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The arsenal. Each weapon recharges on its own clock, so the loop is:
// recharge five foods → toggle to a charged one → launch.
const WEAPONS = [
  { key: 'cupcake', emoji: '🧁', name: 'Cupcake', hot: '1', color: '#ff9ecd', kind: 'straight',  dmg: 1, cost: 8,  recharge: 46, cooldown: 0.14, speed: 580, r: 9,  blurb: 'Rapid-fire' },
  { key: 'pizza',   emoji: '🍕', name: 'Pizza',   hot: '2', color: '#ffb13b', kind: 'spread',    dmg: 1, cost: 28, recharge: 27, cooldown: 0.40, speed: 500, r: 10, spread: 3, spreadAng: 0.26, blurb: '3-way spread' },
  { key: 'burger',  emoji: '🍔', name: 'Burger',  hot: '3', color: '#d2913f', kind: 'pierce',    dmg: 4, cost: 46, recharge: 16, cooldown: 0.62, speed: 380, r: 16, blurb: 'Heavy · pierces' },
  { key: 'taco',    emoji: '🌮', name: 'Taco',    hot: '4', color: '#ffd23b', kind: 'homing',    dmg: 2, cost: 34, recharge: 21, cooldown: 0.50, speed: 400, r: 12, blurb: 'Homing seeker' },
  { key: 'chili',   emoji: '🌶️', name: 'Chili',  hot: '5', color: '#ff4d4d', kind: 'explosive', dmg: 6, cost: 60, recharge: 11, cooldown: 0.82, speed: 440, r: 13, blastR: 84, blurb: 'Explodes (AoE)' },
];

const ALIEN_TYPES = ['🛸', '👾', '👽', '🤖', '👻'];
const ALIEN_COLORS = ['#9b8cff', '#54e0a8', '#7cd6ff', '#ffd166', '#ff9ecd'];

export function spaceInvaders(shell, { getMode, seed = null, onResult = null }) {
  const mode = getMode();
  const rng = rngFor(seed);
  const adv = mode === 'advanced';
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---- Tunables (grouped for easy balancing) -----------------------------
  const COLS = adv ? 9 : 7;
  const ROWS = adv ? 5 : 4;
  const TARGET_WAVES = adv ? 5 : 3;
  const START_LIVES = 3;
  const MARCH_BASE = adv ? 34 : 26;     // horizontal units/sec at wave 1
  const MARCH_WAVE = adv ? 9 : 7;       // extra per wave
  const STEP_DOWN = adv ? 20 : 17;      // descent on edge contact
  const BOMB_BASE = adv ? 1.05 : 1.6;   // seconds between alien bombs (wave 1)
  const BOMB_SPEED = adv ? 230 : 195;
  const MOVE_SPEED = 360;               // launcher units/sec (keyboard/buttons)
  const COMBO_WINDOW = 1.25;
  const DROP_CHANCE = 0.07;             // power-up drop per alien killed

  const LW = 540, LH = 660;             // logical playfield (resolution-independent)
  const MARGIN = 38;
  const PLAYER_LINE = LH - 96;          // aliens crossing this = game over
  const bestKey = `ba_best_space-invaders_${mode}`;
  const readBest = () => { try { return parseInt(localStorage.getItem(bestKey) || '0', 10) || 0; } catch (e) { return 0; } };
  const writeBest = (v) => { try { localStorage.setItem(bestKey, String(v)); } catch (e) { /* ignore */ } };

  // ---- Chrome -------------------------------------------------------------
  header(shell, {
    title: '👾 Food Fight Invaders',
    tag: `${ROWS}×${COLS} horde · survive ${TARGET_WAVES} waves`,
    desc: 'Launch five recharging foods at the invaders: 🧁 rapid · 🍕 spread · 🍔 piercing · 🌮 homing · 🌶️ explosive. Move ← → (or drag), fire with Space / tap, switch foods with 1–5. Don’t let the horde reach you.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost', type: 'button' }, '↺ Restart');
  const pauseBtn = el('button', { class: 'btn ghost', type: 'button' }, '⏸ Pause');
  const muteBtn = el('button', { class: 'btn ghost', type: 'button' }, '🔊 Sound');
  tb.append(restartBtn, pauseBtn, muteBtn);
  const s = status(shell);

  // HUD chips
  const hud = el('div', { class: 'si-hud' });
  const mkChip = (label, val) => {
    const v = el('b', {}, val);
    const chip = el('span', { class: 'si-chip' }, [el('span', { class: 'si-chip-label' }, label), v]);
    return { chip, v };
  };
  const cScore = mkChip('Score', '0');
  const cBest = mkChip('Best', String(readBest()));
  const cWave = mkChip('Wave', `1/${TARGET_WAVES}`);
  const cLives = mkChip('Lives', '❤️❤️❤️');
  const cCombo = mkChip('Combo', '×1');
  cCombo.chip.classList.add('si-combo', 'hidden');
  hud.append(cScore.chip, cBest.chip, cWave.chip, cLives.chip, cCombo.chip);
  shell.appendChild(hud);

  // Stage + canvas + flash overlay
  const stage = el('div', { class: 'si-stage' });
  const canvas = el('canvas', { class: 'si-canvas' });
  const flash = el('div', { class: 'si-flash hidden' });
  stage.append(canvas, flash);
  shell.appendChild(stage);
  const ctx = canvas.getContext('2d');

  // Weapon rack (click/tap to switch; bar shows recharge)
  const rack = el('div', { class: 'si-rack' });
  const chipEls = [];
  const barFills = [];
  WEAPONS.forEach((w, i) => {
    const fill = el('span', { class: 'si-bar-fill' });
    const chip = el('button', {
      class: 'si-weapon', type: 'button', 'data-key': w.key,
      title: `${w.name} — ${w.blurb} (key ${w.hot})`,
    }, [
      el('span', { class: 'si-weapon-top' }, [
        el('span', { class: 'si-weapon-emoji' }, w.emoji),
        el('span', { class: 'si-weapon-key' }, w.hot),
      ]),
      el('span', { class: 'si-weapon-name' }, w.name),
      el('span', { class: 'si-bar' }, fill),
    ]);
    chip.addEventListener('click', () => selectWeapon(i));
    rack.appendChild(chip);
    chipEls.push(chip); barFills.push(fill);
  });
  shell.appendChild(rack);

  // Mobile controls (hidden on desktop via CSS)
  const ctrls = el('div', { class: 'si-controls' });
  const btnL = el('button', { class: 'si-ctl-btn', type: 'button', 'aria-label': 'Move left' }, '◀');
  const btnFire = el('button', { class: 'si-ctl-btn si-ctl-fire', type: 'button', 'aria-label': 'Fire' }, '🔥');
  const btnR = el('button', { class: 'si-ctl-btn', type: 'button', 'aria-label': 'Move right' }, '▶');
  const btnSwap = el('button', { class: 'si-ctl-btn', type: 'button', 'aria-label': 'Next food' }, '⟳');
  ctrls.append(btnL, btnFire, btnR, btnSwap);
  shell.appendChild(ctrls);

  // ---- Audio (tiny WebAudio, created on first gesture) --------------------
  const audio = makeAudio();
  let muted = false;

  // ---- Game state ---------------------------------------------------------
  let aliens = [], shots = [], bombs = [], parts = [], pops = [], powers = [], barriers = [], stars = [];
  const energy = WEAPONS.map(() => 100);
  const lastFire = WEAPONS.map(() => -10);
  let active = 0;
  let launcher = { x: LW / 2, y: LH - 44 };
  let dir = 1, marchSpeed = MARCH_BASE, totalCount = COLS * ROWS, aliveCount = totalCount;
  let wave = 1, score = 0, lives = START_LIVES, best = readBest();
  let combo = 0, comboT = 0, comboMult = 1;
  let damageMult = 1, damageT = 0;
  let invulnT = 0, shakeT = 0, bombT = BOMB_BASE, gameTime = 0;
  let ended = false, won = false, paused = false, rafId = null, last = 0;

  const input = { left: false, right: false, fire: false, btnDir: 0, btnFire: false };
  const ptr = { active: false, x: LW / 2 };
  const hook = {}; // test/debug snapshot, mirrored to window.__SI

  // ---- View / sizing ------------------------------------------------------
  let scale = 1, DPR = 1;
  function size() {
    const availW = Math.min(stage.clientWidth || LW, 600);
    const availH = clamp(window.innerHeight * 0.72, 360, 760);
    let sc = availW / LW;
    if (LH * sc > availH) sc = availH / LH;
    scale = sc;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const cssW = LW * sc, cssH = LH * sc;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);
    ctx.setTransform(sc * DPR, 0, 0, sc * DPR, 0, 0);
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Setup --------------------------------------------------------------
  function makeStars() {
    stars = [];
    const n = reduceMotion ? 40 : 90;
    for (let i = 0; i < n; i++) {
      stars.push({ x: rng() * LW, y: rng() * LH, z: 0.4 + rng() * 1.6, sz: 0.6 + rng() * 1.8 });
    }
  }

  function baseHp(row) {
    const tough = (ROWS - 1 - row); // top rows are tougher
    return clamp(1 + Math.floor(tough / 2) + Math.floor((wave - 1) / 2) + (adv ? 1 : 0), 1, 7);
  }

  function buildFormation() {
    aliens = [];
    const cellW = (LW - MARGIN * 2) / COLS;
    const cellH = 42;
    const startY = 74;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tough = (ROWS - 1 - r);
        aliens.push({
          id: r * COLS + c, col: c, row: r,
          x: MARGIN + cellW * (c + 0.5), y: startY + cellH * r,
          r: Math.min(cellW, cellH) * 0.34,
          size: Math.min(cellW, cellH) * 0.74,
          hp: baseHp(r), maxHp: baseHp(r),
          type: ALIEN_TYPES[Math.min(r, ALIEN_TYPES.length - 1)],
          color: ALIEN_COLORS[r % ALIEN_COLORS.length],
          points: 10 + tough * 8,
          alive: true, deathT: 0, hitFlash: 0,
        });
      }
    }
    totalCount = aliens.length;
    aliveCount = totalCount;
    dir = 1;
    marchSpeed = MARCH_BASE + (wave - 1) * MARCH_WAVE;
  }

  function buildBarriers() {
    barriers = [];
    const n = adv ? 4 : 3;
    const by = PLAYER_LINE - 58;
    for (let i = 0; i < n; i++) {
      const x = (LW / (n + 1)) * (i + 1);
      barriers.push({ x, y: by, w: 64, h: 22, hp: 6, maxHp: 6 });
    }
  }

  function startWave() {
    buildFormation();
    bombT = Math.max(0.5, BOMB_BASE - (wave - 1) * 0.12);
    cWave.v.textContent = `${wave}/${TARGET_WAVES}`;
    showFlash(`WAVE ${wave}`, 1100);
  }

  function start() {
    shots = []; bombs = []; parts = []; pops = []; powers = [];
    for (let i = 0; i < WEAPONS.length; i++) { energy[i] = 100; lastFire[i] = -10; }
    active = 0; selectWeapon(0);
    launcher = { x: LW / 2, y: LH - 44 };
    ptr.x = LW / 2;
    wave = 1; score = 0; lives = START_LIVES;
    combo = 0; comboT = 0; comboMult = 1; damageMult = 1; damageT = 0;
    invulnT = 0; shakeT = 0; gameTime = 0;
    ended = false; won = false; paused = false;
    pauseBtn.textContent = '⏸ Pause';
    best = readBest();
    cBest.v.textContent = String(best);
    updateHud();
    buildBarriers();
    makeStars();
    startWave();
    setStatus(s, 'Tip: each food recharges on its own — keep toggling 1–5 and let them refill!');
    timers.resetGame();
  }

  // ---- Weapons / firing ---------------------------------------------------
  function selectWeapon(i) {
    active = clamp(i, 0, WEAPONS.length - 1);
    chipEls.forEach((c, idx) => c.classList.toggle('active', idx === active));
    hook.weapon = active;
  }
  function cycleWeapon(d) { selectWeapon((active + d + WEAPONS.length) % WEAPONS.length); }

  function nearestAlien(x, y) {
    let best = null, bd = Infinity;
    for (const a of aliens) {
      if (!a.alive) continue;
      const d = (a.x - x) ** 2 + (a.y - y) ** 2;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function tryFire() {
    const w = WEAPONS[active];
    if (gameTime - lastFire[active] < w.cooldown) return;
    if (energy[active] < w.cost) return;
    energy[active] -= w.cost;
    lastFire[active] = gameTime;
    audio.fire();
    const mx = launcher.x, my = launcher.y - 22;
    const dmg = w.dmg * damageMult;
    const base = { r: w.r, dmg, color: w.color, emoji: w.emoji, kind: w.kind, spin: rng() * 6 };
    if (w.kind === 'spread') {
      for (let k = 0; k < w.spread; k++) {
        const a = (k - (w.spread - 1) / 2) * w.spreadAng;
        shots.push({ ...base, x: mx, y: my, vx: Math.sin(a) * w.speed, vy: -Math.cos(a) * w.speed, hitSet: new Set() });
      }
    } else if (w.kind === 'pierce') {
      shots.push({ ...base, x: mx, y: my, vx: 0, vy: -w.speed, pierce: true, hitSet: new Set() });
    } else if (w.kind === 'homing') {
      shots.push({ ...base, x: mx, y: my, vx: 0, vy: -w.speed, homing: true, speed: w.speed, hitSet: new Set() });
    } else if (w.kind === 'explosive') {
      shots.push({ ...base, x: mx, y: my, vx: 0, vy: -w.speed, explosive: true, blastR: w.blastR, hitSet: new Set() });
    } else {
      shots.push({ ...base, x: mx, y: my, vx: 0, vy: -w.speed, hitSet: new Set() });
    }
  }

  // ---- Effects ------------------------------------------------------------
  function burst(x, y, color, n) {
    if (reduceMotion) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, sp = 40 + rng() * 180;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + rng() * 0.5, max: 1, color, sz: 2 + rng() * 4 });
    }
    if (parts.length > 280) parts.splice(0, parts.length - 280);
  }
  function spawnPop(x, y, text, color) {
    pops.push({ x, y, vy: -46, life: 0.9, max: 0.9, text, color });
  }
  function addShake(v) { if (!reduceMotion) shakeT = Math.min(0.5, shakeT + v); }
  function showFlash(text, ms = 1200) {
    flash.textContent = text;
    flash.classList.remove('hidden');
    flash.style.animation = 'none';
    // restart the pop animation
    void flash.offsetHeight;
    flash.style.animation = '';
    clearTimeout(showFlash._t);
    showFlash._t = setTimeout(() => flash.classList.add('hidden'), ms);
  }

  // ---- Damage / kills -----------------------------------------------------
  function hitAlien(a, dmg) {
    a.hp -= dmg;
    a.hitFlash = 0.12;
    if (a.hp <= 0 && a.alive) killAlien(a);
  }
  function killAlien(a) {
    a.alive = false; a.deathT = 0;
    aliveCount--;
    // combo
    combo = combo + 1; comboT = COMBO_WINDOW;
    comboMult = Math.min(5, combo);
    const gained = Math.round(a.points * (1 + (wave - 1) * 0.2) * comboMult);
    score += gained;
    spawnPop(a.x, a.y, `+${gained}`, comboMult > 1 ? '#ffd166' : '#fff');
    if (comboMult >= 3) showFlash(`COMBO ×${comboMult}!`, 700);
    burst(a.x, a.y, a.color, 9);
    audio.hit();
    if (rng() < DROP_CHANCE) dropPower(a.x, a.y);
    // speed up as the horde thins (classic)
    marchSpeed = (MARCH_BASE + (wave - 1) * MARCH_WAVE) * (1 + (1 - aliveCount / totalCount) * 1.3);
  }
  function explodeAt(x, y, radius, dmg) {
    burst(x, y, '#ffae42', 26);
    addShake(0.4); audio.boom();
    for (const a of aliens) {
      if (a.alive && (a.x - x) ** 2 + (a.y - y) ** 2 <= radius * radius) hitAlien(a, dmg);
    }
    // explosions also chew through barriers
    for (const b of barriers) {
      if (b.hp > 0 && Math.abs(b.x - x) < radius && Math.abs(b.y - y) < radius) b.hp = Math.max(0, b.hp - 2);
    }
  }

  function dropPower(x, y) {
    const types = ['energy', 'damage', 'life'];
    const type = types[Math.floor(rng() * types.length)];
    const emoji = type === 'energy' ? '⚡' : type === 'damage' ? '⭐' : '❤️';
    powers.push({ x, y, vy: 120, type, emoji });
  }
  function applyPower(p) {
    audio.power();
    if (p.type === 'energy') { for (let i = 0; i < energy.length; i++) energy[i] = 100; spawnPop(launcher.x, launcher.y - 30, 'RECHARGED!', '#06d6a0'); }
    else if (p.type === 'damage') { damageMult = 2; damageT = 8; spawnPop(launcher.x, launcher.y - 30, '2× DAMAGE!', '#ffd166'); }
    else { lives = Math.min(5, lives + 1); spawnPop(launcher.x, launcher.y - 30, '+1 LIFE', '#ef476f'); updateHud(); }
  }

  function loseLife() {
    lives--; updateHud();
    audio.hurt(); addShake(0.45);
    invulnT = 1.5;
    combo = 0; comboMult = 1;
    showFlash('💥 HIT!', 700);
    if (lives <= 0) endGame(false);
  }

  // ---- End ----------------------------------------------------------------
  function endGame(win) {
    if (ended) return;
    ended = true; won = win;
    timers.stopGame();
    if (score > best) { best = score; writeBest(best); cBest.v.textContent = String(best); }
    showFlash(win ? '🏆 VICTORY!' : 'GAME OVER', 2400);
    if (win) audio.win();
    setStatus(s, win
      ? `You cleared all ${TARGET_WAVES} waves! Final score ${score}.`
      : `The horde broke through. Final score ${score}. Press Restart to try again.`, win ? 'good' : 'bad');
    if (onResult) {
      onResult({ solved: win, score, timeMs: timers.getGameElapsed() });
    } else if (win) {
      celebrate({
        gameName: 'Food Fight Invaders',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Score <b>${score}</b> · ${TARGET_WAVES} waves · ${lives} ❤️ left`,
      });
    }
  }

  // ---- Update -------------------------------------------------------------
  function update(dt) {
    gameTime += dt;
    if (invulnT > 0) invulnT -= dt;
    if (damageT > 0) { damageT -= dt; if (damageT <= 0) damageMult = 1; }
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; comboMult = 1; } }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

    // recharge every weapon
    for (let i = 0; i < energy.length; i++) energy[i] = clamp(energy[i] + WEAPONS[i].recharge * dt, 0, 100);

    // launcher movement
    let mv = 0;
    if (input.left) mv -= 1;
    if (input.right) mv += 1;
    mv += input.btnDir;
    launcher.x += mv * MOVE_SPEED * dt;
    if (ptr.active) launcher.x += clamp(ptr.x - launcher.x, -MOVE_SPEED * dt, MOVE_SPEED * dt);
    launcher.x = clamp(launcher.x, MARGIN, LW - MARGIN);

    // firing
    if (input.fire || input.btnFire || ptr.active) tryFire();

    // stars parallax
    for (const st of stars) { st.y += st.z * 10 * dt; if (st.y > LH) { st.y = 0; st.x = rng() * LW; } }

    // formation march
    if (aliveCount > 0) {
      let minx = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (const a of aliens) {
        if (!a.alive) continue;
        a.x += dir * marchSpeed * dt;
        if (a.hitFlash > 0) a.hitFlash -= dt;
        if (a.x - a.r < minx) minx = a.x - a.r;
        if (a.x + a.r > maxx) maxx = a.x + a.r;
        if (a.y + a.r > maxy) maxy = a.y + a.r;
      }
      if (minx < MARGIN && dir < 0) { dir = 1; for (const a of aliens) a.y += STEP_DOWN; }
      else if (maxx > LW - MARGIN && dir > 0) { dir = -1; for (const a of aliens) a.y += STEP_DOWN; }
      if (maxy >= PLAYER_LINE) return endGame(false);
    }

    // alien bombs
    bombT -= dt;
    if (bombT <= 0 && aliveCount > 0 && !ended) {
      const live = aliens.filter((a) => a.alive);
      const a = live[Math.floor(rng() * live.length)];
      if (a) bombs.push({ x: a.x, y: a.y + a.r, vy: BOMB_SPEED });
      bombT = Math.max(0.4, (BOMB_BASE - (wave - 1) * 0.12)) * (0.6 + rng() * 0.8);
    }

    // shots
    for (const sh of shots) {
      if (sh.homing) {
        const tgt = nearestAlien(sh.x, sh.y);
        if (tgt) {
          const ang = Math.atan2(tgt.y - sh.y, tgt.x - sh.x);
          const cur = Math.atan2(sh.vy, sh.vx);
          let na = cur + clamp(((ang - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -3 * dt, 3 * dt);
          sh.vx = Math.cos(na) * sh.speed; sh.vy = Math.sin(na) * sh.speed;
        }
      }
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.spin += dt * 8;
      // vs aliens
      for (const a of aliens) {
        if (!a.alive || sh.dead) continue;
        if (sh.hitSet && sh.hitSet.has(a.id)) continue;
        const rr = a.r + sh.r;
        if ((a.x - sh.x) ** 2 + (a.y - sh.y) ** 2 <= rr * rr) {
          if (sh.explosive) { explodeAt(sh.x, sh.y, sh.blastR, sh.dmg); sh.dead = true; break; }
          hitAlien(a, sh.dmg);
          burst(sh.x, sh.y, sh.color, 4);
          if (sh.pierce) { sh.hitSet.add(a.id); }
          else { sh.dead = true; break; }
        }
      }
      if (sh.y < -20 || sh.x < -20 || sh.x > LW + 20) sh.dead = true;
    }
    shots = shots.filter((sh) => !sh.dead);

    // bombs
    for (const b of bombs) {
      b.y += b.vy * dt;
      for (const bar of barriers) {
        if (bar.hp > 0 && Math.abs(b.x - bar.x) < bar.w / 2 && b.y > bar.y && b.y < bar.y + bar.h) {
          bar.hp--; b.dead = true; burst(b.x, b.y, '#7cd6ff', 6); break;
        }
      }
      if (!b.dead && b.y >= launcher.y - 14 && Math.abs(b.x - launcher.x) < 26) {
        b.dead = true;
        if (invulnT <= 0) { burst(launcher.x, launcher.y, '#ff4d4d', 14); loseLife(); }
      }
      if (b.y > LH + 10) b.dead = true;
    }
    bombs = bombs.filter((b) => !b.dead);

    // power-ups
    for (const p of powers) {
      p.y += p.vy * dt;
      if (p.y >= launcher.y - 16 && Math.abs(p.x - launcher.x) < 30) { p.dead = true; applyPower(p); }
      else if (p.y > LH + 10) p.dead = true;
    }
    powers = powers.filter((p) => !p.dead);

    // particles + popups + death anims
    for (const pt of parts) { pt.life -= dt; pt.vy += 220 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
    parts = parts.filter((pt) => pt.life > 0);
    for (const p of pops) { p.life -= dt; p.y += p.vy * dt; }
    pops = pops.filter((p) => p.life > 0);
    for (const a of aliens) { if (!a.alive) a.deathT += dt; }
    aliens = aliens.filter((a) => a.alive || a.deathT < 0.4);

    // wave clear?
    if (aliveCount <= 0 && !ended) {
      if (wave >= TARGET_WAVES) return endGame(true);
      wave++;
      startWave();
    }
  }

  // ---- Draw ---------------------------------------------------------------
  function draw() {
    let ox = 0, oy = 0;
    if (shakeT > 0) { const m = shakeT * 14; ox = (rng() - 0.5) * m; oy = (rng() - 0.5) * m; }
    ctx.save();
    ctx.translate(ox, oy);

    // space backdrop
    const g = ctx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#0a0f24'); g.addColorStop(0.6, '#0d1430'); g.addColorStop(1, '#1a1140');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, LW + 40, LH + 40);
    for (const st of stars) { ctx.globalAlpha = 0.3 + st.z * 0.3; ctx.fillStyle = '#cfe0ff'; ctx.fillRect(st.x, st.y, st.sz, st.sz); }
    ctx.globalAlpha = 1;

    // player line
    ctx.strokeStyle = 'rgba(239,71,111,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(0, PLAYER_LINE); ctx.lineTo(LW, PLAYER_LINE); ctx.stroke(); ctx.setLineDash([]);

    // barriers
    for (const b of barriers) {
      if (b.hp <= 0) continue;
      const k = b.hp / b.maxHp;
      ctx.globalAlpha = 0.4 + k * 0.6;
      ctx.fillStyle = '#3ad29f';
      rrect(b.x - b.w / 2, b.y + (1 - k) * b.h * 0.4, b.w, b.h * (0.5 + k * 0.5), 6); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // aliens
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of aliens) {
      ctx.save();
      if (a.alive) {
        const bob = Math.sin(gameTime * 3 + a.col * 0.6) * 2;
        ctx.translate(a.x, a.y + bob);
        if (a.hitFlash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; }
        ctx.font = `${a.size}px serif`;
        ctx.fillText(a.type, 0, 0);
        // HP pip for tougher aliens
        if (a.maxHp > 1) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrect(-a.r, a.r * 0.8, a.r * 2, 4, 2); ctx.fill();
          ctx.fillStyle = a.color; rrect(-a.r, a.r * 0.8, a.r * 2 * (a.hp / a.maxHp), 4, 2); ctx.fill();
        }
      } else {
        const k = a.deathT / 0.4;
        ctx.globalAlpha = 1 - k; ctx.translate(a.x, a.y); ctx.rotate(k * 5); ctx.scale(1 + k, 1 + k);
        ctx.font = `${a.size}px serif`; ctx.fillText('💥', 0, 0);
      }
      ctx.restore();
    }

    // power-ups
    for (const p of powers) {
      ctx.save(); ctx.translate(p.x, p.y + Math.sin(gameTime * 6) * 2);
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; ctx.font = '22px serif'; ctx.fillText(p.emoji, 0, 0); ctx.restore();
    }

    // shots
    for (const sh of shots) {
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.spin);
      ctx.shadowColor = sh.color; ctx.shadowBlur = 12;
      ctx.font = `${sh.r * 2}px serif`; ctx.fillText(sh.emoji, 0, 0); ctx.restore();
    }

    // bombs (alien goo)
    for (const b of bombs) {
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.shadowColor = '#b06bff'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#b06bff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e2c4ff'; ctx.beginPath(); ctx.arc(-1.5, -1.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // launcher
    drawLauncher();

    // particles
    for (const pt of parts) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1); ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.sz, pt.sz);
    }
    ctx.globalAlpha = 1;

    // popups
    for (const p of pops) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color; ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    if (paused && !ended) {
      ctx.fillStyle = 'rgba(8,12,28,0.6)'; ctx.fillRect(0, 0, LW, LH);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('⏸ PAUSED', LW / 2, LH / 2);
    }
  }

  function drawLauncher() {
    const lx = launcher.x, ly = launcher.y, w = WEAPONS[active];
    ctx.save();
    if (invulnT > 0 && Math.floor(invulnT * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    if (damageMult > 1) { ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 16; }
    ctx.fillStyle = '#3a4690'; rrect(lx - 28, ly - 4, 56, 18, 8); ctx.fill();
    ctx.fillStyle = w.color; rrect(lx - 32, ly + 10, 64, 9, 5); ctx.fill();
    ctx.fillStyle = '#4a58b0'; rrect(lx - 7, ly - 18, 14, 16, 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '20px serif'; ctx.fillText(w.emoji, lx, ly - 22);
    ctx.restore();
  }

  // ---- HUD ----------------------------------------------------------------
  function updateHud() {
    cScore.v.textContent = String(score);
    cWave.v.textContent = `${wave}/${TARGET_WAVES}`;
    cLives.v.textContent = lives > 0 ? '❤️'.repeat(lives) : '—';
  }
  function updateHudLive() {
    cScore.v.textContent = String(score);
    if (comboMult > 1) { cCombo.chip.classList.remove('hidden'); cCombo.v.textContent = `×${comboMult}`; }
    else cCombo.chip.classList.add('hidden');
    for (let i = 0; i < barFills.length; i++) {
      barFills[i].style.width = energy[i] + '%';
      chipEls[i].classList.toggle('charged', energy[i] >= WEAPONS[i].cost);
    }
  }

  // ---- Loop ---------------------------------------------------------------
  function step(t) {
    if (!last) last = t;
    const dt = Math.min(0.04, (t - last) / 1000); last = t;
    if (!paused && !ended) update(dt);
    draw();
    updateHudLive();
    publish();
    rafId = requestAnimationFrame(step);
  }

  // ---- Test/debug hook (harmless in production) ---------------------------
  function publish() {
    hook.score = score; hook.best = best; hook.wave = wave; hook.lives = lives;
    hook.aliensLeft = aliveCount; hook.weapon = active; hook.energy = energy.slice();
    hook.x = Math.round(launcher.x); hook.ended = ended; hook.won = won; hook.paused = paused;
  }
  window.__SI = hook;

  // ---- Input --------------------------------------------------------------
  function firstGesture() { audio.resume(); }
  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { input.left = true; e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { input.right = true; e.preventDefault(); }
    else if (k === ' ' || k === 'arrowup' || k === 'w') { input.fire = true; firstGesture(); e.preventDefault(); }
    else if (k >= '1' && k <= '5') { selectWeapon(parseInt(k, 10) - 1); }
    else if (k === 'q') cycleWeapon(-1);
    else if (k === 'e' || k === 'tab') { cycleWeapon(1); e.preventDefault(); }
    else if (k === 'p') togglePause();
    else if (k === 'm') toggleMute();
  };
  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') input.left = false;
    else if (k === 'arrowright' || k === 'd') input.right = false;
    else if (k === ' ' || k === 'arrowup' || k === 'w') input.fire = false;
  };

  const ptrX = (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return clamp(cx / scale, MARGIN, LW - MARGIN);
  };
  const onPtrDown = (e) => { e.preventDefault(); firstGesture(); ptr.active = true; ptr.x = ptrX(e); };
  const onPtrMove = (e) => { if (ptr.active) { e.preventDefault(); ptr.x = ptrX(e); } };
  const onPtrUp = () => { ptr.active = false; };
  canvas.addEventListener('pointerdown', onPtrDown);
  canvas.addEventListener('pointermove', onPtrMove);
  window.addEventListener('pointerup', onPtrUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  const onResize = () => size();
  window.addEventListener('resize', onResize);

  // mobile buttons (hold to repeat)
  const holdBtn = (node, on, off) => {
    const d = (e) => { e.preventDefault(); firstGesture(); on(); };
    const u = (e) => { if (e) e.preventDefault(); off(); };
    node.addEventListener('pointerdown', d);
    node.addEventListener('pointerup', u);
    node.addEventListener('pointerleave', u);
    node.addEventListener('pointercancel', u);
  };
  holdBtn(btnL, () => { input.btnDir = -1; }, () => { if (input.btnDir < 0) input.btnDir = 0; });
  holdBtn(btnR, () => { input.btnDir = 1; }, () => { if (input.btnDir > 0) input.btnDir = 0; });
  holdBtn(btnFire, () => { input.btnFire = true; }, () => { input.btnFire = false; });
  btnSwap.addEventListener('click', (e) => { e.preventDefault(); cycleWeapon(1); });

  // toolbar
  function togglePause() {
    if (ended) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  }
  function toggleMute() {
    muted = !muted; audio.setMuted(muted);
    muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound';
  }
  restartBtn.onclick = () => start();
  pauseBtn.onclick = togglePause;
  muteBtn.onclick = toggleMute;

  // ---- Boot ---------------------------------------------------------------
  requestAnimationFrame(() => { size(); start(); last = 0; rafId = requestAnimationFrame(step); });

  // ---- Teardown -----------------------------------------------------------
  return () => {
    cancelAnimationFrame(rafId);
    clearTimeout(showFlash._t);
    window.removeEventListener('pointerup', onPtrUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onResize);
    audio.close();
    if (window.__SI === hook) { try { delete window.__SI; } catch (e) { window.__SI = undefined; } }
  };
}

// Tiny WebAudio SFX helper. The context is created lazily on the first user
// gesture so there's no autoplay warning; everything is a short oscillator.
function makeAudio() {
  let ac = null, muted = false;
  const ensure = () => {
    if (ac === null) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = false; }
    }
    return ac || null;
  };
  function blip(freq, dur, type, gain, slideTo) {
    if (muted) return;
    const a = ensure(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  return {
    fire: () => blip(540, 0.08, 'square', 0.035, 900),
    hit: () => blip(300, 0.07, 'triangle', 0.05, 150),
    boom: () => blip(120, 0.32, 'sawtooth', 0.09, 38),
    power: () => blip(680, 0.12, 'sine', 0.06, 1320),
    hurt: () => blip(210, 0.3, 'sawtooth', 0.09, 55),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.06), i * 130)),
    setMuted: (m) => { muted = m; },
    resume: () => { const a = ensure(); if (a && a.state === 'suspended') a.resume(); },
    close: () => { try { if (ac) ac.close(); } catch (e) { /* ignore */ } ac = false; },
  };
}
