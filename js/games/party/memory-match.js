// Memory Match — flip cards two at a time to find every matching pair.
// Faster + fewer wasted flips = more points. (Solo concentration game.)
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor } from './party-core.js';

const FACES = ['🍄', '⭐', '🌸', '🍌', '🐢', '👻', '🔔', '💎', '🎁', '🍒', '🦋', '🍀', '🎈', '🐞', '🍩', '🪙'];

export const memoryMatch = {
  id: 'memory-match',
  name: 'Memory Match',
  icon: '🃏',
  color: '#ef476f',
  blurb: 'Flip cards & find the pairs',
  goal: 'Find every matching pair as fast as you can.',
  controls: 'Tap / Click',
  howto: [
    'Tap a card to flip it face-up, then tap a second card.',
    'If the two faces match, they stay up. If not, they flip back.',
    'Clear the whole board — fewer flips and a faster time score more ⭐.',
  ],
  run(stage, { practice, mode, ui, onDone }) {
    const reg = teardownRegistry();
    const pairs = practice ? 4 : (mode === 'advanced' ? 8 : 6);
    const cols = pairs <= 4 ? 4 : pairs <= 6 ? 4 : 4;
    const faces = FACES.slice(0, pairs);
    const deck = [...faces, ...faces]
      .map((f) => ({ f, k: Math.random() }))
      .sort((a, b) => a.k - b.k);

    let flips = 0, matched = 0, busy = false, first = null, startT = performance.now();

    stage.appendChild(el('div', { class: 'mm2-info' }, 'Find all the pairs!'));
    const grid = el('div', { class: 'mm2-grid', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
    stage.appendChild(grid);

    const cards = deck.map((d) => {
      const card = el('button', { class: 'mm2-card' }, [
        el('span', { class: 'mm2-face' }, d.f),
      ]);
      card.onclick = () => flip(card, d);
      grid.appendChild(card);
      return card;
    });

    function flip(card, d) {
      if (busy || card.classList.contains('up') || card.classList.contains('done')) return;
      card.classList.add('up');
      if (!first) { first = { card, d }; return; }
      flips++;
      const a = first; first = null;
      if (a.d.f === d.f) {
        busy = true;
        const t = setTimeout(() => {
          a.card.classList.add('done'); card.classList.add('done');
          matched++; busy = false;
          if (matched === pairs) finish();
        }, 260);
        reg.add(() => clearTimeout(t));
      } else {
        busy = true;
        const t = setTimeout(() => {
          a.card.classList.remove('up'); card.classList.remove('up');
          busy = false;
        }, 720);
        reg.add(() => clearTimeout(t));
      }
    }

    function finish() {
      const sec = Math.max(1, Math.round((performance.now() - startT) / 1000));
      const minFlips = pairs;            // best possible matching attempts
      const extra = Math.max(0, flips - minFlips);
      const base = pairs * 150 + 400;
      const score = Math.max(0, Math.round(base - sec * 7 - extra * 14));
      const thr = [Math.round(base * 0.42), Math.round(base * 0.66), Math.round(base * 0.86)];
      onDone({
        score,
        stars: starsFor(score, thr),
        detail: `Cleared ${pairs} pairs in ${sec}s · ${flips} tries`,
      });
    }

    const tick = setInterval(() => {
      const sec = Math.round((performance.now() - startT) / 1000);
      ui.setScore(`Pairs ${matched}/${pairs}`);
      ui.setInfo(`⏱ ${sec}s · ${flips} tries`);
    }, 200);
    reg.add(() => clearInterval(tick));

    return reg.run;
  },
};
