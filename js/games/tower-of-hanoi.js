import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

export function hanoi(shell, { getMode }) {
  const mode = getMode();
  const N = mode === 'advanced' ? 7 : 4; // 4 disks ~ 15 moves, 7 disks ~ 127
  header(shell, {
    title: '🗼 Tower of Hanoi',
    tag: `${N} disks · Optimal moves: ${(1 << N) - 1}`,
    desc: 'Move every disk to the rightmost peg. A larger disk may never sit on a smaller one. Click a peg to pick up its top disk, then click another peg to drop it.',
  });

  const tb = toolbar(shell);
  const moveSpan = el('span', {}, 'Moves: 0');
  const optSpan  = el('span', { class: 'game-tag' }, `(optimal ${(1<<N)-1})`);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(moveSpan, optSpan, restartBtn);

  const s = status(shell);
  const board = el('div', { class: 'hanoi-board' });
  shell.appendChild(board);

  let pegs, moves, selected, won;
  function reset() {
    pegs = [[], [], []];
    for (let i = N; i >= 1; i--) pegs[0].push(i);
    moves = 0; selected = null; won = false;
    render();
    setStatus(s, `Move all ${N} disks to the right peg.`);
    timers.resetGame();
  }

  const COLORS = ['#ef476f','#f78c6b','#ffd166','#06d6a0','#118ab2','#7c3aed','#ec4899','#f59e0b'];

  function render() {
    board.innerHTML = '';
    pegs.forEach((peg, i) => {
      const node = el('div', { class: 'hanoi-peg' + (selected === i ? ' selected' : '') });
      node.onclick = () => onPegClick(i);
      // disks from bottom to top
      peg.forEach((size, idx) => {
        const w = 60 + size * 22;
        const color = COLORS[(size - 1) % COLORS.length];
        const disk = el('div', { class: 'hanoi-disk', style: {
          width: `${w}px`, background: `linear-gradient(180deg, ${color}, #00000040)`,
        }}, String(size));
        node.appendChild(disk);
      });
      // newest pushed disk should be visually on top; but our flex column ends at bottom — order is fine
      board.appendChild(node);
    });
    moveSpan.textContent = `Moves: ${moves}`;
  }

  function onPegClick(i) {
    if (won) return;
    if (selected == null) {
      if (pegs[i].length === 0) {
        setStatus(s, 'That peg is empty — pick one with disks.', 'warn');
        return;
      }
      selected = i;
      render();
      setStatus(s, `Picked up disk ${pegs[i][pegs[i].length - 1]} from peg ${i + 1}.`);
    } else {
      if (selected === i) { selected = null; render(); setStatus(s, 'Cancelled.'); return; }
      const fromTop = pegs[selected][pegs[selected].length - 1];
      const toTop = pegs[i][pegs[i].length - 1];
      if (toTop != null && toTop < fromTop) {
        setStatus(s, `Can't place disk ${fromTop} on smaller disk ${toTop}.`, 'bad');
        return;
      }
      pegs[i].push(pegs[selected].pop());
      selected = null;
      moves++;
      render();
      if (pegs[2].length === N) {
        won = true;
        const optimal = (1 << N) - 1;
        timers.stopGame();
        setStatus(s,
          `Solved in ${moves} moves (optimal: ${optimal})!`,
          moves === optimal ? 'good' : 'warn');
        celebrate({
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
