import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Iterated Prisoner's Dilemma. Payoffs (Years saved):
// Both C: 3,3 ; You C, AI D: 0,5 ; You D, AI C: 5,0 ; Both D: 1,1
// Higher is better (years out of prison).
export function prisoner(shell, { getMode }) {
  const mode = getMode();
  const ROUNDS = mode === 'advanced' ? 30 : 12;
  // Opponents: tit-for-tat (quick) or rotating strategies (advanced)
  const OPPS = mode === 'advanced'
    ? ['titForTat', 'grudge', 'random', 'pavlov']
    : ['titForTat'];
  const oppName = OPPS[Math.floor(Math.random() * OPPS.length)];

  header(shell, {
    title: "🤝 Prisoner's Dilemma",
    tag: `${ROUNDS} rounds · Opponent: ${oppName}`,
    desc: 'Each round, choose to Cooperate or Defect. Mutual cooperation pays well; defecting against a cooperator pays best (for you alone); mutual defection pays least. Goal: end with a higher total than the opponent OR beat the par score.',
  });

  // Payoff: [you, opp]
  const PAYOFF = {
    CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1],
  };

  const par = Math.round(ROUNDS * 2.6); // a generous "good play" benchmark

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(el('span', { class: 'game-tag' }, `Beat the AI or reach ${par} points`), restartBtn);

  const s = status(shell);
  const panel = el('div', { class: 'gt-panel' });
  shell.appendChild(panel);

  let myTotal, opTotal, round, history;

  function reset() {
    myTotal = 0; opTotal = 0; round = 0; history = [];
    render();
    setStatus(s, `Round 1 of ${ROUNDS}. Choose your move.`);
    timers.resetGame();
  }

  function aiMove() {
    if (history.length === 0) return 'C';
    switch (oppName) {
      case 'titForTat':
        return history[history.length - 1].you;
      case 'grudge':
        return history.some((h) => h.you === 'D') ? 'D' : 'C';
      case 'random':
        return Math.random() < 0.5 ? 'C' : 'D';
      case 'pavlov': {
        const last = history[history.length - 1];
        const prev = last.youMove === last.opMove ? last.opMove : (last.opMove === 'C' ? 'D' : 'C');
        return prev;
      }
      default: return 'C';
    }
  }

  function render() {
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, `Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}`),
      el('div', { class: 'gt-row' }, [
        el('button', { class: 'btn success', onclick: () => play('C') }, '🤝 Cooperate'),
        el('button', { class: 'btn primary', onclick: () => play('D') }, '⚔️ Defect'),
      ]),
      el('table', { class: 'payoff-table' }, [
        el('tr', {}, [el('th'), el('th'), el('th',{}, 'AI: C'), el('th',{},'AI: D')]),
        el('tr', {}, [el('th',{rowspan:'2'},'You'), el('th',{},'C'), el('td',{},'3, 3'), el('td',{},'0, 5')]),
        el('tr', {}, [el('th',{},'D'), el('td',{},'5, 0'), el('td',{},'1, 1')]),
      ]),
    ]));
    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, 'Score'),
      el('div', { class: 'gt-row' }, [
        el('div', {}, ['You: ', el('span', { class: 'gt-score' }, String(myTotal))]),
        el('div', {}, ['AI: ', el('span', { class: 'gt-score', style:{color:'#fbbf24'} }, String(opTotal))]),
      ]),
      el('h3', { style: { marginTop: '10px' } }, 'History'),
      historyView(),
    ]));
  }

  function historyView() {
    const list = el('div', { class: 'history-list' });
    history.forEach((h, idx) => {
      list.appendChild(el('div', { class: 'h-row' }, [
        el('span', {}, `R${idx + 1}`),
        el('span', {}, `You: ${h.you === 'C' ? 'C' : 'D'}`),
        el('span', {}, `AI: ${h.op === 'C' ? 'C' : 'D'}`),
        el('span', {}, `+${h.youGain} / +${h.opGain}`),
      ]));
    });
    return list;
  }

  function play(myMove) {
    if (round >= ROUNDS) return;
    const op = aiMove();
    const [me, them] = PAYOFF[myMove + op];
    myTotal += me; opTotal += them;
    history.push({ you: myMove, op, youGain: me, opGain: them, youMove: myMove, opMove: op });
    round++;
    if (round >= ROUNDS) {
      finish();
    } else {
      setStatus(s, `R${round}: you ${myMove}, AI ${op}. Score ${myTotal} vs ${opTotal}.`);
    }
    render();
  }

  function finish() {
    timers.stopGame();
    const won = myTotal >= opTotal && myTotal >= par;
    const tied = myTotal === opTotal && myTotal >= par;
    if (won) {
      setStatus(s,
        `Final: You ${myTotal}, AI ${opTotal}. ${tied ? 'Tied' : 'Beat AI'} and hit par (${par}).`,
        'good');
      celebrate({
        gameName: "Prisoner's Dilemma",
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `You: <b>${myTotal}</b> vs AI: <b>${opTotal}</b>`,
      });
    } else {
      setStatus(s,
        `Final: You ${myTotal}, AI ${opTotal}. Par ${par}. Try again — cooperation often pays.`,
        'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
