import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Real Mahjong Solitaire (Shanghai). Match pairs of identical "free" tiles
// (no tile on top, at least one of left/right is empty). Quick mode uses a
// smaller layout (~72 tiles); Advanced uses a full 144-tile Turtle.

// Standard mahjong deck: 1-9 of three suits × 4 + winds × 4 + dragons × 4 +
// 4 flowers (all matching) + 4 seasons (all matching) = 144 tiles.
function makeFullDeck() {
  const tiles = [];
  // 1-9 of three suits, 4 each
  ['bam', 'dot', 'chr'].forEach((suit) => {
    for (let v = 1; v <= 9; v++) {
      for (let k = 0; k < 4; k++) tiles.push({ suit, value: v, matchKey: `${suit}-${v}` });
    }
  });
  // Winds
  ['E', 'S', 'W', 'N'].forEach((w) => {
    for (let k = 0; k < 4; k++) tiles.push({ suit: 'wind', value: w, matchKey: `wind-${w}` });
  });
  // Dragons
  ['R', 'G', 'W'].forEach((d) => {
    for (let k = 0; k < 4; k++) tiles.push({ suit: 'drag', value: d, matchKey: `drag-${d}` });
  });
  // Flowers: any of the 4 match each other
  for (let k = 1; k <= 4; k++) tiles.push({ suit: 'flwr', value: k, matchKey: 'flwr' });
  // Seasons: any of the 4 match each other
  for (let k = 1; k <= 4; k++) tiles.push({ suit: 'ssn', value: k, matchKey: 'ssn' });
  return tiles;
}

// Turtle-style layouts. Both guarantee an even tile count so every tile pairs.
function makeAdvancedLayout() {
  const positions = [];
  // Layer 0 base: 10×8 = 80
  for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) positions.push({ layer: 0, row: r, col: c });
  // Layer 1: 8×4 (centered)
  for (let r = 2; r < 6; r++) for (let c = 1; c < 9; c++) positions.push({ layer: 1, row: r, col: c });
  // Layer 2: 4×2 (centered)
  for (let r = 3; r < 5; r++) for (let c = 3; c < 7; c++) positions.push({ layer: 2, row: r, col: c });
  // Layer 3: 2×1 top
  for (let c = 4; c < 6; c++) positions.push({ layer: 3, row: 3, col: c });
  // Total: 80 + 32 + 8 + 2 = 122 (even)
  return positions;
}

function makeQuickLayout() {
  const positions = [];
  // Layer 0: 8×6 = 48
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) positions.push({ layer: 0, row: r, col: c });
  // Layer 1: 4×3 = 12 (centered)
  for (let r = 1; r < 4; r++) for (let c = 2; c < 6; c++) positions.push({ layer: 1, row: r, col: c });
  // Layer 2: 2 on top
  for (let c = 3; c < 5; c++) positions.push({ layer: 2, row: 2, col: c });
  // Total: 48 + 12 + 2 = 62 (even)
  return positions;
}

function tileFace(t) {
  if (t.suit === 'bam')  return { text: String(t.value), sub: '🎋', color: 'face-green' };
  if (t.suit === 'dot')  return { text: String(t.value), sub: '●',  color: 'face-blue' };
  if (t.suit === 'chr')  return { text: String(t.value), sub: '萬', color: 'face-red' };
  if (t.suit === 'wind') return { text: t.value, sub: '風', color: 'face-blue' };
  if (t.suit === 'drag') {
    if (t.value === 'R') return { text: '中', sub: '', color: 'face-red' };
    if (t.value === 'G') return { text: '發', sub: '', color: 'face-green' };
    if (t.value === 'W') return { text: '□', sub: '', color: 'face-blue' };
  }
  if (t.suit === 'flwr') return { text: '✿', sub: String(t.value), color: 'face-orange' };
  if (t.suit === 'ssn')  return { text: '❀', sub: String(t.value), color: 'face-green' };
  return { text: '?', sub: '', color: '' };
}

