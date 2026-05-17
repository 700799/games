import { el, header, status, setStatus, toolbar } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Public Goods Game: each round you and N-1 AIs receive 10 tokens.
// Each chooses a contribution 0..10. Pool is multiplied by R and split evenly.
// Free-riding is tempting but lowers total.
export function publicGoods(shell, { getMode }) {
  const mode = getMode();
  const ROUNDS = mode === 'advanced' ? 12 : 6;
  const N = mode === 'advanced' ? 5 : 3;
  const R = 1.8;
  const ENDOWMENT = 10;
  const par = mode === 'advanced' ? 130 : 60;

  header(shell, {
    title: '🏛️ Public Goods',
    tag: `${N} players · ${ROUNDS} rounds · multiplier ${R}`,
    desc: `Each round everyone gets ${ENDOWMENT} tokens. Decide how many to contribute. The pool is multiplied by ${R} and split evenly. Free-riding maximizes your share but tanks the group.`,
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(el('span', { class: 'game-tag' }, `Earn ≥ ${par} tokens`), restartBtn);

  const s = status(shell);
  const card = el('div', { class: 'gt-card' });
  shell.appendChild(card);

  let round, myTokens, history;
  // AI personalities: each has baseline + reactivity
  let bots;

  function makeBots() {
    const archetypes = [
      { name: 'Altruist', base: 8, react: 0.2 },
      { name: 'Conformist', base: 5, react: 0.8 },
      { name: 'Free Rider', base: 1, react: 0.3 },
      { name: 'Strategist', base: 6, react: 0.6 },
      { name: 'Wildcard', base: 4, react: 1.2 },
    ];
    return archetypes.slice(0, N - 1);
  }

  function reset() {
    round = 0; myTokens = 0; history = [];
    bots = makeBots();
    render();
    setStatus(s, `Contribute 0–${ENDOWMENT}. The pool gets multiplied by ${R} and split.`);
    timers.resetGame();
  }

  function avgPrev() {
    if (history.length === 0) return ENDOWMENT / 2;
    const last = history[history.length - 1];
    return last.contributions.reduce((a, b) => a + b, 0) / last.contributions.length;
  }

  function botContribute(bot) {
    const target = bot.base + (avgPrev() - 5) * bot.react * 0.4;
    return Math.max(0, Math.min(ENDOWMENT, Math.round(target)));
  }

  function render() {
    card.innerHTML = '';
    card.appendChild(el('h3', {}, `Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}`));
    const input = el('input', { type: 'number', min: '0', max: String(ENDOWMENT), value: '5' });
    if (round < ROUNDS) {
      const row = el('div', { class: 'gt-row' }, [
        el('label', {}, ['Your contribution (0–', String(ENDOWMENT), '):']),
        input,
        el('button', { class: 'btn primary', onclick: () => contribute(parseInt(input.value, 10) || 0) }, 'Submit'),
      ]);
      card.appendChild(row);
    }
    card.appendChild(el('div', { class: 'gt-row', style: { marginTop: '10px' } }, [
      el('div', {}, ['Your tokens: ', el('span', { class: 'gt-score' }, String(myTokens))]),
    ]));
    card.appendChild(el('h3', { style: { marginTop: '10px' } }, 'History'));
    const list = el('div', { class: 'history-list' });
    history.forEach((h, idx) => list.appendChild(el('div', { class: 'h-row' }, [
      el('span', {}, `R${idx + 1}`),
      el('span', {}, `Pool ${h.pool.toFixed(0)}`),
      el('span', {}, `Share ${h.share.toFixed(1)}`),
      el('span', {}, `You +${h.youGain.toFixed(1)}`),
      el('span', {}, h.contributions.map((c) => c).join(',')),
    ])));
    card.appendChild(list);
  }

  function contribute(myC) {
    if (round >= ROUNDS) return;
    myC = Math.max(0, Math.min(ENDOWMENT, myC));
    const contributions = [myC, ...bots.map(botContribute)];
    const pool = contributions.reduce((a, b) => a + b, 0) * R;
    const share = pool / contributions.length;
    const youGain = (ENDOWMENT - myC) + share;
    myTokens += youGain;
    history.push({ contributions, pool, share, youGain });
    round++;
    if (round >= ROUNDS) finish();
    else setStatus(s, `Round ${round}: contributed ${myC}, gained ${youGain.toFixed(1)}.`);
    render();
  }

  function finish() {
    timers.stopGame();
    const total = Math.round(myTokens);
    if (total >= par) {
      setStatus(s, `Final tokens: ${total} (par ${par}).`, 'good');
      celebrate({
        gameName: 'Public Goods',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Total: <b>${total}</b> tokens`,
      });
    } else {
      setStatus(s, `Final tokens: ${total} (par ${par}). Try cooperating earlier.`, 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
