// Hot Rope Jump — a flame swings around in a circle. Jump each time it sweeps
// past your feet. It speeds up with every clear — how long can you last?
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor } from './party-core.js';

export const hotRopeJump = {
  id: 'hot-rope-jump',
  name: 'Hot Rope Jump',
  icon: '🔥',
  color: '#f97316',
  blurb: 'Time your jumps over the flame',
  goal: 'Jump over the swinging flame every time it sweeps past your feet.',
  controls: 'Space / Tap',
  howto: [
    'A flame whirls around the ring and sweeps across the ground where you stand.',
    'Press Space or tap just as it reaches your feet to hop over it.',
    'Each successful jump speeds the flame up. Miss once and you’re toast — count your jumps!',
  ],
  run(stage, { practice, mode, ui, onDone }) {
    const reg = teardownRegistry();

    const arena = el('div', { class: 'rope-arena' });
    const ring = el('div', { class: 'rope-ring' });
    const danger = el('div', { class: 'rope-danger' });
    const flame = el('div', { class: 'rope-flame' }, '🔥');
    const hero = el('div', { class: 'rope-hero' }, '🦘');
    const shadow = el('div', { class: 'rope-shadow' });
    const prompt = el('div', { class: 'rope-prompt' }, 'JUMP!');
    const jumpBtn = el('button', { class: 'party-btn primary big rope-jumpbtn' }, '⬆️ JUMP');
    arena.append(ring, danger, shadow, hero, flame, prompt);
    stage.append(arena, jumpBtn);

    const BOTTOM = Math.PI / 2;          // flame is at the feet here
    const DANGER = 0.46;                 // half-width of the "feet" danger arc (rad)
    const AIRTIME = 470;                 // ms aloft per jump
    const MAXH = 78;                     // px jump height

    let angle = -Math.PI / 2;            // start at the top, away from feet
    let vel = practice ? 2.3 : (mode === 'advanced' ? 3.6 : 3.0);   // rad/s
    let grounded = true, jumpStart = 0, jumps = 0;
    let inDanger = false, over = false, last = 0, rafId = null;
    let cx = 160, cy = 150, R = 110;

    if (practice) danger.classList.add('show');

    function layout() {
      const w = arena.clientWidth || 320, h = arena.clientHeight || 300;
      cx = w / 2; cy = h / 2; R = Math.min(w, h) * 0.36;
      ring.style.width = ring.style.height = (R * 2) + 'px';
      ring.style.left = (cx - R) + 'px'; ring.style.top = (cy - R) + 'px';
      // danger zone glow sits on the ground under the hero's feet
      danger.style.left = cx + 'px'; danger.style.top = (cy + R) + 'px';
      danger.style.width = (R * 1.3) + 'px'; danger.style.height = '50px';
      hero.style.left = cx + 'px'; hero.style.top = (cy + R) + 'px';
      shadow.style.left = cx + 'px'; shadow.style.top = (cy + R + 16) + 'px';
      prompt.style.left = cx + 'px'; prompt.style.top = (cy + R - 70) + 'px';
    }

    function jump() {
      if (over || !grounded) return;
      grounded = false; jumpStart = performance.now();
    }

    function angDist(a, b) {
      let d = Math.abs(((a - b + Math.PI) % (2 * Math.PI)) - Math.PI);
      return d;
    }

    function frame(t) {
      if (over) return;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      angle = (angle + vel * dt) % (2 * Math.PI);

      // flame position
      const fx = cx + R * Math.cos(angle), fy = cy + R * Math.sin(angle);
      flame.style.left = fx + 'px'; flame.style.top = fy + 'px';

      // jump arc
      let lift = 0;
      if (!grounded) {
        const p = (t - jumpStart) / AIRTIME;
        if (p >= 1) { grounded = true; }
        else lift = Math.sin(p * Math.PI) * MAXH;
      }
      hero.style.transform = `translate(-50%,-50%) translateY(${-lift}px)`;
      shadow.style.transform = `translate(-50%,-50%) scale(${1 - lift / MAXH * 0.5})`;
      hero.classList.toggle('jumping', !grounded);

      // danger handling
      const d = angDist(angle, BOTTOM);
      const nowDanger = d < DANGER;
      prompt.classList.toggle('show', nowDanger && grounded && !over);
      if (nowDanger && grounded) { return fail(); }
      if (inDanger && !nowDanger) {
        // cleared a pass
        jumps++;
        vel = Math.min(9, vel * 1.055);
        ui.setScore(`Jumps: ${jumps}`);
        flame.classList.remove('cleared'); void flame.offsetWidth; flame.classList.add('cleared');
      }
      inDanger = nowDanger;
      rafId = requestAnimationFrame(frame);
    }

    function fail() {
      if (over) return; over = true;
      cancelAnimationFrame(rafId);
      hero.textContent = '💫'; hero.classList.add('hit');
      flame.classList.add('hit');
      const thr = mode === 'advanced' ? [8, 16, 26] : [7, 14, 22];
      setTimeout(() => onDone({
        score: jumps,
        stars: starsFor(jumps, thr),
        detail: jumps > 0 ? `Cleared ${jumps} jump${jumps === 1 ? '' : 's'} before getting singed!` : 'Caught on the very first sweep — watch the timing!',
      }), 650);
    }

    const onKey = (e) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } };
    const onPoint = (e) => { e.preventDefault(); jump(); };
    window.addEventListener('keydown', onKey);
    arena.addEventListener('pointerdown', onPoint);
    jumpBtn.addEventListener('pointerdown', onPoint);
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    reg.add(() => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    });

    ui.setScore('Jumps: 0');
    ui.setInfo(practice ? 'Warm-up pace' : 'Don’t get burned!');
    // wait one frame so the arena has layout dimensions
    requestAnimationFrame(() => { layout(); last = 0; rafId = requestAnimationFrame(frame); });
    return reg.run;
  },
};
