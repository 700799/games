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
    desc: 'No-limit Hold’em against the computer with a built-in poker advisor. You see live equity vs. a random hand, pot odds, and a recommended action with the EV reasoning behind it. Bust the AI to win the match.',
  });

  const tb = toolbar(shell);
  const newGameBtn = el('button', { class: 'btn ghost' }, '↺ New match');
  const advisorToggle = el('button', { class: 'btn ghost' }, '📊 Advisor on');
  tb.append(advisorToggle, newGameBtn);
  const s = status(shell);

  const table = el('div', { class: 'poker-table' });
  shell.appendChild(table);
  const advisorEl = el('div', { class: 'poker-advisor' });
  shell.appendChild(advisorEl);
  const actionsEl = el('div', { class: 'poker-actions' });
  shell.appendChild(actionsEl);
  const statsEl = el('div', { class: 'poker-stats' });
  shell.appendChild(statsEl);

  const G = { advisor: true };

  function newGame() {
    G.youStack = START; G.aiStack = START;
    G.dealer = Math.random() < 0.5 ? 'you' : 'ai';
    G.gameOver = false;
    G.stats = { hands: 0, youWins: 0, aiWins: 0, splits: 0, biggest: 0, log: [] };
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
    recomputeEquity();
    render();
    maybeAi();
  }

  // Re-run a Monte-Carlo equity estimate for the human's hand vs. a random one.
  // Cached until the next street, since cards don't change mid-street.
  function recomputeEquity() {
    if (G.youHole && !G.gameOver) G.equity = estimateEquity(G.youHole, G.board, SAMPLES);
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

    recomputeEquity();

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
    logHand(msg);
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
    renderAdvisor();
    renderActions();
    renderStats();
  }

  // ---- Hand naming + advisor ----
  const RANK_NAME = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack' };
  function rname(r) { return RANK_NAME[r] || String(r); }

  function preflopName(hole) {
    if (!hole || hole.length !== 2) return '';
    const [a, b] = hole;
    const hi = a.r >= b.r ? a : b, lo = a.r >= b.r ? b : a;
    if (hi.r === lo.r) return `Pocket ${rname(hi.r)}s`;
    const sfx = hi.s === lo.s ? 'suited' : 'offsuit';
    return `${rname(hi.r)}-${rname(lo.r)} ${sfx}`;
  }

  function handLabel(hole, board) {
    if (!hole) return '';
    if (board.length === 0) return preflopName(hole);
    const score = evaluateBest([...hole, ...board]);
    const cat = categoryName(score);
    // Add a brief tiebreaker for pairs/trips
    if (score[0] === 1 || score[0] === 3 || score[0] === 7) return `${cat} (${rname(score[1])}s)`;
    if (score[0] === 2) return `Two Pair (${rname(score[1])}s & ${rname(score[2])}s)`;
    if (score[0] === 6) return `Full House (${rname(score[1])}s over ${rname(score[2])}s)`;
    return cat;
  }

  // Returns { tag, tone:'good'|'warn'|'bad', reason, tip }
  function recommendAction() {
    const eq = G.equity ?? 0.5;
    const need = toCall('you');
    const p = pot();
    const eqPct = Math.round(eq * 100);
    if (need === 0) {
      if (eq > 0.65) return {
        tag: 'Bet for value',
        tone: 'good',
        reason: `Equity ${eqPct}% is strong — bet to build the pot while you’re ahead.`,
        tip: eq > 0.80 ? 'Size up — pot-sized or larger. Worse hands can still pay.' : 'A roughly half-pot value bet is usually best.',
      };
      if (eq > 0.45) return {
        tag: 'Check (pot control)',
        tone: 'warn',
        reason: `Equity ${eqPct}% is marginal — checking keeps the pot small in case you’re behind.`,
        tip: 'You can still call most reasonable bets later if you keep showdown value.',
      };
      return {
        tag: 'Check',
        tone: 'bad',
        reason: `Equity ${eqPct}% is weak. Check and look to fold to pressure unless you improve.`,
        tip: 'If your opponent bets large, your hand likely can’t continue.',
      };
    }
    const odds = need / (p + need);
    const oddsPct = Math.round(odds * 100);
    const diff = eq - odds;
    const diffPct = Math.round(diff * 100);
    if (diff > 0.08) {
      const raisable = eq > 0.75;
      return {
        tag: raisable ? 'Raise for value' : 'Call (+EV)',
        tone: 'good',
        reason: `Your ${eqPct}% equity beats the ${oddsPct}% pot odds by ${diffPct}pp.`,
        tip: raisable
          ? `You’re strong enough to raise: about a pot-sized raise extracts more value.`
          : `Calling realises equity. Note pot odds tell you how often you need to win.`,
      };
    }
    if (diff > -0.03) return {
      tag: 'Borderline',
      tone: 'warn',
      reason: `Equity ${eqPct}% ≈ pot odds ${oddsPct}% (${diffPct}pp). A close call.`,
      tip: 'Lean on reads and implied odds. If you have outs to a big hand, call; otherwise fold.',
    };
    return {
      tag: 'Fold (-EV)',
      tone: 'bad',
      reason: `Equity ${eqPct}% is below the ${oddsPct}% pot odds (${diffPct}pp).`,
      tip: 'A call on average loses money. Save chips for stronger spots.',
    };
  }

  function renderAdvisor() {
    advisorEl.innerHTML = '';
    if (!G.advisor || G.gameOver) return;
    if (!G.youHole) return;
    const eq = G.equity ?? 0.5;
    const pct = Math.round(eq * 100);
    const need = toCall('you');
    const odds = need > 0 ? Math.round((need / (pot() + need)) * 100) : null;
    const handStr = handLabel(G.youHole, G.board);
    const rec = recommendAction();
    advisorEl.appendChild(el('div', { class: 'adv-row' }, [
      el('span', { class: 'adv-key' }, 'Your hand'),
      el('span', { class: 'adv-val' }, handStr),
    ]));
    const bar = el('div', { class: 'adv-bar' }, [
      el('div', { class: 'adv-bar-fill', style: { width: `${pct}%` } }),
    ]);
    advisorEl.appendChild(el('div', { class: 'adv-row' }, [
      el('span', { class: 'adv-key' }, 'Equity vs random'),
      el('span', { class: 'adv-val' }, `${pct}%`),
      bar,
    ]));
    if (odds != null) {
      advisorEl.appendChild(el('div', { class: 'adv-row' }, [
        el('span', { class: 'adv-key' }, 'Pot odds'),
        el('span', { class: 'adv-val' }, `${odds}% (call ${need} into ${pot()})`),
      ]));
    }
    advisorEl.appendChild(el('div', { class: `adv-reco ${rec.tone}` }, [
      el('div', { class: 'adv-reco-tag' }, `Recommendation: ${rec.tag}`),
      el('div', { class: 'adv-reco-reason' }, rec.reason),
      el('div', { class: 'adv-reco-tip' }, rec.tip),
    ]));
  }

  function logHand(msg) {
    if (!G.stats) return;
    G.stats.hands++;
    const potThis = G.inv.you + G.inv.ai;
    if (potThis > G.stats.biggest) G.stats.biggest = potThis;
    // Determine winner from message keywords (cheap but reliable enough)
    if (msg.includes('You win') || msg.includes('AI folds')) G.stats.youWins++;
    else if (msg.includes('AI win') || msg.includes('You fold')) G.stats.aiWins++;
    else if (msg.includes('Split')) G.stats.splits++;
    G.stats.log.unshift({ n: G.stats.hands, msg, pot: potThis });
    if (G.stats.log.length > 6) G.stats.log.length = 6;
  }

  function renderStats() {
    statsEl.innerHTML = '';
    if (!G.stats) return;
    statsEl.appendChild(el('h3', {}, 'Match stats'));
    statsEl.appendChild(el('div', { class: 'stats-row' }, [
      el('span', {}, `Hands: ${G.stats.hands}`),
      el('span', {}, `You: ${G.stats.youWins}W`),
      el('span', {}, `AI: ${G.stats.aiWins}W`),
      G.stats.splits ? el('span', {}, `Split: ${G.stats.splits}`) : null,
      el('span', {}, `Biggest pot: ${G.stats.biggest}`),
    ]));
    if (G.stats.log.length) {
      statsEl.appendChild(el('div', { class: 'stats-log' },
        G.stats.log.map((e) => el('div', { class: 'stats-log-row' }, `#${e.n} · ${e.msg}`))));
    }
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
  advisorToggle.onclick = () => {
    G.advisor = !G.advisor;
    advisorToggle.textContent = G.advisor ? '📊 Advisor on' : '📊 Advisor off';
    render();
  };
  newGame();
  setStatus(s, 'Bust the computer to win the match. Good luck!');

  return () => td.run();
}
