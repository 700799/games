// Whack-a-Plant — bop the friendly sprouts for points, but never the Bob-ombs!
// A frantic timed round; golden stars are worth big bonus points.
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor } from './party-core.js';

const GOOD = ['🌱', '🌼', '🌻', '🍀'];

export const whackPlant = {
  id: 'whack-a-plant',
  name: 'Whack-a-Plant',
  icon: '🌱',
  color: '#06d6a0',
  blurb: 'Bop sprouts, dodge bombs',
  goal: 'Whack the sprouts for points — but never the Bob-ombs!',
  controls: 'Tap / Click',
  howto: [
    'Sprouts 🌱 pop out of the holes — tap them fast for +10.',
    'Golden stars ⭐ are worth a juicy +25 bonus.',
    'Tap a Bob-omb 💣 and you lose 15 points. Score the most before time runs out!',
  ],
  run(stage, { practice, mode, ui, onDone }) {
    const reg = teardownRegistry();
    const HOLES = mode === 'advanced' ? 12 : 9;
    const cols = mode === 'advanced' ? 4 : 3;
    const DURATION = practice ? 18 : (mode === 'advanced' ? 35 : 25);

    let score = 0, timeLeft = DURATION, over = false;
    const holeTimers = new Array(HOLES).fill(null);

    const board = el('div', { class: 'whack-board', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
    const holes = [];
    for (let i = 0; i < HOLES; i++) {
      const critter = el('button', { class: 'whack-critter' }, '');
      const hole = el('div', { class: 'whack-hole' }, [el('div', { class: 'whack-dirt' }), critter]);
      critter.onclick = () => whack(i);
      board.appendChild(hole);
      holes.push({ hole, critter, kind: null, up: false });
    }
    stage.appendChild(board);

    function popUp() {
      if (over) return;
      const free = holes.map((h, i) => i).filter((i) => !holes[i].up);
      if (!free.length) return;
      const idx = free[Math.floor(Math.random() * free.length)];
      const h = holes[idx];
      const roll = Math.random();
      let kind, glyph;
      if (!practice && roll < 0.26) { kind = 'bomb'; glyph = '💣'; }
      else if (roll < 0.34) { kind = 'star'; glyph = '⭐'; }
      else { kind = 'good'; glyph = GOOD[Math.floor(Math.random() * GOOD.length)]; }
      h.kind = kind; h.up = true;
      h.critter.textContent = glyph;
      h.critter.className = 'whack-critter up ' + kind;
      // progressively shorter visible time as the round heats up
      const heat = 1 - (timeLeft / DURATION) * 0.45;
      const life = (kind === 'bomb' ? 1100 : 950) * (practice ? 1.3 : heat <= 0 ? 1 : 1 - heat * 0.4);
      holeTimers[idx] = setTimeout(() => hide(idx), Math.max(550, life));
    }

    function hide(idx) {
      const h = holes[idx];
      if (holeTimers[idx]) { clearTimeout(holeTimers[idx]); holeTimers[idx] = null; }
      h.up = false; h.kind = null;
      h.critter.className = 'whack-critter';
      h.critter.textContent = '';
    }

    function whack(idx) {
      const h = holes[idx];
      if (over || !h.up) return;
      if (h.kind === 'bomb') {
        score -= 15;
        h.critter.textContent = '💥';
        flash('bad');
      } else {
        score += h.kind === 'star' ? 25 : 10;
        flash('good');
        h.critter.classList.add('bopped');
      }
      const bonus = h.kind === 'star' ? '+25' : h.kind === 'bomb' ? '−15' : '+10';
      popText(h.hole, bonus, h.kind === 'bomb' ? 'bad' : 'good');
      ui.setScore(`Score: ${Math.max(0, score)}`);
      setTimeout(() => hide(idx), 150);
    }

    function flash(kind) {
      board.classList.remove('flash-good', 'flash-bad');
      void board.offsetWidth;
      board.classList.add(kind === 'bad' ? 'flash-bad' : 'flash-good');
    }
    function popText(parent, text, kind) {
      const p = el('div', { class: 'whack-pop ' + kind }, text);
      parent.appendChild(p);
      setTimeout(() => p.remove(), 650);
    }

    function finish() {
      if (over) return; over = true;
      holeTimers.forEach((t) => t && clearTimeout(t));
      const final = Math.max(0, score);
      const thr = mode === 'advanced' ? [120, 240, 380] : [90, 180, 280];
      onDone({
        score: final,
        stars: starsFor(final, thr),
        detail: `Bopped your way to ${final} points in ${DURATION}s!`,
      });
    }

    // spawn loop — speeds up as the clock ticks down
    let spawn = null;
    function scheduleSpawn() {
      if (over) return;
      const heat = 1 - (timeLeft / DURATION);
      const gap = (practice ? 720 : 560) * (1 - heat * 0.45);
      popUp();
      if (Math.random() < 0.35 + heat * 0.3) popUp(); // occasional double pop
      spawn = setTimeout(scheduleSpawn, Math.max(300, gap));
    }
    const clock = setInterval(() => {
      timeLeft--;
      ui.setInfo(`⏱ ${timeLeft}s`);
      if (timeLeft <= 0) finish();
    }, 1000);

    reg.add(() => { clearInterval(clock); if (spawn) clearTimeout(spawn); holeTimers.forEach((t) => t && clearTimeout(t)); });

    ui.setScore('Score: 0');
    ui.setInfo(`⏱ ${timeLeft}s`);
    scheduleSpawn();
    return reg.run;
  },
};
