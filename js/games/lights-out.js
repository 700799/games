import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

export function lightsOut(shell, { getMode }) {
  const mode = getMode();
  const N = mode === 'advanced' ? 5 : 3;
  header(shell, {
    title: '💡 Lights Out',
    tag: `${N}×${N} grid`,
    desc: 'Click any cell to toggle it and its four orthogonal neighbors. Turn every light off to win.',
  });

  const tb = toolbar(shell);
  const moves = el('span', {}, 'Moves: 0');
  const onCount = el('span', { class: 'game-tag' });
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ New puzzle');
  tb.append(moves, onCount, restartBtn);

  const s = status(shell);
  const grid = el('div', { class: 'lights-grid', style: {
    gridTemplateColumns: `repeat(${N}, 70px)`,
  }});
  shell.appendChild(grid);

  let board, won, mvs;

  function press(b, r, c) {
    for (const [dr, dc] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr<0||nr>=N||nc<0||nc>=N) continue;
      b[nr][nc] = !b[nr][nc];
    }
  }

  function genSolvable(steps) {
    const b = Array.from({ length: N }, () => Array(N).fill(false));
    for (let i = 0; i < steps; i++) {
      const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
      press(b, r, c);
    }
    if (b.flat().every((v) => !v)) return genSolvable(steps);
    return b;
  }

  function reset() {
    board = genSolvable(mode === 'advanced' ? 12 : 5);
    won = false; mvs = 0;
    render();
    setStatus(s, 'Turn off every light.');
    timers.resetGame();
  }

  function render() {
    grid.innerHTML = '';
    let lit = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const on = board[r][c]; if (on) lit++;
      const cell = el('div', { class: 'light' + (on ? ' on' : '') });
      cell.onclick = () => click(r, c);
      grid.appendChild(cell);
    }
    moves.textContent = `Moves: ${mvs}`;
    onCount.textContent = `Lit: ${lit}`;
  }

  function click(r, c) {
    if (won) return;
    press(board, r, c);
    mvs++;
    render();
    setStatus(s, '');
    if (board.flat().every((v) => !v)) {
      won = true;
      timers.stopGame();
      setStatus(s, `Solved in ${mvs} moves!`, 'good');
      celebrate({
        gameName: 'Lights Out',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Moves: <b>${mvs}</b>`,
      });
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
