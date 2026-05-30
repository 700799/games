import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import { cardLabel, evaluateBest, categoryName, estimateEquity } from '../poker-eval.js';
import { SCENARIOS } from '../data/poker-scenarios.js';

// A heads-up Hold'em decision trainer. Walks through hand-crafted spots and
// reveals the optimal action with full pot-odds / equity reasoning.
export function pokerScenarios(shell, { getMode }) {
  const mode = getMode();
  const NUM = mode === 'advanced' ? SCENARIOS.length : 5;
  const set = SCENARIOS.slice(0, NUM);

  header(shell, {
    title: '🎓 Poker Scenarios',
    tag: `${NUM} heads-up decisions · advisor mode`,
    desc: 'Each scenario presents a real heads-up Hold\'em decision. Pick the action you think is best — then see the correct play with the full pot-odds and equity reasoning. 100 points per correct choice.',
  });

  const tb = toolbar(shell);
  const progSpan = el('span', { class: 'game-tag' });
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(progSpan, restartBtn);

  const s = status(shell);
  const body = el('div', { class: 'scenario-body' });
  shell.appendChild(body);

  let idx, score, correctCount;

  function reset() {
    idx = 0; score = 0; correctCount = 0;
    timers.resetGame();
    show();
  }

  function show() {
    body.innerHTML = '';
    progSpan.textContent = `Scenario ${idx + 1}/${NUM} · Score ${score}`;
    if (idx >= NUM) return finish();
    const sc = set[idx];

    body.appendChild(el('h2', { class: 'sc-title' }, sc.title));
    body.appendChild(el('div', { class: 'sc-meta' }, [
      el('span', { class: 'sc-chip' }, sc.street.toUpperCase()),
      el('span', { class: 'sc-chip' }, `Pos: ${sc.position}`),
      el('span', { class: 'sc-chip' }, `Blinds ${sc.blinds}`),
      el('span', { class: 'sc-chip' }, `Stacks ${sc.stacks.you}/${sc.stacks.opp}`),
    ]));
    body.appendChild(el('div', { class: 'sc-history' }, sc.history));

    // Cards
    const cardsRow = el('div', { class: 'sc-cards' });
    cardsRow.appendChild(el('div', { class: 'sc-label' }, 'Your hand'));
    sc.hole.forEach((c) => cardsRow.appendChild(makeCard(c)));
    if (sc.board.length) {
      cardsRow.appendChild(el('div', { class: 'sc-sep' }, 'Board'));
      sc.board.forEach((c) => cardsRow.appendChild(makeCard(c)));
    }
    body.appendChild(cardsRow);

    // Live numbers (equity vs random for context)
    const eq = Math.round(estimateEquity(sc.hole, sc.board, 220) * 100);
    const odds = sc.toCall > 0 ? Math.round((sc.toCall / (sc.potBefore)) * 100) : null;
    const lines = [
      `Hand: ${describeHand(sc.hole, sc.board)}`,
      `Equity vs. random: ${eq}%`,
      odds != null ? `Pot odds: ${odds}% (call ${sc.toCall} into ${sc.potBefore})` : `No bet to call`,
    ];
    body.appendChild(el('div', { class: 'sc-numbers' },
      lines.map((t) => el('div', {}, t))));

    // Options
    const opts = el('div', { class: 'sc-options' });
    sc.options.forEach((o) => {
      const b = el('button', { class: 'btn' }, o.label);
      b.onclick = () => pick(sc, o.action, b);
      opts.appendChild(b);
    });
    body.appendChild(opts);
  }

  function describeHand(hole, board) {
    if (board.length < 3) {
      const [a, b] = hole;
      if (a.r === b.r) return `Pocket ${nameR(a.r)}s`;
      const sfx = a.s === b.s ? 'suited' : 'offsuit';
      const hi = a.r >= b.r ? a : b, lo = a.r >= b.r ? b : a;
      return `${nameR(hi.r)}-${nameR(lo.r)} ${sfx}`;
    }
    return categoryName(evaluateBest([...hole, ...board]));
  }

  function nameR(r) { return ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J' })[r] || String(r); }

  function pick(sc, action, btn) {
    // Lock buttons
    Array.from(btn.parentElement.children).forEach((b) => { b.disabled = true; b.classList.add('locked'); });
    const ok = action === sc.correct;
    if (ok) {
      score += 100; correctCount++;
      btn.classList.add('right');
      setStatus(s, 'Correct! +100', 'good');
    } else {
      btn.classList.add('wrong');
      const correctBtn = Array.from(btn.parentElement.children)
        .find((b) => b.textContent === sc.options.find((o) => o.action === sc.correct).label);
      if (correctBtn) correctBtn.classList.add('right');
      setStatus(s, 'Not quite. See the explanation.', 'bad');
    }
    // Explanation
    const ex = el('div', { class: 'sc-explain ' + (ok ? 'good' : 'bad') }, [
      el('div', { class: 'sc-explain-tag' }, sc.explanation.tag),
      el('ul', {},
        sc.explanation.points.map((p) => el('li', {}, p))),
    ]);
    const nextBtn = el('button', { class: 'btn primary' }, idx + 1 < NUM ? 'Next scenario →' : 'See results');
    nextBtn.onclick = () => { idx++; show(); };
    ex.appendChild(nextBtn);
    body.appendChild(ex);
    progSpan.textContent = `Scenario ${idx + 1}/${NUM} · Score ${score}`;
  }

  function makeCard(c) {
    const red = c.s === 1 || c.s === 2;
    return el('div', { class: 'pcard' + (red ? ' red' : '') }, cardLabel(c));
  }

  function finish() {
    timers.stopGame();
    const pct = Math.round((correctCount / NUM) * 100);
    body.appendChild(el('div', { class: 'sc-final' }, [
      el('h2', {}, `Round complete — ${correctCount}/${NUM} correct (${pct}%)`),
      el('p', {}, `Score: ${score} points.`),
    ]));
    if (correctCount >= Math.ceil(NUM * 0.6)) {
      setStatus(s, `Solid play — ${correctCount}/${NUM} correct.`, 'good');
      celebrate({
        gameName: 'Poker Scenarios',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `${correctCount}/${NUM} correct · <b>${score}</b> pts`,
      });
    } else {
      setStatus(s, `Tough round — review and try again.`, 'warn');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
