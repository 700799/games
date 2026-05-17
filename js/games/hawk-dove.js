import { el, header, status, setStatus, toolbar } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Hawk-Dove / Chicken. Payoffs (you, opp):
// HH: -2,-2 (mutual injury); HD: 4, 0; DH: 0, 4; DD: 2, 2
export function hawkDove(shell, { getMode }) {
  const mode = getMode();
  const ROUNDS = mode === 'advanced' ? 24 : 12;
  const par = mode === 'advanced' ? 30 : 14;

  header(shell, {
    title: '🦅 Hawk–Dove (Chicken)',
    tag: `${ROUNDS} rounds · Escalation game`,
    desc: 'Hawk against a Dove takes everything. Two Doves split peacefully. Two Hawks injure each other. Read the opponent and avoid the crash.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(el('span', { class: 'game-tag' }, `Par: ${par}`), restartBtn);

  const s = status(shell);
  const panel = el('div', { class: 'gt-panel' });
  shell.appendChild(panel);

  let myTotal, opTotal, round, history, aiBias;

  function aiMove() {
    // Strategy: adapt — if you escalate often, AI escalates back to deter you.
    const recent = history.slice(-3);
    const myHawks = recent.filter((h) => h.you === 'H').length;
    let p = 0.4 + aiBias + myHawks * 0.1;
    p = Math.max(0.1, Math.min(0.9, p));
    return Math.random() < p ? 'H' : 'D';
  }

  function reset() {
    myTotal = 0; opTotal = 0; round = 0; history = [];
    aiBias = Math.random() * 0.3 - 0.15;
    render();
    setStatus(s, 'Choose Hawk (aggressive) or Dove (peaceful).');
    timers.resetGame();
  }

  function payoff(you, op) {
    if (you === 'H' && op === 'H') return [-2, -2];
    if (you === 'H' && op === 'D') return [4, 0];
    if (you === 'D' && op === 'H') return [0, 4];
    return [2, 2];
  }

  function render() {
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, `Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}`),
      el('div', { class: 'gt-row' }, [
        el('button', { class: 'btn primary', onclick: () => play('H') }, '🦅 Hawk'),
        el('button', { class: 'btn success', onclick: () => play('D') }, '🕊 Dove'),
      ]),
      el('table', { class: 'payoff-table' }, [
        el('tr', {}, [el('th'), el('th'), el('th',{},'Opp Hawk'), el('th',{},'Opp Dove')]),
        el('tr', {}, [el('th',{rowspan:'2'},'You'), el('th',{},'Hawk'), el('td',{},'-2, -2'), el('td',{},'4, 0')]),
        el('tr', {}, [el('th',{},'Dove'), el('td',{},'0, 4'), el('td',{},'2, 2')]),
      ]),
    ]));
    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, 'Score'),
      el('div', { class: 'gt-row' }, [
        el('div', {}, ['You: ', el('span', { class: 'gt-score' }, String(myTotal))]),
        el('div', {}, ['Opp: ', el('span', { class: 'gt-score', style:{color:'#fbbf24'} }, String(opTotal))]),
      ]),
      el('h3', { style: { marginTop: '10px' } }, 'History'),
      (() => {
        const list = el('div', { class: 'history-list' });
        history.forEach((h, idx) => list.appendChild(
          el('div', { class: 'h-row' }, [
            el('span', {}, `R${idx + 1}`),
            el('span', {}, `You: ${h.you}`),
            el('span', {}, `O: ${h.op}`),
            el('span', {}, `${h.you1>=0?'+':''}${h.you1} / ${h.op1>=0?'+':''}${h.op1}`),
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
    else setStatus(s, `R${round}: you ${my}, opp ${op}.`);
    render();
  }

  function finish() {
    timers.stopGame();
    if (myTotal >= par && myTotal >= opTotal) {
      setStatus(s, `Final: You ${myTotal} (par ${par}). Opp ${opTotal}.`, 'good');
      celebrate({
        gameName: 'Hawk–Dove',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `You: <b>${myTotal}</b> vs Opp: <b>${opTotal}</b>`,
      });
    } else {
      setStatus(s, `Final: You ${myTotal}, opp ${opTotal} (par ${par}).`, 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
