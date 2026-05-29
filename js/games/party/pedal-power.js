// Pedal Power — a frantic button-masher race. Hammer the pedal to out-sprint
// three CPU rivals to the finish line. Mash, mash, mash!
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor, PLAYER } from './party-core.js';

export const pedalPower = {
  id: 'pedal-power',
  name: 'Pedal Power',
  icon: '🚲',
  color: '#7c3aed',
  blurb: 'Mash to win the race',
  goal: 'Mash the pedal faster than the rivals to win the race!',
  controls: 'Space / Tap',
  howto: [
    'Tap the big PEDAL button (or hammer the Space bar) as fast as you can.',
    'Every press pushes your racer toward the finish line on the right.',
    'Beat all three rivals to take 1st place and 3 ⭐. Finishing order sets your score!',
  ],
  run(stage, { rng, practice, mode, rivals, ui, onDone }) {
    const reg = teardownRegistry();
    const STEP = mode === 'advanced' ? 1.9 : 2.3;     // % progress per tap
    const TIME = practice ? 9 : (mode === 'advanced' ? 16 : 14);
    const solo = practice;

    // racers: player + (unless practice) three rivals
    const racers = [{ ...PLAYER, isYou: true, dist: 0, rate: 0, fin: null }];
    if (!solo) {
      rivals.forEach((r) => {
        const lo = mode === 'advanced' ? 13 : 11, hi = mode === 'advanced' ? 18 : 16;
        racers.push({ ...r, isYou: false, dist: 0, rate: lo + rng() * (hi - lo), fin: null });
      });
    }

    const track = el('div', { class: 'pedal-track' });
    racers.forEach((r) => {
      r.lane = el('div', { class: 'pedal-lane' });
      r.racerEl = el('div', { class: 'pedal-racer' + (r.isYou ? ' you' : '') }, r.emoji);
      r.lane.append(
        el('div', { class: 'pedal-name' }, r.isYou ? 'YOU' : r.name),
        el('div', { class: 'pedal-rail' }, [r.racerEl, el('div', { class: 'pedal-flag' }, '🏁')]),
      );
      track.appendChild(r.lane);
    });
    const pedalBtn = el('button', { class: 'pedal-btn' }, ['🚲', el('span', {}, 'PEDAL!')]);
    const meter = el('div', { class: 'pedal-meter' }, [el('div', { class: 'pedal-meter-fill' })]);
    stage.append(track, meter, pedalBtn);

    const me = racers[0];
    let over = false, start = performance.now(), last = start, rafId = null;
    let taps = 0, tapWindow = [];

    function tap() {
      if (over) return;
      me.dist = Math.min(100, me.dist + STEP);
      taps++;
      tapWindow.push(performance.now());
      pedalBtn.classList.remove('mash'); void pedalBtn.offsetWidth; pedalBtn.classList.add('mash');
      if (me.dist >= 100 && me.fin == null) me.fin = performance.now();
      paint();
    }

    function paint() {
      racers.forEach((r) => { r.racerEl.style.left = `calc(${r.dist}% - 14px)`; });
      // speedometer = recent taps/sec
      const now = performance.now();
      tapWindow = tapWindow.filter((t) => now - t < 1000);
      meter.querySelector('.pedal-meter-fill').style.width = Math.min(100, tapWindow.length * 11) + '%';
      ui.setScore(`You: ${Math.round(me.dist)}%`);
    }

    function frame(t) {
      if (over) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const elapsed = (t - start) / 1000;
      for (const r of racers) {
        if (r.isYou) continue;
        const jitter = 0.85 + rng() * 0.3;
        r.dist = Math.min(100, r.dist + r.rate * jitter * dt);
        if (r.dist >= 100 && r.fin == null) r.fin = t;
      }
      paint();
      ui.setInfo(`⏱ ${Math.max(0, Math.ceil(TIME - elapsed))}s`);
      const everyoneDone = racers.every((r) => r.fin != null);
      if (me.fin != null || everyoneDone || elapsed >= TIME) return finish();
      rafId = requestAnimationFrame(frame);
    }

    function finish() {
      if (over) return; over = true;
      cancelAnimationFrame(rafId);
      // rank: finishers first (by finish time), then by distance
      const order = racers.slice().sort((a, b) => {
        if (a.fin != null && b.fin != null) return a.fin - b.fin;
        if (a.fin != null) return -1;
        if (b.fin != null) return 1;
        return b.dist - a.dist;
      });
      const place = order.indexOf(me) + 1;
      racers.forEach((r) => r.racerEl.classList.toggle('winner', order[0] === r));

      if (solo) {
        const score = Math.round(me.dist) + taps;
        onDone({ score, stars: starsFor(taps, [40, 70, 100]), detail: `${taps} pedals — ${Math.round(me.dist)}% of the track in practice.` });
        return;
      }
      const placeText = ['🥇 1st place!', '🥈 2nd place', '🥉 3rd place', '4th place'][place - 1];
      const score = (racers.length - place) * 100 + Math.round(me.dist);
      onDone({
        score,
        stars: [3, 2, 1, 0][place - 1],
        win: place === 1,
        place,
        detail: `${placeText} — ${taps} pedals, ${Math.round(me.dist)}% covered.`,
      });
    }

    const onKey = (e) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', onKey);
    pedalBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    reg.add(() => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); });

    ui.setScore('You: 0%');
    ui.setInfo(`⏱ ${TIME}s`);
    paint();
    rafId = requestAnimationFrame(frame);
    return reg.run;
  },
};