export function mahjong(shell, { getMode }) {
  const mode = getMode();
  const layout = mode === 'advanced' ? makeAdvancedLayout() : makeQuickLayout();
  const TILE_W = mode === 'advanced' ? 36 : 48;
  const TILE_H = mode === 'advanced' ? 48 : 64;
  const LAYER_OFFSET = 4;

  header(shell, {
    title: '🀄 Mahjong Solitaire',
    tag: `${layout.length} tiles · Shanghai layout`,
    desc: 'Match pairs of identical tiles. A tile is selectable when nothing is stacked on top and at least one of its left/right sides is open. Clear the board to win.',
  });

  const tb = toolbar(shell);
  const pairsSpan = el('span', { class: 'game-tag' });
  const hintBtn = el('button', { class: 'btn ghost' }, '💡 Hint');
  const undoBtn = el('button', { class: 'btn ghost' }, '↶ Undo');
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(pairsSpan, hintBtn, undoBtn, restartBtn);

  const s = status(shell);
  const wrap = el('div', { class: 'mj-wrap' });
  const boardEl = el('div', { class: 'mj-board' });
  wrap.appendChild(boardEl);
  shell.appendChild(wrap);

  let tiles, // array of { ...pos, code, removed }
      selected,
      history,
      won;

  function distributeDeck(positions) {
    const target = positions.length;
    if (target % 2 !== 0) throw new Error('Layout must have an even tile count');
    const fullDeck = makeFullDeck();
    // Group tiles by matchKey, then form pairs within each group.
    const groups = {};
    for (const t of fullDeck) (groups[t.matchKey] ||= []).push(t);
    const pairs = [];
    for (const k in groups) {
      const arr = groups[k];
      for (let i = 0; i + 1 < arr.length; i += 2) pairs.push([arr[i], arr[i + 1]]);
    }
    pairs.sort(() => Math.random() - 0.5);
    const chosen = pairs.slice(0, target / 2).flat().sort(() => Math.random() - 0.5);
    return positions.map((p, i) => ({ ...p, ...chosen[i], removed: false, idx: i }));
  }

  function reset() {
    tiles = distributeDeck(layout);
    selected = null;
    history = [];
    won = false;
    sizeBoard();
    render();
    timers.resetGame();
    setStatus(s, 'Tap a free tile, then tap its match.');
  }

  function sizeBoard() {
    const maxRow = Math.max(...layout.map((p) => p.row));
    const maxCol = Math.max(...layout.map((p) => p.col));
    const maxLayer = Math.max(...layout.map((p) => p.layer));
    boardEl.style.width = (maxCol + 1) * TILE_W + maxLayer * LAYER_OFFSET + 'px';
    boardEl.style.height = (maxRow + 1) * TILE_H + maxLayer * LAYER_OFFSET + 'px';
    boardEl.style.minWidth = boardEl.style.width;
  }

  function isOnTop(t) {
    for (const u of tiles) {
      if (u.removed || u.idx === t.idx) continue;
      if (u.layer <= t.layer) continue;
      // Overlapping in row/col? Use ±0.5 tolerance
      if (Math.abs(u.row - t.row) <= 0.6 && Math.abs(u.col - t.col) <= 0.6) return false;
    }
    return true;
  }

  function sideFree(t) {
    let leftBlocked = false, rightBlocked = false;
    for (const u of tiles) {
      if (u.removed || u.idx === t.idx) continue;
      if (u.layer !== t.layer) continue;
      if (Math.abs(u.row - t.row) > 0.6) continue;
      if (Math.abs(u.col - (t.col - 1)) < 0.6) leftBlocked = true;
      if (Math.abs(u.col - (t.col + 1)) < 0.6) rightBlocked = true;
    }
    return !leftBlocked || !rightBlocked;
  }

  function isFree(t) {
    return !t.removed && isOnTop(t) && sideFree(t);
  }

  function pairsRemaining() {
    const remaining = tiles.filter((t) => !t.removed).length;
    return remaining / 2;
  }

  function findHintPair() {
    const free = tiles.filter(isFree);
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (free[i].matchKey === free[j].matchKey) return [free[i], free[j]];
      }
    }
    return null;
  }

  function render() {
    boardEl.innerHTML = '';
    // Sort by layer (low first) so higher layers render on top
    const sorted = tiles.slice().sort((a, b) => a.layer - b.layer);
    for (const t of sorted) {
      if (t.removed) continue;
      const left = t.col * TILE_W * 0.9 + t.layer * LAYER_OFFSET;
      const top = t.row * TILE_H * 0.9 - t.layer * LAYER_OFFSET;
      const blocked = !isFree(t);
      const isSel = selected && selected.idx === t.idx;
      const tileEl = el('div', {
        class: 'mj-tile' + (blocked ? ' blocked' : '') + (isSel ? ' selected' : ''),
        'data-idx': String(t.idx),
        style: {
          left: left + 'px', top: top + 'px',
          width: TILE_W + 'px', height: TILE_H + 'px',
          fontSize: (TILE_W * 0.5) + 'px',
          zIndex: String(t.layer * 100 + t.row + 1),
        },
      });
      const face = tileFace(t);
      const inner = el('div', { style: { textAlign: 'center', lineHeight: '1.0' } });
      inner.appendChild(el('div', { class: face.color }, face.text));
      if (face.sub) inner.appendChild(el('div', {
        class: face.color, style: { fontSize: (TILE_W * 0.32) + 'px' },
      }, face.sub));
      tileEl.appendChild(inner);
      tileEl.onclick = () => clickTile(t);
      boardEl.appendChild(tileEl);
    }
    const remaining = tiles.filter((t) => !t.removed).length;
    pairsSpan.textContent = `Remaining: ${remaining}`;
  }

  function clickTile(t) {
    if (won) return;
    if (!isFree(t)) {
      setStatus(s, 'That tile is blocked.', 'warn');
      return;
    }
    if (!selected) {
      selected = t;
      render();
      setStatus(s, 'Now tap its match.');
      return;
    }
    if (selected.idx === t.idx) {
      selected = null; render(); setStatus(s, 'Deselected.');
      return;
    }
    if (selected.matchKey === t.matchKey) {
      // Match!
      history.push([selected.idx, t.idx]);
      selected.removed = true;
      t.removed = true;
      selected = null;
      render();
      if (tiles.every((x) => x.removed)) {
        won = true;
        timers.stopGame();
        setStatus(s, 'Board cleared!', 'good');
        celebrate({
          gameName: 'Mahjong Solitaire',
          gameTimeMs: timers.getGameElapsed(),
          totalTimeMs: timers.getTotalElapsed(),
          extra: `Cleared <b>${layout.length}</b> tiles`,
        });
      } else if (!findHintPair()) {
        setStatus(s, 'No more legal pairs — Undo or Restart.', 'bad');
      } else {
        setStatus(s, 'Matched!', 'good');
      }
    } else {
      setStatus(s, 'Those tiles do not match.', 'warn');
      selected = t;
      render();
    }
  }

  hintBtn.onclick = () => {
    const pair = findHintPair();
    if (!pair) { setStatus(s, 'No legal pairs left — Undo or Restart.', 'bad'); return; }
    Array.from(boardEl.querySelectorAll('.mj-tile.hint')).forEach((n) => n.classList.remove('hint'));
    pair.forEach((p) => {
      const node = boardEl.querySelector(`.mj-tile[data-idx="${p.idx}"]`);
      if (node) node.classList.add('hint');
    });
    const face = tileFace(pair[0]);
    setStatus(s, `Hint: a matching ${face.text}${face.sub ? '/' + face.sub : ''} pair is free.`, 'warn');
  };
  undoBtn.onclick = () => {
    if (won) return;
    const last = history.pop();
    if (!last) return;
    tiles[last[0]].removed = false;
    tiles[last[1]].removed = false;
    selected = null;
    render();
    setStatus(s, 'Undone.');
  };
  restartBtn.onclick = reset;
  reset();

  return () => {};
}
