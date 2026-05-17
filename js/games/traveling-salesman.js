import { el, header, status, setStatus, toolbar } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Click cities in order to form a tour. Beat (or match) the heuristic baseline.
export function tsp(shell, { getMode }) {
  const mode = getMode();
  const N = mode === 'advanced' ? 10 : 6;

  header(shell, {
    title: '🗺️ Traveling Salesman',
    tag: `${N} cities · find the shortest round-trip`,
    desc: 'Click cities in the order you want to visit them. You start where you click first and finish back there. Beat the nearest-neighbor baseline to win. Optimal score earns a perfect.',
  });

  const tb = toolbar(shell);
  const undoBtn = el('button', { class: 'btn ghost' }, '↶ Undo');
  const clearBtn = el('button', { class: 'btn ghost' }, '⌫ Clear');
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ New cities');
  const baselineSpan = el('span', { class: 'game-tag' });
  const yourSpan = el('span', { class: 'game-tag' });
  tb.append(yourSpan, baselineSpan, undoBtn, clearBtn, restartBtn);

  const s = status(shell);
  const canvasWrap = el('div', { class: 'tsp-canvas-wrap' });
  shell.appendChild(canvasWrap);
  const canvas = el('canvas', { id: 'tsp-canvas' });
  canvasWrap.appendChild(canvas);

  // Layout sizing
  const W = 900, H = 480;
  canvas.width = W; canvas.height = H;

  let cities, tour, baseline, optimalEstimate, won;

  function makeCities() {
    const pad = 40;
    const arr = [];
    let tries = 0;
    while (arr.length < N && tries < 2000) {
      const x = pad + Math.random() * (W - 2 * pad);
      const y = pad + Math.random() * (H - 2 * pad);
      if (arr.every(p => Math.hypot(p.x - x, p.y - y) > 70)) arr.push({ x, y });
      tries++;
    }
    return arr;
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function tourLen(idxs) {
    if (idxs.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < idxs.length - 1; i++) d += dist(cities[idxs[i]], cities[idxs[i + 1]]);
    return d;
  }
  function fullTourLen(idxs) {
    if (idxs.length < 2) return 0;
    return tourLen(idxs) + dist(cities[idxs[idxs.length - 1]], cities[idxs[0]]);
  }

  function nearestNeighbor(start = 0) {
    const visited = new Set([start]);
    const order = [start];
    while (order.length < cities.length) {
      const last = order[order.length - 1];
      let best = -1, bestD = Infinity;
      for (let j = 0; j < cities.length; j++) {
        if (visited.has(j)) continue;
        const d = dist(cities[last], cities[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      visited.add(best); order.push(best);
    }
    return fullTourLen(order);
  }

  function bestNN() {
    let best = Infinity;
    for (let i = 0; i < cities.length; i++) best = Math.min(best, nearestNeighbor(i));
    return best;
  }

  function reset() {
    cities = makeCities();
    tour = [];
    won = false;
    baseline = bestNN();
    // Rough optimal estimate (lower bound: MST-like via NN with 2-opt)
    optimalEstimate = baseline * 0.9;
    draw();
    updateLabels();
    setStatus(s, `Visit all ${N} cities and return. Beat ${baseline.toFixed(0)}.`);
    timers.resetGame();
  }

  function updateLabels() {
    const cur = fullTourLen(tour);
    yourSpan.textContent = tour.length === N
      ? `Your tour: ${cur.toFixed(0)}`
      : `Visited ${tour.length}/${N}`;
    baselineSpan.textContent = `Baseline: ${baseline.toFixed(0)}`;
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f163a';
    ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // tour lines
    if (tour.length > 0) {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cities[tour[0]].x, cities[tour[0]].y);
      for (let i = 1; i < tour.length; i++) ctx.lineTo(cities[tour[i]].x, cities[tour[i]].y);
      if (tour.length === N) ctx.lineTo(cities[tour[0]].x, cities[tour[0]].y);
      ctx.stroke();
    }

    // cities
    cities.forEach((c, i) => {
      const visitedIndex = tour.indexOf(i);
      const isFirst = tour[0] === i;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = visitedIndex >= 0
        ? (isFirst ? '#06d6a0' : '#ef476f')
        : '#118ab2';
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), c.x, c.y);
      if (visitedIndex >= 0) {
        ctx.fillStyle = '#000'; ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(String(visitedIndex + 1), c.x + 18, c.y - 14);
      }
    });
  }

  function pickCity(mx, my) {
    for (let i = 0; i < cities.length; i++) {
      if (Math.hypot(cities[i].x - mx, cities[i].y - my) <= 16) return i;
    }
    return -1;
  }

  const onClick = (e) => {
    if (won) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const idx = pickCity(mx, my);
    if (idx < 0) return;
    if (tour.includes(idx)) {
      setStatus(s, 'Already visited.', 'warn');
      return;
    }
    tour.push(idx);
    draw(); updateLabels();
    if (tour.length === N) {
      const len = fullTourLen(tour);
      timers.stopGame();
      if (len <= baseline) {
        won = true;
        const ratio = len / baseline;
        const grade = ratio < 0.92 ? 'Optimal!' : ratio < 1.0 ? 'Great!' : 'Tied baseline.';
        setStatus(s, `Tour ${len.toFixed(0)} vs baseline ${baseline.toFixed(0)} — ${grade}`, 'good');
        celebrate({
          gameName: 'Traveling Salesman',
          gameTimeMs: timers.getGameElapsed(),
          totalTimeMs: timers.getTotalElapsed(),
          extra: `Tour <b>${len.toFixed(0)}</b> vs baseline <b>${baseline.toFixed(0)}</b>`,
        });
      } else {
        setStatus(s, `Tour ${len.toFixed(0)} — baseline ${baseline.toFixed(0)}. Try a different order.`, 'bad');
      }
    } else {
      setStatus(s, `Picked city ${idx + 1}. ${N - tour.length} to go.`);
    }
  };

  undoBtn.onclick = () => { if (won) return; tour.pop(); draw(); updateLabels(); setStatus(s, ''); };
  clearBtn.onclick = () => { if (won) return; tour = []; draw(); updateLabels(); setStatus(s, ''); };
  restartBtn.onclick = reset;
  canvas.addEventListener('click', onClick);
  reset();

  return () => {
    canvas.removeEventListener('click', onClick);
  };
}
