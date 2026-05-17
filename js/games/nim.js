import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Normal-play Nim: last move wins. AI plays via XOR strategy.
export function nim(shell, { getMode }) {
  const mode = getMode();
  const heaps = mode === 'advanced'
    ? [randHeap(7, 11), randHeap(5, 9), randHeap(3, 7), randHeap(2, 6)]
    : [randHeap(3, 5), randHeap(4, 6), randHeap(2, 5)];

  header(shell, {
    title: '⚫ Nim',
    tag: `${heaps.length} heaps · Last move WINS`,
    desc: 'On your turn, remove one or more stones from any single heap. The player who takes the last stone wins. The AI uses optimal XOR (nim-sum) strategy.',
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
    marked = new Set();
    currentHeap = -1;
    turn = 'P';
    over = false;
    render();
    setStatus(s, 'Click stones in one heap to remove them, then End Turn.');
    timers.resetGame();
  }

  function render() {
    heapsEl.innerHTML = '';
    state.forEach((count, i) => {
      const row = el('div', { class: 'nim-heap' });
      row.appendChild(el('div', { class: 'nim-label' }, `Heap ${i + 1}:`));
      for (let k = 0; k < count; k++) {
        const idx = k;
        const cls = 'nim-stone' + (marked.has(`${i}-${idx}`) ? ' marked' : '');
        const stone = el('div', { class: cls });
        stone.onclick = () => stoneClick(i, idx);
        row.appendChild(stone);
      }
      heapsEl.appendChild(row);
    });
    const removed = marked.size;
    const turnLine = over
      ? '<b>Game over.</b>'
      : turn === 'P'
        ? `Your turn — heap ${currentHeap < 0 ? '?' : currentHeap + 1}, ${removed} marked.`
        : `AI thinking…`;
    const endBtn = !over && turn === 'P' && removed > 0
      ? `<button id="end-turn" class="btn primary" style="margin-left:8px">End Turn</button>` : '';
    s.innerHTML = turnLine + endBtn;
    const e = document.getElementById('end-turn');
    if (e) e.onclick = endTurn;
  }

  function stoneClick(heap, idx) {
    if (over || turn !== 'P') return;
    if (currentHeap !== -1 && currentHeap !== heap) {
      setStatus(s, 'You can only take from one heap per turn.', 'warn');
      return;
    }
    const key = `${heap}-${idx}`;
    if (marked.has(key)) marked.delete(key); else marked.add(key);
    currentHeap = [...marked].length > 0 ? heap : -1;
    render();
  }

  function endTurn() {
    if (turn !== 'P' || marked.size === 0) return;
    const take = marked.size;
    state[currentHeap] -= take;
    marked.clear(); currentHeap = -1;
    render();
    if (state.every((c) => c === 0)) {
      finish('P');
      return;
    }
    turn = 'AI';
    setStatus(s, 'AI thinking…');
    setTimeout(aiMove, 700);
  }

  function aiMove() {
    // XOR strategy for normal-play Nim
    const xor = state.reduce((a, b) => a ^ b, 0);
    let moved = false;
    if (xor !== 0) {
      for (let i = 0; i < state.length; i++) {
        const target = state[i] ^ xor;
        if (target < state[i]) {
          state[i] = target; moved = true; break;
        }
      }
    }
    if (!moved) {
      // Losing position: take 1 from the largest heap
      let biggest = 0;
      for (let i = 1; i < state.length; i++) if (state[i] > state[biggest]) biggest = i;
      state[biggest]--;
    }
    render();
    if (state.every((c) => c === 0)) {
      finish('AI');
      return;
    }
    turn = 'P';
    setStatus(s, 'Your turn.');
  }

  function finish(winner) {
    over = true; turn = null;
    timers.stopGame();
    if (winner === 'P') {
      setStatus(s, 'You took the last stone — you win!', 'good');
      celebrate({
        gameName: 'Nim',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: 'Optimal play, beautifully done!',
      });
    } else {
      setStatus(s, 'AI took the last stone — try again.', 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}

function randHeap(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
