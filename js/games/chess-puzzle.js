import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import { PUZZLES } from '../data/chess-puzzles.js';

const GLYPH = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

export function chessPuzzle(shell, { getMode }) {
  const mode = getMode();
  const NUM = mode === 'advanced' ? PUZZLES.length : 5;
  const puzzles = PUZZLES.slice(0, NUM);

  header(shell, {
    title: '♟ Chess Puzzles',
    tag: `${NUM} puzzles · progressively harder`,
    desc: 'Tap a piece to select it, then tap a target square to move. Each puzzle has a forced solution — find every move. Solve them all to win.',
  });

  const tb = toolbar(shell);
  const progSpan = el('div', { class: 'puzzle-prog' });
  const hintBtn = el('button', { class: 'btn ghost' }, '💡 Hint');
  const showBtn = el('button', { class: 'btn ghost' }, '👁 Show solution');
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ This puzzle');
  tb.append(hintBtn, showBtn, restartBtn, progSpan);

  const s = status(shell);
  const puzzleHead = el('div', { class: 'chess-puzzle-head' });
  shell.appendChild(puzzleHead);
  const boardEl = el('div', { class: 'chess-board' });
  shell.appendChild(boardEl);

  let pIndex, board, side, expectedIdx, from, won, wrongAttempts;

  function loadPuzzle(i) {
    const p = puzzles[i];
    board = p.board.map((r) => r.slice());
    side = p.side;
    expectedIdx = 0;
    from = null;
    wrongAttempts = 0;
    render();
    renderHead(p);
    setStatus(s, `Puzzle ${i + 1}/${NUM} · ${side === 'w' ? 'White' : 'Black'} to move.`);
  }

  function renderHead(p) {
    puzzleHead.innerHTML = '';
    puzzleHead.appendChild(el('div', { class: 'cph-title' }, p.title));
    if (p.theme) puzzleHead.appendChild(el('span', { class: 'cph-theme' }, p.theme));
  }

  function reset() {
    pIndex = 0; won = false;
    timers.resetGame();
    loadPuzzle(pIndex);
  }

  function squareToCoord(sq) {
    const file = sq.charCodeAt(0) - 97; // a=0
    const rank = parseInt(sq[1], 10) - 1; // 1=0
    return { row: 7 - rank, col: file };
  }
  function coordToSquare(row, col) {
    return String.fromCharCode(97 + col) + (8 - row);
  }

  function render() {
    boardEl.innerHTML = '';
    const expected = puzzles[pIndex].moves[expectedIdx];
    const expectedFrom = expected ? squareToCoord(expected[0]) : null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const piece = board[r][c];
        const cls = 'chess-sq ' + (isLight ? 'light' : 'dark')
          + (from && from.row === r && from.col === c ? ' from' : '');
        const sq = el('div', { class: cls });
        if (piece !== '.') {
          const isWhite = piece === piece.toUpperCase();
          sq.appendChild(el('span', {
            class: 'chess-piece ' + (isWhite ? 'white' : 'black'),
          }, GLYPH[piece]));
        }
        sq.onclick = () => handleClick(r, c);
        boardEl.appendChild(sq);
      }
    }
    progSpan.innerHTML = '';
    puzzles.forEach((_, i) => {
      progSpan.appendChild(el('div', {
        class: 'puzzle-dot' + (i < pIndex ? ' solved' : '') + (i === pIndex ? ' current' : ''),
      }, String(i + 1)));
    });
  }

  function handleClick(r, c) {
    if (won) return;
    const expected = puzzles[pIndex].moves[expectedIdx];
    if (!expected) return;
    if (from == null) {
      // Pick a piece of the side-to-move
      const piece = board[r][c];
      if (piece === '.') return;
      const isWhite = piece === piece.toUpperCase();
      if ((side === 'w') !== isWhite) {
        setStatus(s, "That's not your piece.", 'warn');
        return;
      }
      from = { row: r, col: c };
      render();
      return;
    }
    if (from.row === r && from.col === c) {
      from = null; render(); return;
    }
    const fromSq = coordToSquare(from.row, from.col);
    const toSq = coordToSquare(r, c);
    const [expFrom, expTo] = expected;
    if (fromSq === expFrom && toSq === expTo) {
      // Apply move
      applyMove(from.row, from.col, r, c);
      from = null;
      expectedIdx++;
      render();
      // Opponent's reply (if puzzle defines one)
      const next = puzzles[pIndex].moves[expectedIdx];
      if (next && expectedIdx % 2 === 1) {
        setTimeout(() => {
          const f = squareToCoord(next[0]); const t = squareToCoord(next[1]);
          applyMove(f.row, f.col, t.row, t.col);
          expectedIdx++;
          render();
          const after = puzzles[pIndex].moves[expectedIdx];
          if (!after) afterSolved();
          else setStatus(s, "Opponent responded — now find the next move.");
        }, 500);
        setStatus(s, "Correct! Watching opponent's reply…", 'good');
      } else if (!next) {
        afterSolved();
      } else {
        setStatus(s, "Correct! Keep going.", 'good');
      }
    } else {
      // Wrong move
      from = null;
      wrongAttempts++;
      render();
      const tail = wrongAttempts >= 2 ? ' Try the 💡 Hint button.' : '';
      setStatus(s, `That's not the puzzle's move. Try again.${tail}`, 'bad');
    }
  }

  // Flash two squares (from + to) for a couple of seconds as a visual hint.
  function flashSquares(fromSq, toSq, ms = 1800) {
    const squareCells = Array.from(boardEl.children);
    const idx = (sq) => {
      const c = sq.charCodeAt(0) - 97;
      const r = 8 - parseInt(sq[1], 10);
      return r * 8 + c;
    };
    const fEl = squareCells[idx(fromSq)];
    const tEl = squareCells[idx(toSq)];
    if (fEl) fEl.classList.add('hint-from');
    if (tEl) tEl.classList.add('hint-to');
    setTimeout(() => {
      fEl && fEl.classList.remove('hint-from');
      tEl && tEl.classList.remove('hint-to');
    }, ms);
  }

  function applyMove(r1, c1, r2, c2) {
    let piece = board[r1][c1];
    // Auto-promotion to queen if pawn reaches last rank
    if (piece === 'P' && r2 === 0) piece = 'Q';
    if (piece === 'p' && r2 === 7) piece = 'q';
    board[r2][c2] = piece;
    board[r1][c1] = '.';
  }

  function afterSolved() {
    setStatus(s, `Puzzle ${pIndex + 1} solved!`, 'good');
    if (pIndex + 1 < NUM) {
      pIndex++;
      setTimeout(() => loadPuzzle(pIndex), 1100);
    } else {
      won = true;
      timers.stopGame();
      setStatus(s, `All ${NUM} puzzles solved!`, 'good');
      celebrate({
        gameName: 'Chess Puzzles',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Solved <b>${NUM}</b> puzzles`,
      });
    }
  }

  hintBtn.onclick = () => {
    const expected = puzzles[pIndex].moves[expectedIdx];
    if (!expected) return;
    flashSquares(expected[0], expected[1]);
    setStatus(s, `Hint: ${puzzles[pIndex].hint} (${expected[0]} → ${expected[1]})`, 'warn');
  };
  showBtn.onclick = () => {
    const expected = puzzles[pIndex].moves[expectedIdx];
    if (!expected) return;
    flashSquares(expected[0], expected[1], 2400);
    setStatus(s, `Solution begins: ${expected[0]} → ${expected[1]}. Play it.`, 'warn');
  };
  restartBtn.onclick = () => loadPuzzle(pIndex);

  reset();
  return () => {};
}
