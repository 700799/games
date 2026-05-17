import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Misère-play Nim: the player forced to take the last stone LOSES.
// Optimal strategy differs only when all heaps have size ≤ 1.
export function misereNim(shell, { getMode }) {
  const mode = getMode();
  const heaps = mode === 'advanced'
    ? [4, 5, 6, 7]
    : [3, 4, 5];

  header(shell, {
    title: '⚪ Misère Nim',
    tag: `${heaps.length} heaps · Last move LOSES`,
    desc: 'Same as Nim, but whoever takes the last stone LOSES. The AI plays optimal misère strategy.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ New game');
  tb.append(restartBtn);

  const s = status(shell);
  const heapsEl = el('div', { class: 'nim-heaps' });
  shell.appendChild(heapsEl);

  let state, marked, turn, over, currentHeap;

  function reset() {
    state = heaps.slice();
    marked = new Set(); currentHeap = -1; turn = 'P'; over = false;
    render();
    setStatus(s, 'Click stones to mark them, then End Turn. Make your opponent take the last one.');
    timers.resetGame();
  }

  function render() {
    heapsEl.innerHTML = '';
    state.forEach((count, i) => {
      const row = el('div', { class: 'nim-heap' });
      row.appendChild(el('div', { class: 'nim-label' }, `Heap ${i + 1}:`));
      for (let k = 0; k < count; k++) {
        const cls = 'nim-stone' + (marked.has(`${i}-${k}`) ? ' marked' : '');
        const stone = el('div', { class: cls });
        stone.onclick = () => stoneClick(i, k);
        row.appendChild(stone);
      }
      heapsEl.appendChild(row);
    });
    const removed = marked.size;
    const turnLine = over
      ? '<b>Game over.</b>'
      : turn === 'P'
        ? `Your turn — heap ${currentHeap < 0 ? '?' : currentHeap + 1}, ${removed} marked.`
        : 'AI thinking…';
    const endBtn = !over && turn === 'P' && removed > 0
      ? `<button id="mn-end" class="btn primary" style="margin-left:8px">End Turn</button>` : '';
    s.innerHTML = turnLine + endBtn;
    const e = document.getElementById('mn-end');
    if (e) e.onclick = endTurn;
  }

  function stoneClick(heap, idx) {
    if (over || turn !== 'P') return;
    if (currentHeap !== -1 && currentHeap !== heap) {
      setStatus(s, 'Only one heap per turn.', 'warn'); return;
    }
    const key = `${heap}-${idx}`;
    if (marked.has(key)) marked.delete(key); else marked.add(key);
    currentHeap = marked.size ? heap : -1;
    render();
  }

  function endTurn() {
    if (turn !== 'P' || marked.size === 0) return;
    state[currentHeap] -= marked.size;
    marked.clear(); currentHeap = -1;
    render();
    if (state.every((c) => c === 0)) { finish('AI'); return; } // we took last → we lose
    turn = 'AI';
    setStatus(s, 'AI thinking…');
    setTimeout(aiMove, 700);
  }

  function aiMove() {
    const big = state.filter((x) => x > 1).length;
    let moved = false;

    if (big === 0) {
      // All heaps ≤ 1: misère endgame — leave an ODD number of 1-heaps for opponent.
      const ones = state.filter((x) => x === 1).length;
      if (ones % 2 === 0) {
        const idx = state.indexOf(1);
        if (idx >= 0) { state[idx] = 0; moved = true; }
      } else {
        // already winning, take a single 1 if any to make a move (forced)
        const idx = state.indexOf(1);
        if (idx >= 0) { state[idx] = 0; moved = true; }
      }
    } else {
      const xor = state.reduce((a, b) => a ^ b, 0);
      if (big === 1) {
        // Misère trick: leave the right parity of 1-heaps.
        const ones = state.filter((x) => x === 1).length;
        const bigIdx = state.findIndex((x) => x > 1);
        state[bigIdx] = ones % 2 === 0 ? 1 : 0;
        moved = true;
      } else if (xor !== 0) {
        for (let i = 0; i < state.length; i++) {
          const t = state[i] ^ xor;
          if (t < state[i]) { state[i] = t; moved = true; break; }
        }
      } else {
        // Losing position; take 1 from the largest
        let b = 0; for (let i = 1; i < state.length; i++) if (state[i] > state[b]) b = i;
        state[b]--; moved = true;
      }
    }
    if (!moved) { let b = 0; for (let i = 1; i < state.length; i++) if (state[i] > state[b]) b = i; state[b]--; }
    render();
    if (state.every((c) => c === 0)) { finish('P'); return; }
    turn = 'P';
    setStatus(s, 'Your turn.');
  }

  function finish(winner) {
    over = true; turn = null;
    timers.stopGame();
    if (winner === 'P') {
      setStatus(s, 'AI took the last stone — you win!', 'good');
      celebrate({
        gameName: 'Misère Nim',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: 'Forced your opponent into the last move.',
      });
    } else {
      setStatus(s, 'You took the last stone — you lose this round.', 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
