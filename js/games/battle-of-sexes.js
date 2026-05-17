import { el, header, status, setStatus, toolbar } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Battle of the Sexes — both players prefer to coordinate, but on different events.
// You prefer Opera (O); partner prefers Match (M).
// (O,O) = (3,2)  (M,M) = (2,3)  (O,M) = (0,0)  (M,O) = (0,0)
export function battleOfSexes(shell, { getMode }) {
  const mode = getMode();
  const ROUNDS = mode === 'advanced' ? 20 : 10;
  const par = mode === 'advanced' ? 38 : 18;

  header(shell, {
    title: '🎭 Battle of the Sexes',
    tag: `${ROUNDS} rounds · Asymmetric coordination`,
    desc: 'You prefer Opera; your partner prefers Match. Both prefer to be together rather than apart. Maximize coordination while protecting your preference.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(el('span', { class: 'game-tag' }, `Par: ${par}`), restartBtn);

  const s = status(shell);
  const panel = el('div', { class: 'gt-panel' });
  shell.appendChild(panel);

  let myTotal, opTotal, round, history, oppBias;

  function reset() {
    myTotal = 0; opTotal = 0; round = 0; history = []; oppBias = 0.55;
    render();
    setStatus(s, 'Choose Opera (you prefer) or Match (partner prefers).');
    timers.resetGame();
  }

  function payoff(you, op) {
    if (you === 'O' && op === 'O') return [3, 2];
    if (you === 'M' && op === 'M') return [2, 3];
    return [0, 0];
  }

  function aiMove() {
    // Adaptive partner: slightly prefers Match, mirrors recent moves.
    const recent = history.slice(-3);
    const youO = recent.filter((h) => h.you === 'O').length;
    let p = oppBias + youO * 0.05; // probability of Match
    p = Math.max(0.2, Math.min(0.85, p));
    return Math.random() < p ? 'M' : 'O';
  }

  function render() {
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, `Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}`),
      el('div', { class: 'gt-row' }, [
        el('button', { class: 'btn primary', onclick: () => play('O') }, '🎭 Opera (you prefer)'),
        el('button', { class: 'btn warn', onclick: () => play('M') }, '⚽ Match (partner prefers)'),
      ]),
      el('table', { class: 'payoff-table' }, [
        el('tr', {}, [el('th'), el('th'), el('th',{},'Partner O'), el('th',{},'Partner M')]),
        el('tr', {}, [el('th',{rowspan:'2'},'You'), el('th',{},'Opera'), el('td',{},'3, 2'), el('td',{},'0, 0')]),
        el('tr', {}, [el('th',{},'Match'), el('td',{},'0, 0'), el('td',{},'2, 3')]),
      ]),
    ]));
    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, 'Score'),
      el('div', { class: 'gt-row' }, [
        el('div', {}, ['You: ', el('span', { class: 'gt-score' }, String(myTotal))]),
        el('div', {}, ['Partner: ', el('span', { class: 'gt-score', style:{color:'#fbbf24'} }, String(opTotal))]),
      ]),
      el('h3', { style: { marginTop: '10px' } }, 'History'),
      (() => {
        const list = el('div', { class: 'history-list' });
        history.forEach((h, idx) => list.appendChild(
          el('div', { class: 'h-row' }, [
            el('span', {}, `R${idx + 1}`),
            el('span', {}, `You: ${h.you}`),
            el('span', {}, `P: ${h.op}`),
            el('span', {}, `+${h.you1} / +${h.op1}`),
          ])
        ));
        return list;
      })(),
    ]));
  }

  function play(my) {
    if (round >= ROUNDS) return;
    const op = aiMove();
    const [a, b] = payoff(my, op);
    myTotal += a; opTotal += b;
    history.push({ you: my, op, you1: a, op1: b });
    round++;
    if (round >= ROUNDS) finish();
    else setStatus(s, `R${round}: you ${my}, partner ${op}.`);
    render();
  }

  function finish() {
    timers.stopGame();
    if (myTotal >= par) {
      setStatus(s, `Final: You ${myTotal}, Partner ${opTotal}.`, 'good');
      celebrate({
        gameName: 'Battle of the Sexes',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `You: <b>${myTotal}</b> vs Partner: <b>${opTotal}</b>`,
      });
    } else {
      setStatus(s, `Final: You ${myTotal}, Partner ${opTotal} (par ${par}).`, 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
