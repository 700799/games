import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// "Battleship" — but with donuts. You and the computer each hide a set of
// donuts on a grid. Take turns guessing cells to "eat" the opponent's donuts.
// First player to find all of the other player's donuts wins.

export function donutHunt(shell, { getMode }) {
  const mode = getMode();
  const N = mode === 'advanced' ? 10 : 8;
  // Donut "lengths" (cell counts). Each donut occupies N contiguous cells.
  const DONUTS = mode === 'advanced'
    ? [{ size: 5, name: 'Family Box' }, { size: 4, name: 'Maple Bar' }, { size: 3, name: 'Glazed' }, { size: 3, name: 'Cake Donut' }, { size: 2, name: 'Donut Hole' }]
    : [{ size: 4, name: 'Maple Bar' }, { size: 3, name: 'Glazed' }, { size: 2, name: 'Donut Hole' }];

  header(shell, {
    title: '🍩 Donut Hunt',
    tag: `${N}×${N} grid · You vs Computer`,
    desc: 'Both you and the computer hide donuts on your boards. Tap cells on the opponent\'s board to take a bite. Find every donut before the computer finds yours!',
  });

  const tb = toolbar(shell);
  const turnSpan = el('span', { class: 'game-tag' });
  const randomBtn = el('button', { class: 'btn ghost' }, '🎲 Random placement');
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(turnSpan, randomBtn, restartBtn);

  const s = status(shell);
  const arena = el('div', {
    class: 'donut-arena',
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr', gap: '16px',
      marginTop: '12px',
    },
  });
  shell.appendChild(arena);

  let myBoard, aiBoard;       // {donuts:[], hits:Set, misses:Set}
  let phase;                  // 'place' | 'play' | 'over'
  let placeIdx;               // index of next donut to place
  let placeOrient;            // 'h' or 'v'
  let turn;                   // 'you' or 'ai'
  let aiState;                // for targeting heuristic

  function makeBoard() {
    return { donuts: [], hits: new Set(), misses: new Set() };
  }

  function reset() {
    myBoard = makeBoard();
    aiBoard = makeBoard();
    placeIdx = 0;
    placeOrient = 'h';
    phase = 'place';
    turn = 'you';
    aiState = { lastHits: [], huntDir: null, tried: new Set() };
    // AI places its donuts randomly
    placeRandomly(aiBoard);
    setStatus(s, `Place your ${DONUTS[0].name} (size ${DONUTS[0].size}). Press R to rotate.`);
    timers.resetGame();
    render();
  }

  function key(r, c) { return `${r},${c}`; }

  function donutCells(d) {
    const out = [];
    for (let i = 0; i < d.size; i++) {
      if (d.orient === 'h') out.push([d.r, d.c + i]);
      else out.push([d.r + i, d.c]);
    }
    return out;
  }

  function canPlace(board, d) {
    for (const [r, c] of donutCells(d)) {
      if (r < 0 || c < 0 || r >= N || c >= N) return false;
      for (const existing of board.donuts) {
        for (const [er, ec] of donutCells(existing)) {
          if (er === r && ec === c) return false;
        }
      }
    }
    return true;
  }

  function placeRandomly(board) {
    board.donuts = [];
    for (const def of DONUTS) {
      let tries = 0;
      while (tries < 200) {
        const orient = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * (orient === 'v' ? N - def.size + 1 : N));
        const c = Math.floor(Math.random() * (orient === 'h' ? N - def.size + 1 : N));
        const d = { ...def, r, c, orient };
        if (canPlace(board, d)) { board.donuts.push(d); break; }
        tries++;
      }
    }
  }

  function isHit(board, r, c) {
    return board.donuts.some((d) => donutCells(d).some(([dr, dc]) => dr === r && dc === c));
  }

  function donutEaten(board, d) {
    return donutCells(d).every(([r, c]) => board.hits.has(key(r, c)));
  }

  function isOver(board) {
    return board.donuts.every((d) => donutEaten(board, d));
  }

  function render() {
    arena.innerHTML = '';
    arena.appendChild(makeBoardEl({ title: 'Your kitchen', board: myBoard, isYou: true }));
    arena.appendChild(makeBoardEl({ title: 'Opponent kitchen', board: aiBoard, isYou: false }));

    turnSpan.textContent = phase === 'place'
      ? `Placement: ${DONUTS[placeIdx]?.name || ''} (${placeOrient === 'h' ? '↔' : '↕'})`
      : phase === 'over'
        ? 'Game over'
        : (turn === 'you' ? 'Your turn — tap opponent kitchen' : 'Computer is hunting…');
  }

  function makeBoardEl({ title, board, isYou }) {
    const wrap = el('div');
    wrap.appendChild(el('h3', { style: { textAlign: 'center', margin: '4px 0' } }, title));

    const remaining = board.donuts.filter((d) => !donutEaten(board, d)).length;
    wrap.appendChild(el('div', { class: 'game-tag', style: { textAlign: 'center' } },
      `Donuts left: ${remaining}/${board.donuts.length}`));

    const grid = el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: `repeat(${N}, 1fr)`,
        gap: '2px',
        margin: '8px auto',
        maxWidth: 'min(360px, 92vw)',
        aspectRatio: '1',
      },
    });

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = key(r, c);
        const hit = board.hits.has(k);
        const miss = board.misses.has(k);
        const hasDonut = isYou && isHit(board, r, c);

        const cell = el('div', {
          style: {
            background: hit ? '#ef476f'
              : miss ? '#3a4378'
              : (hasDonut ? '#c46410' : '#0f163a'),
            border: '1px solid var(--border)',
            borderRadius: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: phase === 'play' && !isYou && turn === 'you' && !hit && !miss ? 'pointer'
              : phase === 'place' && isYou ? 'pointer' : 'default',
            fontSize: 'clamp(10px, 2.5vw, 16px)',
            color: '#fff',
            userSelect: 'none',
            aspectRatio: '1',
          },
        });
        cell.textContent = hit ? '🍩' : miss ? '·' : (hasDonut && isYou ? '🍩' : '');

        if (phase === 'place' && isYou) {
          cell.onmouseenter = () => preview(r, c, true);
          cell.onmouseleave = () => preview(r, c, false);
          cell.onclick = () => tryPlace(r, c);
        } else if (phase === 'play' && !isYou && turn === 'you' && !hit && !miss) {
          cell.onclick = () => fire(r, c);
        }
        grid.appendChild(cell);
      }
    }
    wrap.appendChild(grid);

    if (phase === 'place' && isYou) {
      wrap.appendChild(el('div', { style: { textAlign: 'center', marginTop: '6px' } }, [
        el('button', { class: 'btn ghost', onclick: () => { placeOrient = placeOrient === 'h' ? 'v' : 'h'; render(); } }, '⟳ Rotate'),
      ]));
    }
    return wrap;
  }

  function preview(r, c, on) {
    // Lightweight inline preview — re-render only when toggling on certain events
    // (Skipped for performance; click-only is sufficient on mobile.)
  }

  function tryPlace(r, c) {
    const def = DONUTS[placeIdx];
    if (!def) return;
    const d = { ...def, r, c, orient: placeOrient };
    if (!canPlace(myBoard, d)) {
      setStatus(s, 'Donut won\'t fit there. Try another spot or rotate.', 'warn');
      return;
    }
    myBoard.donuts.push(d);
    placeIdx++;
    if (placeIdx >= DONUTS.length) {
      phase = 'play';
      setStatus(s, 'Boards ready! Take a bite of the opponent\'s board.');
    } else {
      setStatus(s, `Place your ${DONUTS[placeIdx].name} (size ${DONUTS[placeIdx].size}).`);
    }
    render();
  }

  function fire(r, c) {
    const k = key(r, c);
    if (aiBoard.hits.has(k) || aiBoard.misses.has(k)) return;
    if (isHit(aiBoard, r, c)) {
      aiBoard.hits.add(k);
      const d = aiBoard.donuts.find((d) => donutCells(d).some(([dr, dc]) => dr === r && dc === c));
      if (donutEaten(aiBoard, d)) {
        setStatus(s, `🍩 You ate the ${d.name}!`, 'good');
      } else {
        setStatus(s, `Crumbs! 🍩 Take another bite — your turn continues.`, 'good');
      }
      render();
      if (isOver(aiBoard)) { return finish('you'); }
      // In real Battleship, hits don't extend turn; but for a satisfying donut game, ending turn after every shot is more fair.
      turn = 'ai';
      setTimeout(aiTurn, 700);
    } else {
      aiBoard.misses.add(k);
      setStatus(s, 'Miss — no donut there.', 'warn');
      render();
      turn = 'ai';
      setTimeout(aiTurn, 600);
    }
  }

  function aiTurn() {
    if (phase !== 'play') return;
    // Heuristic: if recent hits exist, target adjacent cells; else random untried cell.
    const target = pickAiTarget();
    const [r, c] = target;
    const k = key(r, c);
    aiState.tried.add(k);
    if (isHit(myBoard, r, c)) {
      myBoard.hits.add(k);
      aiState.lastHits.push([r, c]);
      const d = myBoard.donuts.find((d) => donutCells(d).some(([dr, dc]) => dr === r && dc === c));
      if (donutEaten(myBoard, d)) {
        aiState.lastHits = [];
        setStatus(s, `🍩 The computer ate your ${d.name}!`, 'bad');
      } else {
        setStatus(s, `Computer found a bite at (${r + 1}, ${c + 1}).`, 'bad');
      }
      render();
      if (isOver(myBoard)) { return finish('ai'); }
      turn = 'you';
    } else {
      myBoard.misses.add(k);
      setStatus(s, `Computer missed at (${r + 1}, ${c + 1}).`, 'warn');
      render();
      turn = 'you';
    }
  }

  function pickAiTarget() {
    // Hunt mode: if we have 2+ hits in a row, lock onto the line and extend
    // along it; otherwise probe the neighbours of any unsunk hit.
    if (aiState.lastHits.length >= 2) {
      const a = aiState.lastHits[0], b = aiState.lastHits[aiState.lastHits.length - 1];
      const dr = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]);
      // Extend forward then backward along the locked axis.
      const tryExtend = (origin, sign) => {
        let [r, c] = origin;
        for (let step = 0; step < N; step++) {
          r += dr * sign; c += dc * sign;
          if (r < 0 || r >= N || c < 0 || c >= N) return null;
          const k = key(r, c);
          if (myBoard.misses.has(k)) return null;
          if (myBoard.hits.has(k) || aiState.tried.has(k)) continue;
          return [r, c];
        }
        return null;
      };
      const fwd = tryExtend(b, 1);
      if (fwd) return fwd;
      const back = tryExtend(a, -1);
      if (back) return back;
      // Line exhausted but ship not sunk — fall through to neighbour probe.
    }
    if (aiState.lastHits.length > 0) {
      const candidates = [];
      for (const [r, c] of aiState.lastHits) {
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr<0||nr>=N||nc<0||nc>=N) continue;
          const k = key(nr, nc);
          if (aiState.tried.has(k)) continue;
          if (myBoard.misses.has(k) || myBoard.hits.has(k)) continue;
          candidates.push([nr, nc]);
        }
      }
      if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    // Random untried cell with parity bias (checkerboard) for efficient search
    for (let attempts = 0; attempts < 500; attempts++) {
      const r = Math.floor(Math.random() * N);
      const c = Math.floor(Math.random() * N);
      if ((r + c) % 2 !== 0) continue;
      const k = key(r, c);
      if (aiState.tried.has(k) || myBoard.misses.has(k) || myBoard.hits.has(k)) continue;
      return [r, c];
    }
    // Fall-back: any untried
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k = key(r, c);
      if (!aiState.tried.has(k) && !myBoard.misses.has(k) && !myBoard.hits.has(k)) return [r, c];
    }
    return [0, 0];
  }

  function finish(winner) {
    phase = 'over';
    timers.stopGame();
    if (winner === 'you') {
      setStatus(s, '🎉 You ate every opponent donut!', 'good');
      celebrate({
        gameName: 'Donut Hunt',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Found all <b>${DONUTS.length}</b> donuts`,
      });
    } else {
      setStatus(s, 'The computer ate all your donuts. Try again!', 'bad');
    }
    render();
  }

  randomBtn.onclick = () => {
    placeRandomly(myBoard);
    placeIdx = DONUTS.length;
    phase = 'play';
    setStatus(s, 'Random placement done. Hunt the opponent\'s donuts!');
    render();
  };
  restartBtn.onclick = reset;

  const onKey = (e) => {
    if (e.key === 'r' || e.key === 'R') {
      placeOrient = placeOrient === 'h' ? 'v' : 'h';
      render();
    }
  };
  window.addEventListener('keydown', onKey);

  reset();
  return () => window.removeEventListener('keydown', onKey);
}
