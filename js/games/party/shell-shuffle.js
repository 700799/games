// Shell Shuffle — keep your eye on the cup hiding the star while they shuffle.
// Each correct guess speeds up the next round; one miss ends the run.
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor } from './party-core.js';

export const shellShuffle = {
  id: 'shell-shuffle',
  name: 'Shell Shuffle',
  icon: '🐚',
  color: '#118ab2',
  blurb: 'Track the hidden star',
  goal: 'Keep your eye on the cup hiding the ⭐ as they shuffle, then tap it.',
  controls: 'Tap / Click',
  howto: [
    'Watch which cup the star slips under.',
    'The three cups shuffle — follow the right one!',
    'Tap the cup you think hides the star. Each correct guess shuffles faster; a miss ends your run.',
  ],
  run(stage, { rng, practice, mode, ui, onDone }) {
    const reg = teardownRegistry();
    const timeouts = [];
    const after = (fn, ms) => { const t = setTimeout(fn, ms); timeouts.push(t); return t; };
    reg.add(() => timeouts.forEach(clearTimeout));

    const SLOTS = [18, 50, 82];           // x position of each slot (% of width)
    let round = 0, correctRounds = 0, done = false;
    let swaps = practice ? 2 : (mode === 'advanced' ? 4 : 3);
    let pace = practice ? 760 : (mode === 'advanced' ? 460 : 560);

    const arena = el('div', { class: 'shell-arena' });
    const msg = el('div', { class: 'shell-msg' }, 'Watch the star…');
    stage.append(msg, arena);

    // cups[i] = { slot, hasStar, node, starNode }
    const cups = [0, 1, 2].map((i) => {
      const starNode = el('div', { class: 'shell-star' }, '⭐');
      const node = el('button', { class: 'shell-cup' }, [el('span', { class: 'shell-cup-body' }, '🥤')]);
      arena.append(starNode, node);
      node.onclick = () => guess(i);
      return { slot: i, hasStar: false, node, starNode };
    });

    function place() {
      cups.forEach((c) => {
        c.node.style.left = SLOTS[c.slot] + '%';
        c.starNode.style.left = SLOTS[c.slot] + '%';
      });
    }

    function setLifted(lifted) {
      cups.forEach((c) => {
        c.node.classList.toggle('lifted', lifted && c.hasStar);
        c.starNode.classList.toggle('show', lifted && c.hasStar);
      });
    }

    function newRound() {
      round++;
      cups.forEach((c) => { c.hasStar = false; c.node.classList.remove('lifted', 'pickable', 'reveal-bad', 'reveal-good'); });
      const starCup = Math.floor(rng() * 3);
      cups[starCup].hasStar = true;
      place();
      ui.setScore(`Round ${round}`);
      ui.setInfo(`Streak: ${correctRounds}`);
      msg.textContent = 'The star goes under a cup…';
      setLifted(true);
      after(() => { setLifted(false); msg.textContent = 'Shuffling!'; doShuffles(); }, practice ? 1100 : 850);
    }

    function doShuffles() {
      let i = 0;
      const nSwaps = swaps + Math.floor(round / 2);
      const stepSwap = () => {
        if (done) return;
        if (i >= nSwaps) { enablePick(); return; }
        // swap two distinct cups' slots
        const a = Math.floor(rng() * 3);
        let b = Math.floor(rng() * 3);
        if (b === a) b = (b + 1) % 3;
        const t = cups[a].slot; cups[a].slot = cups[b].slot; cups[b].slot = t;
        place();
        i++;
        after(stepSwap, pace);
      };
      after(stepSwap, pace);
    }

    function enablePick() {
      if (done) return;
      msg.textContent = '👉 Which cup has the star?';
      cups.forEach((c) => c.node.classList.add('pickable'));
    }

    function guess(i) {
      if (done || !cups[i].node.classList.contains('pickable')) return;
      cups.forEach((c) => c.node.classList.remove('pickable'));
      setLifted(true);
      cups[i].node.classList.add(cups[i].hasStar ? 'reveal-good' : 'reveal-bad');
      if (cups[i].hasStar) {
        correctRounds++;
        msg.textContent = '✅ Correct! Faster now…';
        ui.setInfo(`Streak: ${correctRounds}`);
        // speed up
        pace = Math.max(practice ? 380 : 230, pace * 0.9);
        if (round % 2 === 0) swaps++;
        if (practice && correctRounds >= 5) return after(finish, 900);
        after(newRound, 950);
      } else {
        msg.textContent = '❌ That was empty! The star was elsewhere.';
        setLifted(true);
        after(finish, 1100);
      }
    }

    function finish() {
      if (done) return; done = true;
      const score = correctRounds;
      const thr = mode === 'advanced' ? [3, 6, 9] : [3, 5, 8];
      onDone({
        score,
        stars: starsFor(score, thr),
        detail: correctRounds > 0
          ? `Followed the star through ${correctRounds} round${correctRounds === 1 ? '' : 's'}!`
          : 'The star slipped away — try again!',
      });
    }

    place();
    after(newRound, 250);
    return reg.run;
  },
};
