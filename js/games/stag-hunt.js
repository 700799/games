import { el, header, status, setStatus, toolbar } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Stag Hunt — payoffs (you, opp): SS=4,4 ; SH=0,3 ; HS=3,0 ; HH=2,2
// Hunting stag together is most rewarding; hunting hare is safe but solitary.
export function stagHunt(shell, { getMode }) {
  const mode = getMode();
  const ROUNDS = mode === 'advanced' ? 24 : 10;
  const par = mode === 'advanced' ? 70 : 30;

  header(shell, {
    title: '🦌 Stag Hunt',
    tag: `${ROUNDS} rounds · Coordination game`,
    desc: 'Stag pays best when both choose it, but if your partner chickens out you get nothing. Hare is the safe bet. Read the partner and earn more than par.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(el('span', { class: 'game-tag' }, `Par: ${par}`), restartBtn);

  const s = status(shell);
  const panel = el('div', { class: 'gt-panel' });
  shell.appendChild(panel);

  let myTotal, opTotal, round, history;
  // AI strategy: trust-builder — starts at 50/50, increases Stag prob after coordination
  let trust;

  function aiMove() {
    return Math.random() < trust ? 'S' : 'H';
  }

  function reset() {
    myTotal = 0; opTotal = 0; round = 0; history = []; trust = 0.5;
    render();
    setStatus(s, 'Choose Stag (cooperate) or Hare (safe).');
    timers.resetGame();
  }

  function payoff(you, op) {
    if (you === 'S' && op === 'S') return [4, 4];
    if (you === 'S' && op === 'H') return [0, 3];
    if (you === 'H' && op === 'S') return [3, 0];
    return [2, 2];
  }

  function render() {
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, `Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}`),
      el('div', { class: 'gt-row' }, [
        el('button', { class: 'btn success', onclick: () => play('S') }, '🦌 Hunt Stag'),
        el('button', { class: 'btn warn', onclick: () => play('H') }, '🐇 Hunt Hare'),
      ]),
      el('table', { class: 'payoff-table' }, [
        el('tr', {}, [el('th'), el('th'), el('th',{},'Partner Stag'), el('th',{},'Partner Hare')]),
        el('tr', {}, [el('th',{rowspan:'2'},'You'), el('th',{},'Stag'), el('td',{},'4, 4'), el('td',{},'0, 3')]),
        el('tr', {}, [el('th',{},'Hare'), el('td',{},'3, 0'), el('td',{},'2, 2')]),
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
    // Update trust:
    if (my === 'S' && op === 'S') trust = Math.min(0.95, trust + 0.1);
    else if (my === 'H' && op === 'S') trust = Math.max(0.1, trust - 0.2);
    else if (my === 'S' && op === 'H') trust = Math.min(0.9, trust + 0.05);
    round++;
    if (round >= ROUNDS) finish();
    else setStatus(s, `R${round}: you ${my}, partner ${op}. Score ${myTotal} vs ${opTotal}.`);
    render();
  }

  function finish() {
    timers.stopGame();
    if (myTotal >= par) {
      setStatus(s, `Final: You ${myTotal} (par ${par}). Partner ${opTotal}.`, 'good');
      celebrate({
        gameName: 'Stag Hunt',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `You: <b>${myTotal}</b> vs Partner: <b>${opTotal}</b>`,
      });
    } else {
      setStatus(s, `Final: You ${myTotal} of par ${par}. Partner ${opTotal}. Try again — coordinate more!`, 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
