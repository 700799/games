import { el, header, status, setStatus, toolbar } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Centipede: pot starts small and grows. On your turn you can Take or Pass.
// If you Pass, the AI gets the same choice with a slightly bigger pot.
// If both keep passing, the pot doubles a fixed number of times, then ends.
export function centipede(shell, { getMode }) {
  const mode = getMode();
  const STEPS = mode === 'advanced' ? 16 : 8;
  // Pot grows: at step k, [taker, other] = [base*(k+1), base*k/2]
  const base = 2;

  header(shell, {
    title: '🐛 Centipede',
    tag: `${STEPS} steps · You & AI alternate`,
    desc: 'On each turn, choose to Take the pot or Pass to the other. Each pass increases the pot. If you take on your turn, you get the bigger share. The game ends at step ' + STEPS + ' with both splitting.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(restartBtn);

  const s = status(shell);
  const card = el('div', { class: 'gt-card' });
  shell.appendChild(card);
  const track = el('div', { class: 'centipede-track' });
  shell.appendChild(track);

  let step, ended, myScore, opScore, history;

  function reset() {
    step = 0; ended = false; myScore = 0; opScore = 0; history = [];
    render();
    setStatus(s, 'Step 1: your turn. Take the pot or Pass?');
    timers.resetGame();
  }

  function potAt(k) { return [(k + 1) * base, Math.max(1, Math.round(k * base / 2))]; }

  function render() {
    card.innerHTML = '';
    const turn = step % 2 === 0 ? 'You' : 'AI';
    const [taker, other] = potAt(step);
    card.appendChild(el('h3', {}, `Step ${step + 1} of ${STEPS}`));
    card.appendChild(el('div', { class: 'game-tag' },
      `Turn: ${turn} · If ${turn} takes now: ${turn === 'You' ? `You +${taker}, AI +${other}` : `AI +${taker}, You +${other}`}`));
    if (!ended && turn === 'You') {
      const row = el('div', { class: 'gt-row', style: { marginTop: '8px' } });
      row.append(
        el('button', { class: 'btn primary', onclick: () => act('take') }, `💰 Take ($${taker})`),
        el('button', { class: 'btn success', onclick: () => act('pass') }, `➡️ Pass`),
      );
      card.appendChild(row);
    } else if (!ended) {
      card.appendChild(el('div', { class: 'game-tag', style: { marginTop: '6px' } }, 'AI deciding…'));
    }
    card.appendChild(el('div', { class: 'gt-row', style: { marginTop: '12px' } }, [
      el('div', {}, ['You: ', el('span', { class: 'gt-score' }, String(myScore))]),
      el('div', {}, ['AI: ', el('span', { class: 'gt-score', style:{color:'#fbbf24'} }, String(opScore))]),
    ]));

    track.innerHTML = '';
    for (let k = 0; k < STEPS; k++) {
      const [t] = potAt(k);
      const cls = 'centipede-step' + (k < step ? ' passed' : '') + (k === step ? ' active' : '');
      track.appendChild(el('div', { class: cls }, String(t)));
    }
  }

  function act(action) {
    if (ended) return;
    const [taker, other] = potAt(step);
    if (action === 'take') {
      myScore += taker; opScore += other;
      history.push({ step: step + 1, who: 'You', action: 'take', myGain: taker, opGain: other });
      end();
      return;
    }
    history.push({ step: step + 1, who: 'You', action: 'pass' });
    step++;
    if (step >= STEPS) { splitFinal(); return; }
    render();
    setTimeout(aiTurn, 700);
  }

  function aiTurn() {
    if (ended) return;
    const [taker, other] = potAt(step);
    // AI: more likely to take as step grows; tiny chance to pass to the end in quick mode
    const takeProb = Math.min(0.9, 0.15 + step * 0.07);
    if (Math.random() < takeProb) {
      opScore += taker; myScore += other;
      history.push({ step: step + 1, who: 'AI', action: 'take', myGain: other, opGain: taker });
      end();
      return;
    }
    history.push({ step: step + 1, who: 'AI', action: 'pass' });
    step++;
    if (step >= STEPS) { splitFinal(); return; }
    render();
    setStatus(s, `Step ${step + 1}: your turn.`);
  }

  function splitFinal() {
    // Both split final pot evenly
    const total = (STEPS + 1) * base;
    const each = Math.floor(total / 2);
    myScore += each; opScore += each;
    history.push({ step: STEPS, who: '—', action: 'split', myGain: each, opGain: each });
    end();
  }

  function end() {
    ended = true;
    timers.stopGame();
    render();
    if (myScore > opScore) {
      setStatus(s, `Game over — You: ${myScore}, AI: ${opScore}.`, 'good');
      celebrate({
        gameName: 'Centipede',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `You: <b>${myScore}</b> vs AI: <b>${opScore}</b>`,
      });
    } else {
      setStatus(s, `Game over — You: ${myScore}, AI: ${opScore}.`, 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
