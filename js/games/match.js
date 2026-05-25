import { el, header, toolbar, status, setStatus, teardownRegistry, shuffle } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';

const SYMBOLS = ['🐶','🐱','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🦄','🐝','🦋','🐢','🐙','🦀','🐬','🦓','🦒','🐘','🦔'];

// Memory Match — heads-up. Quick = You vs Computer; Advanced = pass & play.
export function match(shell, { getMode }) {
  const mode = getMode();
  const vsAI = mode === 'quick';
  const pairs = vsAI ? 8 : 18;
  const cols = vsAI ? 4 : 6;
  const td = teardownRegistry();

  header(shell, {
    title: '🧠 Memory Match',
    tag: vsAI ? `You vs Computer · ${pairs} pairs` : `Pass & play · ${pairs} pairs`,
    desc: 'Flip two cards a turn to find matching pairs. Match and you go again; miss and it’s the other player’s turn. Whoever holds the most pairs when the board is cleared wins.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ New game');
  tb.append(restartBtn);
  const s = status(shell);

  const scoreboard = el('div', { class: 'match-score' });
  shell.appendChild(scoreboard);
  const grid = el('div', { class: 'match-grid', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
  shell.appendChild(grid);

  const NAME = { p1: vsAI ? 'You' : 'Player 1', p2: vsAI ? 'Computer' : 'Player 2' };

  let cards, flipped, scores, turn, lock, aiMem, over;

  function reset() {
    const chosen = shuffle(SYMBOLS).slice(0, pairs);
    cards = shuffle([...chosen, ...chosen]).map((sym) => ({ sym, matched: false }));
    flipped = [];
    scores = { p1: 0, p2: 0 };
    turn = 'p1';
    lock = false;
    over = false;
    aiMem = new Map();
    render();
    setStatus(s, `${NAME[turn]}'s turn.`);
    timers.resetGame();
    if (vsAI && turn === 'p2') scheduleAi();
  }

  function render() {
    scoreboard.innerHTML = '';
    ['p1', 'p2'].forEach((p) => {
      scoreboard.appendChild(el('div', { class: 'match-player' + (turn === p && !over ? ' active' : '') }, [
        el('span', { class: 'mp-name' }, NAME[p]),
        el('span', { class: 'mp-score' }, `${scores[p]} pairs`),
      ]));
    });
    grid.innerHTML = '';
    cards.forEach((card, i) => {
      const isUp = card.matched || flipped.includes(i);
      const cell = el('div', {
        class: 'match-card' + (isUp ? ' up' : '') + (card.matched ? ' matched' : ''),
      }, isUp ? card.sym : '');
      if (!isUp && !lock && !over && (turn === 'p1' || !vsAI)) cell.onclick = () => flip(i);
      grid.appendChild(cell);
    });
  }

  function flip(i) {
    if (lock || over) return;
    if (flipped.includes(i) || cards[i].matched) return;
    flipped.push(i);
    aiMem.set(i, cards[i].sym);
    render();
    if (flipped.length === 2) evaluate();
  }

  function evaluate() {
    lock = true;
    const [a, b] = flipped;
    const isMatch = cards[a].sym === cards[b].sym;
    if (isMatch) {
      const t = setTimeout(() => {
        cards[a].matched = true; cards[b].matched = true;
        scores[turn]++;
        flipped = [];
        lock = false;
        if (cards.every((c) => c.matched)) return finish();
        setStatus(s, `${NAME[turn]} found a pair — go again!`, 'good');
        render();
        if (vsAI && turn === 'p2') scheduleAi();
      }, 600);
      td.add(() => clearTimeout(t));
    } else {
      const t = setTimeout(() => {
        flipped = [];
        lock = false;
        turn = turn === 'p1' ? 'p2' : 'p1';
        setStatus(s, `No match — ${NAME[turn]}'s turn.`);
        render();
        if (vsAI && turn === 'p2') scheduleAi();
      }, 950);
      td.add(() => clearTimeout(t));
    }
  }

  function finish() {
    over = true;
    timers.stopGame();
    render();
    const winner = scores.p1 > scores.p2 ? 'p1' : scores.p2 > scores.p1 ? 'p2' : 'tie';
    if (winner === 'tie') {
      setStatus(s, `It's a tie — ${scores.p1}–${scores.p2}.`, 'warn');
    } else {
      setStatus(s, `${NAME[winner]} win${winner === 'p1' && vsAI ? '' : 's'}! ${scores.p1}–${scores.p2}.`,
        winner === 'p1' || !vsAI ? 'good' : 'bad');
    }
    const playerWon = winner === 'p1' || (winner === 'p2' && !vsAI);
    if (winner !== 'tie' && playerWon) {
      celebrate({
        gameName: 'Memory Match',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `${NAME[winner]} won ${scores[winner]}–${scores[winner === 'p1' ? 'p2' : 'p1']}`,
      });
    }
  }

  // ---- Computer turn (remembers every card it has seen) ----
  function scheduleAi() {
    if (over) return;
    lock = true;
    render();
    const t = setTimeout(aiTurn, 700);
    td.add(() => clearTimeout(t));
  }

  function aiTurn() {
    if (over) return;
    const unmatched = cards.map((c, i) => i).filter((i) => !cards[i].matched);

    // 1) If a known pair exists, exploit it.
    const knownPair = findKnownPair(unmatched);
    if (knownPair) {
      revealThenSecond(knownPair[0], () => knownPair[1]);
      return;
    }
    // 2) Otherwise flip an unknown card; then match it if its symbol is known.
    const unknown = unmatched.filter((i) => !aiMem.has(i));
    const first = unknown.length ? pick(unknown) : pick(unmatched);
    revealThenSecond(first, () => {
      const sym = cards[first].sym;
      const partner = unmatched.find((i) => i !== first && aiMem.get(i) === sym && !cards[i].matched);
      if (partner != null) return partner;
      const others = unmatched.filter((i) => i !== first);
      const stillUnknown = others.filter((i) => !aiMem.has(i));
      return pick(stillUnknown.length ? stillUnknown : others);
    });
  }

  function revealThenSecond(firstIdx, chooseSecond) {
    flipped = [firstIdx];
    aiMem.set(firstIdx, cards[firstIdx].sym);
    lock = true;
    render();
    const t = setTimeout(() => {
      const second = chooseSecond();
      flipped = [firstIdx, second];
      aiMem.set(second, cards[second].sym);
      render();
      evaluate();
    }, 750);
    td.add(() => clearTimeout(t));
  }

  function findKnownPair(unmatched) {
    const bySym = new Map();
    for (const i of unmatched) {
      if (!aiMem.has(i)) continue;
      const sym = aiMem.get(i);
      if (bySym.has(sym)) return [bySym.get(sym), i];
      bySym.set(sym, i);
    }
    return null;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  restartBtn.onclick = reset;
  reset();
  return () => td.run();
}
