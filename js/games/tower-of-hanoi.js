import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Click a peg with disks (source). Then click any other peg (destination).
// Click the source peg again to cancel.
export function hanoi(shell, { getMode, onResult = null }) {
  const mode = getMode();
  const N = mode === 'advanced' ? 7 : 4;
  header(shell, {
    title: '🗼 Tower of Hanoi',
    tag: `${N} disks · Optimal: ${(1 << N) - 1} moves`,
    desc: 'Tap a peg to pick up its top disk, then tap another peg to place it. Larger disks may never sit on smaller ones. Solve by moving every disk to peg C.',
  });

  const tb = toolbar(shell);
  const moveSpan = el('span', {}, 'Moves: 0');
  const optSpan  = el('span', { class: 'game-tag' }, `(optimal ${(1<<N)-1})`);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(moveSpan, optSpan, restartBtn);

  const s = status(shell);
  const board = el('div', { class: 'hanoi-board' });
  shell.appendChild(board);

  let pegs, moves, source, won;
  function reset() {
    pegs = [[], [], []];
    for (let i = N; i >= 1; i--) pegs[0].push(i);
    moves = 0; source = null; won = false;
    render();
    setStatus(s, 'Tap a peg to pick up its top disk.');
    timers.resetGame();
  }

  const COLORS = ['#ef476f','#f78c6b','#ffd166','#06d6a0','#118ab2','#7c3aed','#ec4899','#f59e0b'];
  const LABELS = ['A', 'B', 'C'];

  function render() {
    board.innerHTML = '';
    pegs.forEach((peg, i) => {
      const node = el('div', {
        class: 'hanoi-peg'
          + (source === i ? ' source' : '')
          + (source != null && source !== i ? ' target-hint' : ''),
      });
      node.appendChild(el('div', { class: 'peg-label' },
        `${LABELS[i]}${source === i ? ' ▲' : (source != null ? ' ↓' : '')}`));
      node.onclick = () => onPegClick(i);
      peg.forEach((size, idx) => {
        const w = 25 + (size / N) * 65; // percent of peg width
        const color = COLORS[(size - 1) % COLORS.length];
        const lifted = (source === i && idx === peg.length - 1);
        const disk = el('div', {
          class: 'hanoi-disk' + (lifted ? ' lifted' : ''),
          style: {
            width: `${w}%`,
            background: `linear-gradient(180deg, ${color}, #00000040)`,
          },
        }, String(size));
        node.appendChild(disk);
      });
      board.appendChild(node);
    });
    moveSpan.textContent = `Moves: ${moves}`;
  }

  function onPegClick(i) {
    if (won) return;
    if (source == null) {
      if (pegs[i].length === 0) {
        setStatus(s, `Peg ${LABELS[i]} is empty — pick a peg with disks.`, 'warn');
        return;
      }
      source = i;
      render();
      setStatus(s, `Picked up disk ${pegs[i][pegs[i].length - 1]} from ${LABELS[i]}. Tap a destination.`);
    } else if (source === i) {
      source = null; render();
      setStatus(s, 'Cancelled. Tap a peg to pick up a disk.');
    } else {
      const fromTop = pegs[source][pegs[source].length - 1];
      const toTop = pegs[i][pegs[i].length - 1];
      if (toTop != null && toTop < fromTop) {
        setStatus(s, `Can't place disk ${fromTop} on smaller disk ${toTop}. Pick a different destination.`, 'bad');
        return;
      }
      pegs[i].push(pegs[source].pop());
      source = null;
      moves++;
      render();
      if (pegs[2].length === N) {
        won = true;
        const optimal = (1 << N) - 1;
        timers.stopGame();
        setStatus(s,
          `Solved in ${moves} moves (optimal: ${optimal})!`,
          moves === optimal ? 'good' : 'warn');
        if (onResult) onResult({ solved: true, moves, timeMs: timers.getGameElapsed(), score: 0 });
        else celebrate({
          gameName: 'Tower of Hanoi',
          gameTimeMs: timers.getGameElapsed(),
          totalTimeMs: timers.getTotalElapsed(),
          extra: `Moves: <b>${moves}</b> / optimal <b>${optimal}</b>`,
        });
      } else {
        setStatus(s, '');
      }
    }
  }

  restartBtn.onclick = reset;
  reset();

  return () => {};
}
