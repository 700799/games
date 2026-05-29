// Bumper Balls — the classic! Shove the rival balls off the slippery platform
// and be the last one standing. The arena shrinks, so don't get comfortable.
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor, clamp, PLAYER } from './party-core.js';

export const bumperBalls = {
  id: 'bumper-balls',
  name: 'Bumper Balls',
  icon: '🥏',
  color: '#4cc9f0',
  blurb: 'Knock rivals off the ice',
  goal: 'Bump the three rival balls off the icy platform — be the last one on!',
  controls: 'Drag / Arrows',
  howto: [
    'Hold and drag in any direction (or use the arrow / WASD keys) to roll your ball.',
    'The platform is icy — you keep sliding, so plan your bumps!',
    'Knock every rival off the edge. The arena slowly shrinks, so be the last ball standing for 1st place.',
  ],
  run(stage, { rng, practice, mode, rivals, ui, onDone }) {
    const reg = teardownRegistry();
    const wrap = el('div', { class: 'bumper-wrap' });
    const canvas = el('canvas', { class: 'bumper-canvas' });
    wrap.appendChild(canvas);
    stage.appendChild(wrap);
    const ctx = canvas.getContext('2d');

    let CSSW = 360, DPR = 1;
    let cx = 180, cy = 180, R = 165, R0 = 165;
    const ACCEL = mode === 'advanced' ? 760 : 700;
    const AI_ACCEL = (practice ? 360 : (mode === 'advanced' ? 600 : 520));
    const FRICTION = 0.992;
    const MAXV = 520;

    function size() {
      const w = Math.min(wrap.clientWidth || 360, 520);
      CSSW = w; DPR = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = w + 'px'; canvas.style.height = w + 'px';
      canvas.width = Math.round(w * DPR); canvas.height = Math.round(w * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = w / 2; cy = w / 2; R0 = w * 0.46; R = R0;
    }

    const COLORS = ['#ef476f', '#06d6a0', '#ffd166', '#c77dff'];
    const balls = [];
    function makeBalls() {
      balls.length = 0;
      const roster = [{ ...PLAYER, isYou: true }, ...rivals.slice(0, 3)];
      const rad = CSSW * 0.075;
      roster.forEach((p, i) => {
        const a = (i / roster.length) * Math.PI * 2 + Math.PI / 4;
        balls.push({
          isYou: i === 0, name: p.name, emoji: p.emoji, color: COLORS[i % COLORS.length],
          x: cx + Math.cos(a) * R * 0.5, y: cy + Math.sin(a) * R * 0.5,
          vx: 0, vy: 0, r: rad, alive: true, fall: 0, place: null,
        });
      });
    }

    let aliveCount = 4, over = false, start = performance.now(), last = 0, rafId = null;
    const me = () => balls[0];
    const press = { on: false, x: 0, y: 0 };
    const keys = { up: false, down: false, left: false, right: false };

    function eliminate(b) {
      b.alive = false;
      aliveCount--;
      b.place = aliveCount + 1;
      if (b.isYou) return finish();
      if (aliveCount <= 1) {
        const survivor = balls.find((x) => x.alive);
        if (survivor) survivor.place = 1;
        if (survivor && survivor.isYou) return finish();
        return finish();
      }
    }

    function step(t) {
      if (over) return;
      if (!last) last = t;
      const dt = Math.min(0.04, (t - last) / 1000); last = t;
      const elapsed = (t - start) / 1000;

      // shrink the arena over time (challenge only), after a short grace period
      if (!practice && elapsed > 4) R = Math.max(R0 * 0.42, R - R0 * 0.02 * dt);

      // player input → acceleration
      const p = me();
      if (p.alive) {
        let ax = 0, ay = 0;
        if (keys.left) ax -= 1; if (keys.right) ax += 1;
        if (keys.up) ay -= 1; if (keys.down) ay += 1;
        if (press.on) { ax += (press.x - p.x); ay += (press.y - p.y); }
        const mag = Math.hypot(ax, ay);
        if (mag > 0.001) { p.vx += (ax / mag) * ACCEL * dt; p.vy += (ay / mag) * ACCEL * dt; }
      }

      // AI steering
      for (const b of balls) {
        if (!b.alive || b.isYou) continue;
        let tx = null, ty = null, best = Infinity;
        for (const o of balls) {
          if (!o.alive || o === b) continue;
          const d = Math.hypot(o.x - b.x, o.y - b.y);
          if (d < best) { best = d; tx = o.x; ty = o.y; }
        }
        let ax = 0, ay = 0;
        if (tx != null) { ax = tx - b.x; ay = ty - b.y; const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m; }
        // self-preservation: steer toward centre when near the edge
        const dc = Math.hypot(b.x - cx, b.y - cy);
        const edge = clamp((dc - R * 0.55) / (R * 0.45), 0, 1);
        if (edge > 0) { const toCx = (cx - b.x), toCy = (cy - b.y); const m = Math.hypot(toCx, toCy) || 1; ax = ax * (1 - edge) + (toCx / m) * edge * 1.6; ay = ay * (1 - edge) + (toCy / m) * edge * 1.6; }
        ax += (rng() - 0.5) * 0.4; ay += (rng() - 0.5) * 0.4;
        const m = Math.hypot(ax, ay) || 1;
        b.vx += (ax / m) * AI_ACCEL * dt; b.vy += (ay / m) * AI_ACCEL * dt;
      }

      // integrate + friction + speed clamp
      for (const b of balls) {
        if (!b.alive) { b.fall += dt; continue; }
        b.vx *= FRICTION; b.vy *= FRICTION;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt;
      }

      // ball-ball collisions (equal mass, bouncy bumpers)
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], c = balls[j];
          if (!a.alive || !c.alive) continue;
          const dx = c.x - a.x, dy = c.y - a.y; const dist = Math.hypot(dx, dy) || 0.001;
          const min = a.r + c.r;
          if (dist < min) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = (min - dist) / 2;
            a.x -= nx * overlap; a.y -= ny * overlap; c.x += nx * overlap; c.y += ny * overlap;
            const rvx = c.vx - a.vx, rvy = c.vy - a.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              const imp = -vn * 1.08;        // >1 = extra-springy bumpers
              a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny;
            }
          }
        }
      }

      // fall off the edge
      for (const b of balls) {
        if (!b.alive) continue;
        if (Math.hypot(b.x - cx, b.y - cy) > R - b.r * 0.35) eliminate(b);
      }

      draw(elapsed);
      if (!over) rafId = requestAnimationFrame(step);
    }

    function draw(elapsed) {
      ctx.clearRect(0, 0, CSSW, CSSW);
      // platform (icy disc)
      const g = ctx.createRadialGradient(cx, cy * 0.8, R * 0.2, cx, cy, R);
      g.addColorStop(0, '#dff3ff'); g.addColorStop(1, '#9ec9e8');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#6aa6cf'; ctx.stroke();
      // sheen
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.96, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.stroke();

      for (const b of balls) {
        if (!b.alive && b.fall > 0.9) continue;
        const scale = b.alive ? 1 : Math.max(0, 1 - b.fall);
        const r = b.r * scale;
        ctx.save();
        ctx.globalAlpha = b.alive ? 1 : Math.max(0, 1 - b.fall);
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fillStyle = b.color; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = b.isYou ? '#fff' : 'rgba(0,0,0,.25)'; ctx.stroke();
        ctx.font = `${r * 1.1}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.emoji, b.x, b.y + 1);
        ctx.restore();
      }
      ui.setInfo(practice ? 'Warm-up — no shrink' : `On the ice: ${aliveCount}`);
    }

    function finish() {
      if (over) return; over = true;
      cancelAnimationFrame(rafId);
      const place = me().place || 1;
      const survSec = (performance.now() - start) / 1000;
      const score = (balls.length - place) * 100 + Math.round(survSec * 5);
      const placeText = ['🥇 1st — last ball standing!', '🥈 2nd place', '🥉 3rd place', '4th place'][place - 1];
      setTimeout(() => onDone({
        score,
        stars: [3, 2, 1, 0][place - 1],
        win: place === 1,
        place,
        detail: `${placeText} · survived ${survSec.toFixed(1)}s`,
      }), 500);
    }

    // input
    const pt = (e) => { const r = canvas.getBoundingClientRect(); const X = e.touches ? e.touches[0].clientX : e.clientX; const Y = e.touches ? e.touches[0].clientY : e.clientY; press.x = X - r.left; press.y = Y - r.top; };
    const down = (e) => { e.preventDefault(); press.on = true; pt(e); };
    const move = (e) => { if (press.on) { e.preventDefault(); pt(e); } };
    const up = () => { press.on = false; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    const kd = (e) => { const k = e.key.toLowerCase(); if (k === 'arrowup' || k === 'w') keys.up = true; if (k === 'arrowdown' || k === 's') keys.down = true; if (k === 'arrowleft' || k === 'a') keys.left = true; if (k === 'arrowright' || k === 'd') keys.right = true; if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault(); };
    const ku = (e) => { const k = e.key.toLowerCase(); if (k === 'arrowup' || k === 'w') keys.up = false; if (k === 'arrowdown' || k === 's') keys.down = false; if (k === 'arrowleft' || k === 'a') keys.left = false; if (k === 'arrowright' || k === 'd') keys.right = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const onResize = () => { size(); };
    window.addEventListener('resize', onResize);
    reg.add(() => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('resize', onResize);
    });

    ui.setScore('🥏 Bump them off!');
    requestAnimationFrame(() => { size(); makeBalls(); last = 0; start = performance.now(); rafId = requestAnimationFrame(step); });
    return reg.run;
  },
};
