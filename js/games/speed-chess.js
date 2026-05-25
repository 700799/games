import { el, header, toolbar, status, setStatus, teardownRegistry } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import { SPEED_PUZZLES } from '../data/speed-chess-puzzles.js';

const GLYPH = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

export function speedChess(shell, { getMode, onResult = null }) {
  const mode = getMode();
  const NUM = mode === 'advanced' ? SPEED_PUZZLES.length : 5;
  const timeScale = mode === 'advanced' ? 0.7 : 1; // tighter clock on advanced
  const puzzles = SPEED_PUZZLES.slice(0, NUM);
  const td = teardownRegistry();

  header(shell, {
    title: '⏱️ Speed Mates',
    tag: `${NUM} mate puzzles · beat the clock`,
    desc: 'Find the forced checkmate before the timer runs out. Each puzzle has 6–12 pieces and grows harder. Solve fast for a bigger speed bonus — 100 points per mate plus time left.',
  });

  const tb = toolbar(shell);
  const scoreSpan = el('span', {});
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart round');
  const hintBtn = el('button', { class: 'btn ghost' }, '💡 Hint');
  tb.append(scoreSpan, hintBtn, restartBtn);

  // Countdown + progress UI
  const clockWrap = el('div', { class: 'speed-clock' });
  const clockText = el('span', { class: 'speed-clock-text' }, '');
  const barOuter = el('div', { class: 'speed-bar' });
  const barInner = el('div', { class: 'speed-bar-fill' });
  barOuter.appendChild(barInner);
  clockWrap.append(clockText, barOuter);
  shell.appendChild(clockWrap);

  const prog = el('div', { class: 'puzzle-prog' });
  shell.appendChild(prog);

  const s = status(shell);
  const boardEl = el('div', { class: 'chess-board' });
  shell.appendChild(boardEl);

  let pIndex, board, expectedIdx, from, score, solvedCount, locked;
  let remainingMs, totalMs, ticker;

  function reset() {
    pIndex = 0; score = 0; solvedCount = 0;
    timers.resetGame();
    loadPuzzle(0);
  }

  function clearTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }
  td.add(clearTicker);

  function loadPuzzle(i) {
    clearTicker();
    const p = puzzles[i];
    board = p.board.map((r) => r.slice());
    expectedIdx = 0; from = null; locked = false;
    totalMs = Math.round(p.secs * timeScale * 1000);
    remainingMs = totalMs;
    render();
    setStatus(s, `Puzzle ${i + 1}/${NUM} — ${p.title}. White to mate${p.mateIn > 1 ? ` in ${p.mateIn}` : ''}.`);
    startTicker();
  }

  function startTicker() {
    const started = performance.now();
    const base = remainingMs;
    ticker = setInterval(() => {
      remainingMs = base - (performance.now() - started);
      if (remainingMs <= 0) {
        remainingMs = 0;
        updateClock();
        timeUp();
      } else {
        updateClock();
      }
    }, 100);
    updateClock();
  }

  function updateClock() {
    const secs = Math.ceil(remainingMs / 1000);
    clockText.textContent = `⏱ ${secs}s`;
    const pct = totalMs ? Math.max(0, (remainingMs / totalMs) * 100) : 0;
    barInner.style.width = pct + '%';
    barInner.style.background = pct > 50 ? 'var(--accent-3)' : pct > 20 ? 'var(--accent)' : 'var(--accent-2)';
    clockWrap.classList.toggle('low', pct <= 20);
  }

  function squareToCoord(sq) {
    return { row: 8 - parseInt(sq[1], 10), col: sq.charCodeAt(0) - 97 };
  }
  function coordToSquare(r, c) {
    return String.fromCharCode(97 + c) + (8 - r);
  }

  function render() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const piece = board[r][c];
        const cls = 'chess-sq ' + (isLight ? 'light' : 'dark')
          + (from && from.row === r && from.col === c ? ' from' : '');
        const sq = el('div', { class: cls });
        if (piece !== '.') {
          const isWhite = piece === piece.toUpperCase();
          sq.appendChild(el('span', { class: 'chess-piece ' + (isWhite ? 'white' : 'black') }, GLYPH[piece]));
        }
        sq.onclick = () => handleClick(r, c);
        boardEl.appendChild(sq);
      }
    }
    prog.innerHTML = '';
    puzzles.forEach((_, i) => {
      prog.appendChild(el('div', {
        class: 'puzzle-dot' + (i < pIndex ? ' solved' : '') + (i === pIndex ? ' current' : ''),
      }, String(i + 1)));
    });
    scoreSpan.textContent = `Score: ${score} · Solved ${solvedCount}/${NUM}`;
  }

  function handleClick(r, c) {
    if (locked) return;
    const p = puzzles[pIndex];
    const expected = p.moves[expectedIdx];
    if (!expected) return;
    if (from == null) {
      const piece = board[r][c];
      if (piece === '.') return;
      const isWhite = piece === piece.toUpperCase();
      if ((p.side === 'w') !== isWhite) { setStatus(s, 'Move a White piece.', 'warn'); return; }
      from = { row: r, col: c };
      render();
      return;
    }
    if (from.row === r && from.col === c) { from = null; render(); return; }
    const fromSq = coordToSquare(from.row, from.col);
    const toSq = coordToSquare(r, c);
    if (fromSq === expected[0] && toSq === expected[1]) {
      applyMove(from.row, from.col, r, c);
      from = null; expectedIdx++;
      render();
      const next = p.moves[expectedIdx];
      if (next && expectedIdx % 2 === 1) {
        locked = true;
        setStatus(s, "Correct! Opponent replies…", 'good');
        const t = setTimeout(() => {
          const f = squareToCoord(next[0]); const tt = squareToCoord(next[1]);
          applyMove(f.row, f.col, tt.row, tt.col);
          expectedIdx++; locked = false; render();
          if (!p.moves[expectedIdx]) solved();
          else setStatus(s, 'Now finish the mate!');
        }, 450);
        td.add(() => clearTimeout(t));
      } else if (!next) {
        solved();
      } else {
        setStatus(s, 'Correct! Keep going.', 'good');
      }
    } else {
      from = null; render();
      flashBad();
      setStatus(s, "Not the mating move — try again.", 'bad');
    }
  }

  function flashBad() {
    boardEl.classList.add('bad');
    const t = setTimeout(() => boardEl.classList.remove('bad'), 400);
    td.add(() => clearTimeout(t));
  }

  function applyMove(r1, c1, r2, c2) {
    let piece = board[r1][c1];
    if (piece === 'P' && r2 === 0) piece = 'Q';
    if (piece === 'p' && r2 === 7) piece = 'q';
    board[r2][c2] = piece;
    board[r1][c1] = '.';
  }

  function solved() {
    clearTicker();
    locked = true;
    const bonus = Math.round(remainingMs / 1000) * 2;
    const gained = 100 + bonus;
    score += gained;
    solvedCount++;
    setStatus(s, `Mate! +100 and +${bonus} speed bonus.`, 'good');
    render();
    advance(900);
  }

  function timeUp() {
    clearTicker();
    locked = true;
    const expected = puzzles[pIndex].moves[expectedIdx];
    setStatus(s, `Time! The move was ${expected ? expected[0] + '→' + expected[1] : 'missed'}.`, 'bad');
    advance(1400);
  }

  function advance(delay) {
    const t = setTimeout(() => {
      if (pIndex + 1 < NUM) {
        pIndex++;
        loadPuzzle(pIndex);
      } else {
        finishRound();
      }
    }, delay);
    td.add(() => clearTimeout(t));
  }

  function finishRound() {
    clearTicker();
    locked = true;
    timers.stopGame();
    if (onResult) {
      setStatus(s, `Round complete — solved ${solvedCount}/${NUM} for ${score} points!`, 'good');
      onResult({ solved: solvedCount > 0, score, moves: solvedCount, timeMs: timers.getGameElapsed() });
      return;
    }
    const passed = solvedCount >= Math.ceil(NUM / 2);
    if (passed) {
      setStatus(s, `Round complete — solved ${solvedCount}/${NUM} for ${score} points!`, 'good');
      celebrate({
        gameName: 'Speed Mates',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Solved <b>${solvedCount}/${NUM}</b> · <b>${score}</b> pts`,
      });
    } else {
      setStatus(s, `Round over — solved ${solvedCount}/${NUM} (${score} pts). Press Restart to try again.`, 'warn');
    }
  }

  hintBtn.onclick = () => {
    if (locked) return;
    const expected = puzzles[pIndex].moves[expectedIdx];
    if (expected) setStatus(s, `Hint: ${puzzles[pIndex].hint} (from ${expected[0]})`, 'warn');
  };
  restartBtn.onclick = reset;
  reset();

  return () => td.run();
}
