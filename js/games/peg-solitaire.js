import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Board cell types: 'X' = not part of board, 'P' = peg, 'O' = empty hole
const ENGLISH = [
  'XX P P P XX',
  'XX P P P XX',
  ' P P P P P P P',
  ' P P P O P P P',
  ' P P P P P P P',
  'XX P P P XX',
  'XX P P P XX',
].map(r => r.trim().split(/\s+/));

// Smaller "cross" board for quick mode
const CROSS = [
  'X P P P X',
  'P P P P P',
  'P P O P P',
  'P P P P P',
  'X P P P X',
].map(r => r.trim().split(/\s+/));

export function pegSolitaire(shell, { getMode }) {
  const mode = getMode();
  const board = (mode === 'advanced' ? ENGLISH : CROSS).map(r => r.slice());
  const R = board.length, C = board[0].length;

  header(shell, {
    title: '🟠 Peg Solitaire',
    tag: mode === 'advanced' ? 'English board (33 holes)' : 'Cross board (21 holes)',
    desc: 'Jump a peg horizontally or vertically over a neighbor into the empty hole behind it. The jumped peg is removed. Win when only one peg remains (bonus if it ends in the center).',
  });

  const tb = toolbar(shell);
  const pegsSpan = el('span', {});
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(pegsSpan, restartBtn);

  const s = status(shell);
  const boardEl = el('div', { class: 'peg-board', style: {
    gridTemplateColumns: `repeat(${C}, 52px)`,
  }});
  shell.appendChild(boardEl);

  let selected = null, won = false;

  function countPegs() {
    let n = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (board[r][c] === 'P') n++;
    return n;
  }

  function hasMoves() {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (board[r][c] !== 'P') continue;
      for (const [dr, dc] of [[-2,0],[2,0],[0,-2],[0,2]]) {
        const nr = r + dr, nc = c + dc, mr = r + dr/2, mc = c + dc/2;
        if (nr<0||nr>=R||nc<0||nc>=C) continue;
        if (board[nr][nc] === 'O' && board[mr][mc] === 'P') return true;
      }
    }
    return false;
  }

  function render() {
    boardEl.innerHTML = '';
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const v = board[r][c];
        const cls = v === 'X' ? 'peg-cell invalid'
          : v === 'P' ? `peg-cell peg${selected && selected[0]===r&&selected[1]===c ? ' selected':''}`
          : 'peg-cell hole';
        const cell = el('div', { class: cls });
        cell.onclick = () => onClick(r, c);
        boardEl.appendChild(cell);
      }
    }
    pegsSpan.textContent = `Pegs: ${countPegs()}`;
  }

  function onClick(r, c) {
    if (won) return;
    const v = board[r][c];
    if (selected == null) {
      if (v !== 'P') return;
      selected = [r, c]; render();
      setStatus(s, `Selected peg at (${r + 1}, ${c + 1}).`);
    } else {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { selected = null; render(); setStatus(s, 'Deselected.'); return; }
      const dr = r - sr, dc = c - sc;
      if ((Math.abs(dr) === 2 && dc === 0) || (Math.abs(dc) === 2 && dr === 0)) {
        const mr = sr + dr / 2, mc = sc + dc / 2;
        if (board[r][c] === 'O' && board[mr][mc] === 'P') {
          board[sr][sc] = 'O';
          board[mr][mc] = 'O';
          board[r][c] = 'P';
          selected = null; render(); setStatus(s, '');
          const left = countPegs();
          if (left === 1) {
            won = true;
            timers.stopGame();
            // Optional bonus: ended in the center hole
            const cr = (R - 1) / 2, cc = (C - 1) / 2;
            const center = (board[cr] && board[cr][cc] === 'P');
            setStatus(s, `Solved! 1 peg remaining${center ? ' — in the center!' : ''}.`, 'good');
            celebrate({
              gameName: 'Peg Solitaire',
              gameTimeMs: timers.getGameElapsed(),
              totalTimeMs: timers.getTotalElapsed(),
              extra: center ? '🎯 Perfect — center finish!' : `Pegs left: <b>1</b>`,
            });
            return;
          }
          if (!hasMoves()) {
            setStatus(s, `No more moves. ${left} pegs left — try again.`, 'bad');
          }
        } else {
          setStatus(s, 'Must jump over a peg into an empty hole.', 'warn');
        }
      } else {
        setStatus(s, 'Jumps are 2 cells horizontally or vertically.', 'warn');
      }
    }
  }

  restartBtn.onclick = () => {
    const fresh = (mode === 'advanced' ? ENGLISH : CROSS).map(r => r.slice());
    board.length = 0; fresh.forEach(r => board.push(r));
    selected = null; won = false;
    timers.resetGame();
    render(); setStatus(s, '');
  };

  render();
  setStatus(s, 'Jump pegs to leave only one remaining.');
  return () => {};
}
