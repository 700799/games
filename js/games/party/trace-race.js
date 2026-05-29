// Trace Race — a shape flashes up; trace its outline as accurately and quickly
// as you can. Precision and speed both score. (Inspired by "Crazy Cutters".)
import { el, teardownRegistry } from '../../helpers.js';
import { starsFor, clamp, localPoint } from './party-core.js';

const SHAPES = ['star', 'heart', 'circle', 'triangle', 'square'];

// Sample a closed outline in unit space [0,1]² as N points.
function samplePath(shape, N) {
  const pts = [];
  const push = (x, y) => pts.push({ x, y });
  if (shape === 'circle') {
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; push(0.5 + 0.42 * Math.cos(a), 0.5 + 0.42 * Math.sin(a)); }
  } else if (shape === 'heart') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      push(0.5 + x / 38, 0.46 - y / 38);
    }
  } else {
    // polygon-based shapes: build vertices, then interpolate evenly
    let verts;
    if (shape === 'triangle') verts = [[0.5, 0.08], [0.92, 0.86], [0.08, 0.86]];
    else if (shape === 'square') verts = [[0.12, 0.12], [0.88, 0.12], [0.88, 0.88], [0.12, 0.88]];
    else { // star
      verts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 === 0 ? 0.46 : 0.20; verts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]); }
    }
    const perEdge = Math.ceil(N / verts.length);
    for (let v = 0; v < verts.length; v++) {
      const a = verts[v], b = verts[(v + 1) % verts.length];
      for (let k = 0; k < perEdge; k++) { const f = k / perEdge; push(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); }
    }
  }
  return pts;
}

export const traceRace = {
  id: 'trace-race',
  name: 'Trace Race',
  icon: '✏️',
  color: '#06d6a0',
  blurb: 'Trace the shape fast',
  goal: 'Trace the outlined shape as accurately and quickly as you can.',
  controls: 'Draw with finger / mouse',
  howto: [
    'A shape appears with a faint outline and a green start dot.',
    'Press and drag to trace right along the outline — lift and continue as needed.',
    'Hit ✓ Done when finished. More outline covered, less wobble, and a faster time all earn ⭐.',
  ],
  run(stage, { rng, practice, mode, ui, onDone }) {
    const reg = teardownRegistry();
    const shape = SHAPES[Math.floor(rng() * (mode === 'advanced' ? SHAPES.length : 4))];
    const N = 140;

    const wrap = el('div', { class: 'trace-wrap' });
    const canvas = el('canvas', { class: 'trace-canvas' });
    wrap.appendChild(canvas);
    const doneBtn = el('button', { class: 'party-btn success big' }, '✓ Done');
    const clearBtn = el('button', { class: 'party-btn ghost big' }, '↺ Clear');
    const tools = el('div', { class: 'trace-tools' }, [clearBtn, doneBtn]);
    stage.append(wrap, tools);
    const ctx = canvas.getContext('2d');

    let S = 360, DPR = 1, target = [], drawn = [], drawing = false, startT = 0, finished = false;

    function size() {
      S = Math.min(wrap.clientWidth || 360, 460);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = S + 'px'; canvas.style.height = S + 'px';
      canvas.width = Math.round(S * DPR); canvas.height = Math.round(S * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const pad = S * 0.12, span = S - pad * 2;
      target = samplePath(shape, N).map((p) => ({ x: pad + p.x * span, y: pad + p.y * span }));
      redraw();
    }

    function redraw() {
      ctx.clearRect(0, 0, S, S);
      // target outline
      ctx.beginPath();
      target.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.lineWidth = Math.max(10, S * 0.05); ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke(); ctx.setLineDash([]);
      // practice guide dots
      if (practice) { for (let i = 0; i < target.length; i += 7) { ctx.beginPath(); ctx.arc(target[i].x, target[i].y, 2.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,209,102,.8)'; ctx.fill(); } }
      // start dot
      ctx.beginPath(); ctx.arc(target[0].x, target[0].y, 8, 0, Math.PI * 2); ctx.fillStyle = '#06d6a0'; ctx.fill();
      ctx.fillStyle = '#06382b'; ctx.font = `bold ${S * 0.04}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▶', target[0].x, target[0].y + 1);
      // drawn path
      if (drawn.length > 1) {
        ctx.beginPath();
        drawn.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.lineWidth = Math.max(4, S * 0.018); ctx.strokeStyle = '#ffd166'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      }
    }

    function add(e) {
      const p = localPoint(canvas, e);
      const last = drawn[drawn.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 3) { drawn.push({ x: p.x, y: p.y }); redraw(); }
    }
    function down(e) { if (finished) return; e.preventDefault(); drawing = true; if (!startT) startT = performance.now(); add(e); }
    function move(e) { if (drawing) { e.preventDefault(); add(e); } }
    function up() { drawing = false; }

    function minDist(p, arr) { let m = Infinity; for (const q of arr) { const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2; if (d < m) m = d; } return Math.sqrt(m); }

    function finish() {
      if (finished) return;
      if (drawn.length < 16) { ui.setInfo('✏️ Keep tracing the outline…'); return; }
      finished = true;
      const tol = S * 0.075;
      let covered = 0;
      for (const tp of target) if (minDist(tp, drawn) < tol) covered++;
      const coverage = covered / target.length;
      let stray = 0; for (const dp of drawn) stray += minDist(dp, target); stray /= drawn.length;
      const timeSec = (performance.now() - startT) / 1000;

      const coverScore = coverage * 1000;
      const strayPenalty = Math.min(450, stray * 6);
      const timeBonus = Math.max(0, (mode === 'advanced' ? 14 : 11) - timeSec) * 14;
      const score = Math.max(0, Math.round(coverScore - strayPenalty + timeBonus));
      const thr = mode === 'advanced' ? [430, 680, 870] : [400, 640, 840];
      onDone({
        score,
        stars: starsFor(score, thr),
        detail: `${Math.round(coverage * 100)}% of the ${shape} traced in ${timeSec.toFixed(1)}s.`,
      });
    }

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    doneBtn.addEventListener('click', finish);
    clearBtn.addEventListener('click', () => { drawn = []; startT = 0; redraw(); ui.setInfo('Trace the outline'); });
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    reg.add(() => { window.removeEventListener('pointerup', up); window.removeEventListener('resize', onResize); });

    ui.setScore(`Shape: ${shape}`);
    ui.setInfo('Trace the outline');
    requestAnimationFrame(size);
    return reg.run;
  },
};
