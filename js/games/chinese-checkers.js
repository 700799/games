import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Compact 2-player Chinese Checkers on a smaller triangular grid.
// Each player has 6 pieces in their triangle (instead of full 10) to keep games
// at a sensible length while preserving the rules.
//
// Grid is a "diamond" of size 9 with the two side corners trimmed.
// Coordinates: (r, c) where r is row, c is column.
// Players: 1 (top, red) starts at top triangle, must reach bottom triangle.
//          2 (bottom, green) the reverse.

const ROWS = 9;
// Number of cells per row to form a hex-style diamond
const ROW_LENS = [5, 6, 7, 8, 9, 8, 7, 6, 5];

// Player 1 triangle = first 3 rows; Player 2 triangle = last 3 rows.
// In compact form, that's 5+6+7=18 cells per triangle, but we only fill 6 per
// player to keep the game tractable.
function startingPositions() {
  // Top: middle 6 cells of rows 0-1-2
  const p1 = [
    [0,2],[0,3],
    [1,2],[1,3],[1,4],
    [2,4],
  ];
  // Bottom: mirror
  const p2 = [
    [6,4],
    [7,2],[7,3],[7,4],
    [8,2],[8,3],
  ];
  return [p1, p2];
}
const HOME = {
  // Player 1 wants to land entirely in the bottom 3 rows
  1: [[6,4],[7,2],[7,3],[7,4],[8,2],[8,3]],
  2: [[0,2],[0,3],[1,2],[1,3],[1,4],[2,4]],
};

