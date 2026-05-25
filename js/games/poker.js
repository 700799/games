import { el, header, toolbar, status, setStatus, teardownRegistry } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import {
  makeDeck, shuffle, cardLabel, evaluateBest, compareScores, categoryName, estimateEquity,
} from '../poker-eval.js';

// Heads-up No-Limit Texas Hold'em vs the computer. Bust the AI to win.
export function poker(shell, { getMode }) {
  const mode = getMode();
  const START = mode === 'advanced' ? 600 : 300;
  const SB = mode === 'advanced' ? 10 : 15;
  const BB = SB * 2;
  const SAMPLES = mode === 'advanced' ? 400 : 160;
  const td = teardownRegistry();

  header(shell, {
    title: '🃏 Heads-Up Poker',
    tag: `Texas Hold'em · blinds ${SB}/${BB} · ${START} chips each`,
    desc: 'No-limit Hold’em against the computer. Make the best five-card hand; out-bet or out-play the AI and take all its chips to win the match.',
  });

  const tb = toolbar(shell);
  const newGameBtn = el('button', { class: 'btn ghost' }, '↺ New match');
  tb.append(newGameBtn);
  const s = status(shell);

  const table = el('div', { class: 'poker-table' });
  shell.appendChild(table);
  const actionsEl = el('div', { class: 'poker-actions' });
  shell.appendChild(actionsEl);

  const G = {};

  function newGame() {
    G.youStack = START; G.aiStack = START;
    G.dealer = Math.random() < 0.5 ? 'you' : 'ai';
    G.gameOver = false;
    timers.resetGame();
    startHand();
  }

  function startHand() {
    G.deck = shuffle(makeDeck());
    G.youHole = [G.deck.pop(), G.deck.pop()];
    G.aiHole = [G.deck.pop(), G.deck.pop()];
    G.board = [];
    G.phase = 'preflop';
    G.inv = { you: 0, ai: 0 };
    G.committed = { you: 0, ai: 0 };
    G.acted = { you: false, ai: false };
    G.streetBet = 0;
    G.revealAi = false;
    G.handMsg = '';
    G.awaiting = false;

    // Heads-up blinds: the dealer/button is the small blind and acts first preflop.
    const sb = G.dealer;
    const bb = other(sb);
    post(sb, SB);
    post(bb, BB);
    G.streetBet = Math.max(G.committed.you, G.committed.ai);
    G.toAct = sb; // button acts first preflop
    render();
    maybeAi();
  }

  function other(p) { return p === 'you' ? 'ai' : 'you'; }
  function stackOf(p) { return p === 'you' ? G.youStack : G.aiStack; }
  function addStack(p, n) { if (p === 'you') G.youStack += n; else G.aiStack += n; }

  function post(p, amt) {
    const pay = Math.min(amt, stackOf(p));
    addStack(p, -pay);
    G.committed[p] += pay;
    G.inv[p] += pay;
  }

  function pot() { return G.inv.you + G.inv.ai; }
  function toCall(p) { return Math.max(0, G.streetBet - G.committed[p]); }

  // ---- Actions ----
  function act(p, kind, raiseTo) {
    if (G.gameOver || G.awaiting) return;
    const need = toCall(p);
    if (kind === 'fold') {
      endHand(other(p), `${label(p)} folds.`);
      return;
    }
    if (kind === 'check') {
      if (need > 0) return; // illegal
      G.acted[p] = true;
    } else if (kind === 'call') {
      const pay = Math.min(need, stackOf(p));
      post(p, pay);
      G.acted[p] = true;
    } else if (kind === 'raise') {
      // raiseTo is the new street bet (total committed this street by p).
      const maxTo = G.committed[p] + stackOf(p);
      let target = Math.min(raiseTo, maxTo);
      if (target <= G.streetBet) target = Math.min(maxTo, G.streetBet + BB); // ensure forward progress
      const pay = target - G.committed[p];
      post(p, pay);
      G.streetBet = G.committed[p];
      G.acted = { you: false, ai: false };
      G.acted[p] = true;
    }
    if (streetClosed()) advanceStreet();
    else { G.toAct = other(p); render(); maybeAi(); }
  }

  // A betting round is complete when bets are level and both have acted, or when
  // a player is all-in and the other has at least matched that (smaller) commit.
  function streetClosed() {
    const yi = G.committed.you, ai = G.committed.ai;
    const youAllIn = G.youStack === 0, aiAllIn = G.aiStack === 0;
    if (youAllIn || aiAllIn) {
      if (yi === ai) return true;
      const smaller = yi < ai ? 'you' : 'ai';
      const smallerAllIn = smaller === 'you' ? youAllIn : aiAllIn;
      const largerActed = smaller === 'you' ? G.acted.ai : G.acted.you;
      return smallerAllIn && largerActed;
    }
    return yi === ai && G.acted.you && G.acted.ai;
  }

  function advanceStreet() {
    // Carry this street into the pot is implicit (inv already tracks totals).
    G.committed = { you: 0, ai: 0 };
    G.acted = { you: false, ai: false };
    G.streetBet = 0;

    // If someone is all-in, run out the board then showdown.
    const allInNow = G.youStack === 0 || G.aiStack === 0;

    if (G.phase === 'preflop') { G.phase = 'flop'; G.board.push(G.deck.pop(), G.deck.pop(), G.deck.pop()); }
    else if (G.phase === 'flop') { G.phase = 'turn'; G.board.push(G.deck.pop()); }
    else if (G.phase === 'turn') { G.phase = 'river'; G.board.push(G.deck.pop()); }
    else if (G.phase === 'river') { return showdown(); }

    if (allInNow) {
      render();
      const t = setTimeout(advanceStreet, 800); // deal next street automatically
      td.add(() => clearTimeout(t));
      return;
    }
    // Postflop: non-dealer (big blind) acts first.
    G.toAct = other(G.dealer);
    render();
    maybeAi();
  }

  function showdown() {
    G.phase = 'showdown';
    G.revealAi = true;
    const youScore = evaluateBest([...G.youHole, ...G.board]);
    const aiScore = evaluateBest([...G.aiHole, ...G.board]);
    const cmp = compareScores(youScore, aiScore);
    let winner = cmp > 0 ? 'you' : cmp < 0 ? 'ai' : 'split';
    const msg = `You: ${categoryName(youScore)} · AI: ${categoryName(aiScore)}.`;
    settle(winner, msg);
  }

  // Award the contested pot (and refund any uncalled all-in overage).
  function settle(winner, msg) {
    const matched = Math.min(G.inv.you, G.inv.ai);
    // refund overage to whoever put in more
    if (G.inv.you > matched) addStack('you', G.inv.you - matched);
    if (G.inv.ai > matched) addStack('ai', G.inv.ai - matched);
    const contested = 2 * matched;
    if (winner === 'split') { addStack('you', contested / 2); addStack('ai', contested / 2); }
    else addStack(winner, contested);
    const tail = winner === 'split' ? 'Split pot.' : `${label(winner)} win${winner === 'you' ? '' : 's'} ${contested} chips.`;
    finishHand(`${msg} ${tail}`);
  }

  function endHand(winner, msg) {
    // Uncontested (a fold): winner takes the pot.
    const matched = Math.min(G.inv.you, G.inv.ai);
    if (G.inv.you > matched) addStack('you', G.inv.you - matched);
    if (G.inv.ai > matched) addStack('ai', G.inv.ai - matched);
    addStack(winner, 2 * matched);
    finishHand(msg);
  }

  function finishHand(msg) {
    G.handMsg = msg;
    G.awaiting = true;
    render();
    if (G.youStack <= 0 || G.aiStack <= 0) {
      G.gameOver = true;
      const youWon = G.aiStack <= 0;
      timers.stopGame();
      setStatus(s, youWon ? 'You took every chip — match won!' : 'You’re out of chips. Match over.', youWon ? 'good' : 'bad');
      render();
      if (youWon) {
        celebrate({
          gameName: 'Heads-Up Poker',
          gameTimeMs: timers.getGameElapsed(),
          totalTimeMs: timers.getTotalElapsed(),
          extra: 'Busted the computer!',
        });
      }
      return;
    }
    setStatus(s, msg);
  }

  function nextHand() {
    G.dealer = other(G.dealer);
    startHand();
  }

  // ---- AI ----
  function maybeAi() {
    if (G.gameOver || G.awaiting) return;
    if (G.toAct !== 'ai') return;
    G.awaiting = true;
    render();
    const t = setTimeout(() => { G.awaiting = false; aiDecide(); }, 650);
    td.add(() => clearTimeout(t));
  }

  function aiDecide() {
    const eq = estimateEquity(G.aiHole, G.board, SAMPLES);
    const need = toCall('ai');
    const p = pot();
    const r = Math.random();
    if (need === 0) {
      // Option to check or bet.
      if (eq > 0.62 || (eq > 0.5 && r < 0.4)) {
        act('ai', 'raise', G.streetBet + Math.max(BB, Math.round(p * (eq > 0.8 ? 0.9 : 0.6))));
      } else act('ai', 'check');
    } else {
      const potOdds = need / (p + need);
      if (eq > 0.78 && r < 0.55) {
        act('ai', 'raise', G.streetBet + Math.max(BB, Math.round((p + need) * 0.8)));
      } else if (eq > potOdds + 0.03) {
        act('ai', 'call');
      } else if (r < 0.06) {
        act('ai', 'call'); // occasional loose call
      } else {
        act('ai', 'fold');
      }
    }
  }

  function label(p) { return p === 'you' ? 'You' : 'AI'; }

  // ---- Render ----
  function cardEl(c, hidden) {
    if (hidden) return el('div', { class: 'pcard back' }, '🂠');
    const red = c.s === 1 || c.s === 2;
    return el('div', { class: 'pcard' + (red ? ' red' : '') }, cardLabel(c));
  }

  function seat(name, stack, hole, hideHole, isDealer, active) {
    return el('div', { class: 'poker-seat' + (active ? ' active' : '') }, [
      el('div', { class: 'seat-head' }, [
        el('span', { class: 'seat-name' }, `${name}${isDealer ? ' 🔘' : ''}`),
        el('span', { class: 'seat-stack' }, `${stack} chips`),
      ]),
      el('div', { class: 'phand' }, hole.map((c) => cardEl(c, hideHole))),
    ]);
  }

  function render() {
    table.innerHTML = '';
    table.appendChild(seat('AI', G.aiStack, G.aiHole, !G.revealAi, G.dealer === 'ai', G.toAct === 'ai' && !G.awaiting));
    const mid = el('div', { class: 'poker-mid' }, [
      el('div', { class: 'pot' }, `Pot: ${pot()}`),
      el('div', { class: 'pboard' }, G.board.map((c) => cardEl(c, false))),
      el('div', { class: 'phase-tag' }, G.handMsg || G.phase.toUpperCase()),
    ]);
    table.appendChild(mid);
    table.appendChild(seat('You', G.youStack, G.youHole, false, G.dealer === 'you', G.toAct === 'you' && !G.awaiting));
    renderActions();
  }

  function renderActions() {
    actionsEl.innerHTML = '';
    if (G.gameOver) return;
    if (G.awaiting && G.toAct === 'ai') {
      actionsEl.appendChild(el('span', { class: 'game-tag' }, 'AI is thinking…'));
      return;
    }
    if (G.handMsg && G.awaiting) {
      const next = el('button', { class: 'btn primary' }, 'Next hand →');
      next.onclick = nextHand;
      actionsEl.appendChild(next);
      return;
    }
    if (G.toAct !== 'you') return;
    const need = toCall('you');
    const p = pot();
    if (need === 0) {
      add('Check', 'btn ghost', () => act('you', 'check'));
      const betAmt = Math.max(BB, Math.round(p * 0.6));
      add(`Bet ${Math.min(betAmt, G.youStack)}`, 'btn', () => act('you', 'raise', G.streetBet + betAmt));
    } else {
      add('Fold', 'btn ghost', () => act('you', 'fold'));
      add(`Call ${Math.min(need, G.youStack)}`, 'btn', () => act('you', 'call'));
      const raiseAmt = Math.max(BB, Math.round((p + need) * 0.8));
      if (G.youStack > need) add(`Raise ${raiseAmt}`, 'btn warn', () => act('you', 'raise', G.streetBet + raiseAmt));
    }
    add(`All-in ${G.youStack}`, 'btn primary', () => act('you', 'raise', G.committed.you + G.youStack));
  }

  function add(text, cls, fn) {
    const b = el('button', { class: cls }, text);
    b.onclick = fn;
    actionsEl.appendChild(b);
  }

  newGameBtn.onclick = newGame;
  newGame();
  setStatus(s, 'Bust the computer to win the match. Good luck!');

  return () => td.run();
}
