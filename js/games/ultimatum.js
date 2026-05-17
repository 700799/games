import { el, header, status, setStatus, toolbar } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

// Ultimatum game: you alternate proposer & responder against an AI.
// As proposer you choose a split; responder accepts or rejects.
// If rejected, both get 0 that round.
export function ultimatum(shell, { getMode }) {
  const mode = getMode();
  const ROUNDS = mode === 'advanced' ? 12 : 6;
  const POT = 100;
  const par = mode === 'advanced' ? 360 : 180; // total $ earned target

  header(shell, {
    title: '💰 Ultimatum',
    tag: `${ROUNDS} rounds · Pot $${POT} each`,
    desc: 'Each round one of you proposes a split of $100; the other accepts (both keep their share) or rejects (both get $0). Maximize your earnings across the game.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ Restart');
  tb.append(el('span', { class: 'game-tag' }, `Earn ≥ $${par}`), restartBtn);

  const s = status(shell);
  const panel = el('div', { class: 'gt-panel' });
  shell.appendChild(panel);

  let myMoney, opMoney, round, history, aiThreshold;

  function reset() {
    myMoney = 0; opMoney = 0; round = 0; history = [];
    aiThreshold = mode === 'advanced' ? 30 + Math.floor(Math.random() * 15) : 25;
    render();
    setStatus(s, `Earn $${par} total to win. The AI's fairness threshold is hidden.`);
    timers.resetGame();
  }

  function render() {
    panel.innerHTML = '';
    const proposer = round % 2 === 0 ? 'P' : 'A'; // alternate
    const proposerName = proposer === 'P' ? 'You' : 'AI';

    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, `Round ${Math.min(round + 1, ROUNDS)} / ${ROUNDS}`),
      el('div', { class: 'game-tag' }, `Proposer: ${proposerName}`),
      proposer === 'P' ? proposeUI() : respondUI(),
    ]));

    panel.appendChild(el('div', { class: 'gt-card' }, [
      el('h3', {}, 'Earnings'),
      el('div', { class: 'gt-row' }, [
        el('div', {}, ['You: ', el('span', { class: 'gt-score' }, '$' + myMoney)]),
        el('div', {}, ['AI: ', el('span', { class: 'gt-score', style:{color:'#fbbf24'} }, '$' + opMoney)]),
      ]),
      el('h3', { style: { marginTop: '10px' } }, 'History'),
      (() => {
        const list = el('div', { class: 'history-list' });
        history.forEach((h, idx) => list.appendChild(
          el('div', { class: 'h-row' }, [
            el('span', {}, `R${idx + 1}`),
            el('span', {}, `${h.proposer}: $${h.offer}`),
            el('span', {}, h.accepted ? `✓ +$${h.youGain} / +$${h.opGain}` : '✗ rejected ($0)'),
          ])
        ));
        return list;
      })(),
    ]));
  }

  function proposeUI() {
    const input = el('input', { type: 'number', min: '0', max: String(POT), value: '50' });
    return el('div', { class: 'gt-row' }, [
      el('label', {}, ['Offer AI: $', input, ` (keep $${POT})`]),
      el('button', { class: 'btn primary', onclick: () => {
        const offer = Math.max(0, Math.min(POT, parseInt(input.value, 10) || 0));
        propose(offer);
      }}, 'Propose'),
    ]);
  }

  function respondUI() {
    // AI offer based on hidden threshold + noise
    const offerToYou = Math.max(5, Math.min(POT - 5,
      Math.round((aiThreshold + 5) + (Math.random() * 10 - 5))));
    const offerKept = POT - offerToYou;
    return el('div', { class: 'gt-row' }, [
      el('div', {}, `AI offers you $${offerToYou}, keeps $${offerKept}.`),
      el('button', { class: 'btn success', onclick: () => respond(offerToYou, true) }, '✓ Accept'),
      el('button', { class: 'btn primary', onclick: () => respond(offerToYou, false) }, '✗ Reject'),
    ]);
  }

  function propose(offer) {
    if (round >= ROUNDS) return;
    const accepted = offer >= aiThreshold;
    if (accepted) {
      myMoney += POT - offer; opMoney += offer;
    }
    history.push({ proposer: 'You', offer, accepted, youGain: accepted ? POT - offer : 0, opGain: accepted ? offer : 0 });
    setStatus(s, accepted ? `AI accepted $${offer}.` : `AI rejected $${offer} (threshold not met).`,
      accepted ? 'good' : 'bad');
    advance();
  }

  function respond(offerToYou, accept) {
    if (round >= ROUNDS) return;
    const opOffer = POT - offerToYou;
    if (accept) { myMoney += offerToYou; opMoney += opOffer; }
    history.push({ proposer: 'AI', offer: opOffer, accepted: accept,
      youGain: accept ? offerToYou : 0, opGain: accept ? opOffer : 0 });
    setStatus(s, accept ? `Accepted offer of $${offerToYou}.` : `Rejected — both get $0.`,
      accept ? 'good' : 'warn');
    advance();
  }

  function advance() {
    round++;
    if (round >= ROUNDS) finish();
    render();
  }

  function finish() {
    timers.stopGame();
    if (myMoney >= par && myMoney >= opMoney) {
      setStatus(s, `Final: You $${myMoney}, AI $${opMoney}. Par $${par}.`, 'good');
      celebrate({
        gameName: 'Ultimatum',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `You: <b>$${myMoney}</b> vs AI: <b>$${opMoney}</b>`,
      });
    } else {
      setStatus(s, `Final: You $${myMoney}, AI $${opMoney}. Par $${par}.`, 'bad');
    }
  }

  restartBtn.onclick = reset;
  reset();
  return () => {};
}
