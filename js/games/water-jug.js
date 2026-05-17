import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

export function waterJug(shell, { getMode }) {
  const mode = getMode();
  // Generate a solvable puzzle with gcd-style reasoning.
  const puzzles = mode === 'advanced'
    ? [
        { caps: [8, 5, 3], target: 4 },
        { caps: [12, 7, 5], target: 6 },
        { caps: [10, 7, 3], target: 5 },
      ]
    : [
        { caps: [5, 3], target: 4 },
        { caps: [7, 3], target: 5 },
        { caps: [9, 4], target: 6 },
      ];
  const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  const caps = puzzle.caps;
  const target = puzzle.target;

  header(shell, {
    title: '🪣 Water Jug',
    tag: `Jugs: ${caps.join(', ')} L · Target: ${target} L`,
    desc: 'Get exactly the target volume into any jug. You may FILL a jug to its capacity, EMPTY it, or POUR water from one jug into another until the source is empty or the destination is full.',
  });

  const tb = toolbar(shell);
  const moveSpan = el('span', {}, 'Steps: 0');
  const resetBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(moveSpan, resetBtn);

  const s = status(shell);
  const jugsWrap = el('div', { class: 'jugs' });
  shell.appendChild(jugsWrap);

  let vols = caps.map(() => 0), moves = 0, won = false;

  function render() {
    jugsWrap.innerHTML = '';
    caps.forEach((cap, idx) => {
      const fillPct = (vols[idx] / cap) * 100;
      const jug = el('div', { class: 'jug', style: { height: `${40 + cap * 20}px` } }, [
        el('div', { class: 'jug-water', style: { height: `${fillPct}%` } }),
      ]);
      const label = el('div', { class: 'jug-label' }, `Jug ${idx + 1}: ${vols[idx]} / ${cap} L`);
      const actions = el('div', { class: 'jug-actions' });
      actions.appendChild(el('button', { class: 'btn', onclick: () => act('fill', idx) }, 'Fill'));
      actions.appendChild(el('button', { class: 'btn ghost', onclick: () => act('empty', idx) }, 'Empty'));
      caps.forEach((_, j) => {
        if (j === idx) return;
        actions.appendChild(el('button', {
          class: 'btn ghost',
          onclick: () => act('pour', idx, j),
        }, `Pour → Jug ${j + 1}`));
      });
      jugsWrap.appendChild(el('div', { class: 'jug-wrap' }, [jug, label, actions]));
    });
    moveSpan.textContent = `Steps: ${moves}`;
  }

  function checkWin() {
    if (vols.some((v) => v === target)) {
      won = true;
      timers.stopGame();
      setStatus(s, `Exactly ${target} L! ${moves} steps.`, 'good');
      celebrate({
        gameName: 'Water Jug',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Steps: <b>${moves}</b>`,
      });
    }
  }

  function act(op, i, j) {
    if (won) return;
    if (op === 'fill') vols[i] = caps[i];
    else if (op === 'empty') vols[i] = 0;
    else if (op === 'pour') {
      const room = caps[j] - vols[j];
      const amount = Math.min(vols[i], room);
      vols[i] -= amount;
      vols[j] += amount;
    }
    moves++;
    render();
    setStatus(s, '');
    checkWin();
  }

  resetBtn.onclick = () => {
    vols = caps.map(() => 0); moves = 0; won = false;
    render(); setStatus(s, ''); timers.resetGame();
  };

  render();
  setStatus(s, `Measure exactly ${target} L in any jug.`);
  return () => {};
}
