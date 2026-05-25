import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import { rngFor, seededShuffle } from '../rng.js';

export function fifteen(shell, { getMode, seed = null, onResult = null }) {
  const mode = getMode();
  const N = mode === 'advanced' ? 4 : 3; // 3x3 (8-puzzle) or 4x4 (15-puzzle)
  const goal = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N)); // last is 0 = empty
  header(shell, {
    title: `🧩 ${N === 3 ? '8' : '15'}-Puzzle`,
    tag: `${N}×${N} grid`,
    desc: 'Slide tiles into ascending order with the empty space in the bottom-right corner. Click any tile adjacent to the empty cell to slide it.',
  });

  const tb = toolbar(shell);
  const moveSpan = el('span', {}, 'Moves: 0');
  const shuffleBtn = el('button', { class: 'btn ghost' }, '🔀 New Game');
  const hintBtn = el('button', { class: 'btn ghost' }, '💡 Show solved');
  tb.append(moveSpan, shuffleBtn, hintBtn);

  const s = status(shell);
  const grid = el('div', { class: 'puzzle-grid', style: {
    gridTemplateColumns: `repeat(${N}, 80px)`,
  }});
  shell.appendChild(grid);

  let board, moves, won, lastWasHint = false;

  function isSolvable(arr) {
    const a = arr.filter((x) => x !== 0);
    let inv = 0;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++;
    if (N % 2 === 1) return inv % 2 === 0;
    const blankRowFromBottom = N - Math.floor(arr.indexOf(0) / N);
    return (inv + blankRowFromBottom) % 2 === 0;
  }

  function scramble(rng) {
    let arr;
    do {
      arr = seededShuffle(goal, rng); // reuse rng across retries → deterministic for a seed
    } while (!isSolvable(arr) || arr.every((v, i) => v === goal[i]));
    return arr;
  }

  function reset() {
    // Seeded → identical scramble each reset (fair for challenges); else random.
    board = scramble(rngFor(seed));
    moves = 0; won = false; lastWasHint = false;
    render();
    setStatus(s, 'Slide tiles to solve the puzzle.');
    timers.resetGame();
  }

  function render() {
    grid.innerHTML = '';
    for (let i = 0; i < board.length; i++) {
      const v = board[i];
      const cell = el('div', { class: 'puzzle-tile' + (v === 0 ? ' empty' : '') }, v === 0 ? '' : String(v));
      cell.onclick = () => slide(i);
      grid.appendChild(cell);
    }
    moveSpan.textContent = `Moves: ${moves}`;
  }

  function slide(i) {
    if (won) return;
    const z = board.indexOf(0);
    const ix = i % N, iy = Math.floor(i / N);
    const zx = z % N, zy = Math.floor(z / N);
    if (Math.abs(ix - zx) + Math.abs(iy - zy) !== 1) {
      setStatus(s, 'Click a tile next to the blank.', 'warn');
      return;
    }
    [board[i], board[z]] = [board[z], board[i]];
    moves++;
    render();
    setStatus(s, '');
    if (board.every((v, i) => v === goal[i])) {
      won = true;
      timers.stopGame();
      setStatus(s, `Solved in ${moves} moves!`, 'good');
      if (onResult) onResult({ solved: true, moves, timeMs: timers.getGameElapsed(), score: 0 });
      else celebrate({
        gameName: `${N === 3 ? '8' : '15'}-Puzzle`,
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Moves: <b>${moves}</b>`,
      });
    }
  }

  shuffleBtn.onclick = reset;
  hintBtn.onclick = () => {
    if (!lastWasHint) {
      const saved = board.slice();
      board = goal.slice();
      render();
      setStatus(s, 'This is the goal state. Click again to resume.', 'warn');
      lastWasHint = true;
      hintBtn._saved = saved;
    } else {
      board = hintBtn._saved;
      render();
      setStatus(s, 'Back to your game.');
      lastWasHint = false;
    }
  };

  reset();
  return () => {};
}