// Six neighbor offsets for hex-on-grid (using "offset coords" for diamond):
// Even/odd row differences:
const NEIGHBORS_EVEN = [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
const NEIGHBORS_ODD  = [[-1, 0],[-1,1],[0,-1],[0,1],[1, 0],[1,1]];

export function chineseCheckers(shell, { getMode }) {
  const mode = getMode();
  const vsAI = mode === 'quick';

  header(shell, {
    title: '⭐ Chinese Checkers',
    tag: vsAI ? 'You vs Computer · 6 pieces each' : 'Player 1 vs Player 2 · pass & play',
    desc: 'Move one piece per turn to an adjacent empty cell, OR chain jumps over neighboring pieces into empty cells beyond. Get all your pieces into the opposite triangle to win.',
  });

  const tb = toolbar(shell);
  const turnSpan = el('span', { class: 'game-tag' });
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  const endTurnBtn = el('button', { class: 'btn primary' }, 'End turn');
  tb.append(turnSpan, endTurnBtn, restartBtn);

  const s = status(shell);
  const wrap = el('div', { class: 'cc-wrap' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cc-svg');
  svg.setAttribute('viewBox', '0 0 480 540');
  wrap.appendChild(svg);
  shell.appendChild(wrap);

  let board, // map "r,c" -> player (1 or 2) or 0
      selected,
      turn,
      mustChain, // true if mid-jump-chain
      jumpedThisTurn,
      won;

  function key(r, c) { return `${r},${c}`; }

  function inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < ROW_LENS[r];
  }

  function neighbors(r, c) {
    const offs = r % 2 === 0 ? NEIGHBORS_EVEN : NEIGHBORS_ODD;
    return offs.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => inBounds(nr, nc));
  }

  function reset() {
    board = {};
    const [p1, p2] = startingPositions();
    p1.forEach(([r, c]) => board[key(r, c)] = 1);
    p2.forEach(([r, c]) => board[key(r, c)] = 2);
    selected = null;
    turn = 1;
    mustChain = false;
    jumpedThisTurn = false;
    won = false;
    render();
    setStatus(s, vsAI ? 'You are red (top). Move down to win.' : 'Player 1 (red) starts. Move down.');
    timers.resetGame();
  }

  function legalSteps(r, c) {
    const result = [];
    for (const [nr, nc] of neighbors(r, c)) {
      if (!board[key(nr, nc)]) result.push([nr, nc, 'step']);
    }
    return result;
  }

  function legalJumps(r, c) {
    // For each neighbor that has a piece, the cell beyond it (same direction) must be empty.
    const offs = r % 2 === 0 ? NEIGHBORS_EVEN : NEIGHBORS_ODD;
    const result = [];
    for (const [dr, dc] of offs) {
      const mr = r + dr, mc = c + dc;
      if (!inBounds(mr, mc) || !board[key(mr, mc)]) continue;
      // The "beyond" cell. For irregular offset grids, easiest is to use the
      // same direction but choose offsets based on the new mid row's parity.
      const offs2 = mr % 2 === 0 ? NEIGHBORS_EVEN : NEIGHBORS_ODD;
      // Find the offset that points "in the same general direction" — match index.
      const idx = offs.findIndex(([a, b]) => a === dr && b === dc);
      const [dr2, dc2] = offs2[idx];
      const tr = mr + dr2, tc = mc + dc2;
      if (inBounds(tr, tc) && !board[key(tr, tc)]) result.push([tr, tc, 'jump']);
    }
    return result;
  }

  function legalMoves(r, c) {
    return [...legalSteps(r, c), ...legalJumps(r, c)];
  }

  function hexCenter(r, c) {
    const len = ROW_LENS[r];
    const maxLen = Math.max(...ROW_LENS);
    const cellW = 44;
    const cellH = 50;
    const x = 240 + (c - (len - 1) / 2) * cellW;
    const y = 40 + r * cellH * 0.86;
    return [x, y];
  }

  function inZone(r, c, player) {
    return HOME[player].some(([hr, hc]) => hr === r && hc === c);
  }

  function render() {
    svg.innerHTML = '';
    // Background zones
    const zone1 = HOME[2]; // top zone for player 2's HOME is wait, HOME[2] is where p2 starts which is top
    // HOME[1] = bottom triangle (where p1 wants to reach), HOME[2] = top triangle
    [{ player: 1, cells: HOME[2] }, { player: 2, cells: HOME[1] }].forEach(({ player, cells }) => {
      cells.forEach(([r, c]) => {
        const [x, y] = hexCenter(r, c);
        const z = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        z.setAttribute('cx', x); z.setAttribute('cy', y); z.setAttribute('r', 22);
        z.setAttribute('class', 'cc-zone-' + player);
        svg.appendChild(z);
      });
    });

    const legal = selected ? legalMoves(selected.r, selected.c) : [];
    const legalSet = new Set(legal.map(([r, c]) => `${r},${c}`));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < ROW_LENS[r]; c++) {
        const [x, y] = hexCenter(r, c);
        const isLegal = legalSet.has(`${r},${c}`);
        const isSelected = selected && selected.r === r && selected.c === c;
        const cell = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cell.setAttribute('cx', x); cell.setAttribute('cy', y); cell.setAttribute('r', 16);
        cell.setAttribute('class', 'cc-cell' + (isSelected ? ' selected' : '') + (isLegal ? ' legal' : ''));
        cell.onclick = () => clickCell(r, c);
        svg.appendChild(cell);
        const owner = board[key(r, c)];
        if (owner) {
          const piece = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          piece.setAttribute('cx', x); piece.setAttribute('cy', y); piece.setAttribute('r', 12);
          piece.setAttribute('class', 'cc-piece-' + owner);
          svg.appendChild(piece);
        }
      }
    }

    turnSpan.textContent = vsAI
      ? (turn === 1 ? 'Your turn' : 'Computer thinking…')
      : `Player ${turn}'s turn`;
    endTurnBtn.style.display = jumpedThisTurn ? '' : 'none';
  }

  function checkWin(player) {
    // All pieces of `player` must occupy HOME[player]
    const homeSet = new Set(HOME[player].map(([r, c]) => `${r},${c}`));
    for (const k in board) if (board[k] === player && !homeSet.has(k)) return false;
    return true;
  }

  function endTurn() {
    if (!jumpedThisTurn && !mustChain) return;
    selected = null; jumpedThisTurn = false; mustChain = false;
    afterMove();
  }

  function afterMove() {
    if (checkWin(turn)) {
      finish(turn);
      return;
    }
    turn = turn === 1 ? 2 : 1;
    selected = null;
    render();
    setStatus(s, '');
    if (vsAI && turn === 2) {
      setTimeout(aiMove, 600);
    }
  }

  function clickCell(r, c) {
    if (won) return;
    if (vsAI && turn === 2) return;
    const owner = board[key(r, c)];

    if (mustChain && selected) {
      // Only jumps allowed; ignore other clicks
      const jumps = legalJumps(selected.r, selected.c);
      const match = jumps.find(([tr, tc]) => tr === r && tc === c);
      if (match) doJump(selected.r, selected.c, r, c);
      else if (selected && r === selected.r && c === selected.c) {
        // End chain
        endTurn();
      }
      return;
    }

    if (!selected) {
      if (owner === turn) {
        selected = { r, c };
        render();
      }
      return;
    }
    // Click own piece → reselect
    if (owner === turn) {
      selected = { r, c };
      render();
      return;
    }
    // Try to move
    const legal = legalMoves(selected.r, selected.c);
    const m = legal.find(([tr, tc]) => tr === r && tc === c);
    if (!m) {
      setStatus(s, 'Not a legal move.', 'warn');
      return;
    }
    const [_, __, kind] = m;
    if (kind === 'step') {
      board[key(r, c)] = turn;
      delete board[key(selected.r, selected.c)];
      selected = null;
      afterMove();
    } else {
      // jump
      doJump(selected.r, selected.c, r, c);
    }
  }

  function doJump(r1, c1, r2, c2) {
    board[key(r2, c2)] = turn;
    delete board[key(r1, c1)];
    selected = { r: r2, c: c2 };
    jumpedThisTurn = true;
    // Allow chaining: if further jumps exist
    const more = legalJumps(r2, c2);
    if (more.length) {
      mustChain = true;
      setStatus(s, 'Jumped! Continue chain or End Turn.', 'good');
    } else {
      mustChain = false;
    }
    render();
  }

  function aiMove() {
    if (won) return;
    // Simple heuristic: prefer moves that advance pieces toward their goal row.
    // For player 2, goal is row 0 (top), so smaller r is better.
    const myPieces = Object.entries(board)
      .filter(([, v]) => v === 2)
      .map(([k]) => k.split(',').map(Number));
    let best = null;
    let bestScore = -Infinity;
    for (const [r, c] of myPieces) {
      const moves = legalMoves(r, c);
      for (const [tr, tc, kind] of moves) {
        const gain = (r - tr) + (kind === 'jump' ? 1 : 0);
        if (gain > bestScore) {
          bestScore = gain; best = { from: [r, c], to: [tr, tc] };
        }
      }
    }
    if (!best) { afterMove(); return; }
    const [fr, fc] = best.from, [tr, tc] = best.to;
    board[key(tr, tc)] = 2;
    delete board[key(fr, fc)];
    render();
    setTimeout(() => {
      if (checkWin(2)) finish(2);
      else { turn = 1; render(); setStatus(s, 'Your turn.'); }
    }, 350);
  }

  function finish(player) {
    won = true;
    timers.stopGame();
    const playerWon = vsAI ? player === 1 : true;
    setStatus(s,
      vsAI
        ? (player === 1 ? 'You won!' : 'Computer won — try again.')
        : `Player ${player} wins!`,
      player === 1 || !vsAI ? 'good' : 'bad');
    if (playerWon) {
      celebrate({
        gameName: 'Chinese Checkers',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: vsAI ? 'Beat the computer!' : `Player ${player} wins!`,
      });
    }
  }

  endTurnBtn.onclick = endTurn;
  restartBtn.onclick = reset;
  reset();
  return () => {};
}
