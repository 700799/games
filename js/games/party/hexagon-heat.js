// Hexagon Heat — a colour is called, then every tile of the wrong colour drops
// away. Hop onto a safe-colour tile before the buzzer. Survive round after round!
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor } from './party-core.js';

const PALETTE = [
  { name: 'Red',    css: '#ef476f' },
  { name: 'Gold',   css: '#ffd166' },
  { name: 'Green',  css: '#06d6a0' },
  { name: 'Blue',   css: '#4cc9f0' },
];

export const hexagonHeat = {
  id: 'hexagon-heat',
  name: 'Hexagon Heat',
  icon: '🟦',
  color: '#ffd166',
  blurb: 'Stand on the safe colour',
  goal: 'Hop onto a tile of the called colour before the floor drops!',
  controls: 'Tap a tile',
  howto: [
    'A colour is announced and the timer bar starts draining.',
    'Tap any tile to hop your token onto it — land on the called colour!',
    'When the buzzer sounds, every other-coloured tile falls away. Survive as long as you can; it gets faster each round.',
  ],
  run(stage, { rng, practice, mode, ui, onDone }) {
    const reg = teardownRegistry();
    const timeouts = [];
    const after = (fn, ms) => { const t = setTimeout(fn, ms); timeouts.push(t); return t; };

    const SIZE = mode === 'advanced' ? 5 : 4;
    const nColors = mode === 'advanced' ? 4 : 3;
    const colors = PALETTE.slice(0, nColors);

    let round = 0, survived = 0, done = false, phase = 'idle';
    let player = Math.floor((SIZE * SIZE) / 2); // tile index
    let target = null;
    let rafId = null, deadline = 0, roundMs = 0;

    const banner = el('div', { class: 'hex-banner' }, 'Get ready…');
    const barFill = el('div', { class: 'hex-bar-fill' });
    const bar = el('div', { class: 'hex-bar' }, [barFill]);
    const grid = el('div', { class: 'hex-grid', style: { gridTemplateColumns: `repeat(${SIZE}, 1fr)` } });
    stage.append(banner, bar, grid);

    let tiles = []; // {color, node, idx, alive}
    function build() {
      grid.innerHTML = '';
      tiles = [];
      // assign colours, guaranteeing the target colour appears enough times
      for (let i = 0; i < SIZE * SIZE; i++) {
        const c = colors[Math.floor(rng() * colors.length)];
        const node = el('button', { class: 'hex-tile', style: { background: c.css } });
        node.onclick = () => hop(i);
        const t = { color: c, node, idx: i, alive: true };
        node.addEventListener('animationend', () => {});
        grid.appendChild(node);
        tiles.push(t);
      }
      drawPlayer();
    }

    function drawPlayer() {
      tiles.forEach((t, i) => {
        t.node.innerHTML = '';
        if (i === player) t.node.appendChild(el('span', { class: 'hex-token' }, '😎'));
      });
    }

    function hop(i) {
      if (phase !== 'run' || done || !tiles[i].alive) return;
      player = i;
      drawPlayer();
    }

    function newRound() {
      if (done) return;
      round++;
      phase = 'show';
      build();
      // ensure target colour exists on at least 2 tiles (so it's reachable & fair)
      target = colors[Math.floor(rng() * colors.length)];
      let count = tiles.filter((t) => t.color === target).length;
      let guard = 0;
      while (count < 2 && guard++ < 50) {
        const j = Math.floor(rng() * tiles.length);
        if (j === player) continue;
        tiles[j].color = target; tiles[j].node.style.background = target.css;
        count = tiles.filter((t) => t.color === target).length;
      }
      banner.innerHTML = `Stand on <b style="color:${target.css}">${target.name}</b>!`;
      ui.setScore(`Round ${round}`);
      ui.setInfo(`Survived: ${survived}`);
      roundMs = practice ? 4200 : Math.max(mode === 'advanced' ? 1000 : 1200, (mode === 'advanced' ? 2800 : 3200) - round * 200);
      after(() => startTimer(), 650);
    }

    function startTimer() {
      if (done) return;
      phase = 'run';
      deadline = performance.now() + roundMs;
      const loop = () => {
        if (done || phase !== 'run') return;
        const left = deadline - performance.now();
        const frac = Math.max(0, left / roundMs);
        barFill.style.width = (frac * 100) + '%';
        barFill.style.background = frac < 0.3 ? 'var(--bad)' : frac < 0.6 ? 'var(--accent)' : 'var(--accent-3)';
        bar.classList.toggle('low', frac < 0.3);
        if (left <= 0) { resolve(); return; }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    function resolve() {
      phase = 'resolve';
      cancelAnimationFrame(rafId);
      // drop every tile not matching the target colour
      tiles.forEach((t) => {
        if (t.color !== target) { t.alive = false; t.node.classList.add('falling'); }
        else t.node.classList.add('safe');
      });
      const safe = tiles[player].color === target;
      if (safe) {
        survived++;
        ui.setInfo(`Survived: ${survived}`);
        banner.innerHTML = '✅ Safe! Next round…';
        after(() => { tiles.forEach((t) => t.node.classList.remove('safe', 'falling')); newRound(); }, 900);
      } else {
        banner.innerHTML = '💥 The floor gave way!';
        tiles[player].node.classList.add('falling');
        after(finish, 1100);
      }
    }

    function finish() {
      if (done) return; done = true;
      cancelAnimationFrame(rafId);
      const thr = mode === 'advanced' ? [3, 6, 10] : [3, 5, 8];
      onDone({
        score: survived,
        stars: starsFor(survived, thr),
        detail: survived > 0
          ? `Stayed cool for ${survived} round${survived === 1 ? '' : 's'}!`
          : 'Fell on the first buzzer — watch the colour!',
      });
    }

    reg.add(() => { cancelAnimationFrame(rafId); timeouts.forEach(clearTimeout); });

    after(newRound, 200);
    return reg.run;
  },
};
