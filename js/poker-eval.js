// Pure poker hand evaluation (no DOM) so it can be unit-tested.
// Cards are { r, s }: r = rank 2..14 (11=J,12=Q,13=K,14=A), s = suit 0..3.

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(r) { return RANKS[r] || String(r); }
export function cardLabel(c) { return rankLabel(c.r) + SUITS[c.s]; }

export function makeDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  return deck;
}

export function shuffle(deck, rand = Math.random) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
];

// Evaluate exactly 5 cards → comparable score array [category, ...tiebreakers].
function evaluate5(cards) {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const suits = cards.map((c) => c.s);
  const isFlush = suits.every((s) => s === suits[0]);

  // Count by rank
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  // Sort distinct ranks by (count desc, rank desc)
  const byCount = Object.keys(counts).map(Number).sort((a, b) =>
    counts[b] - counts[a] || b - a);
  const countPattern = byCount.map((r) => counts[r]); // e.g. [4,1], [3,2], [2,2,1]

  // Straight detection (with wheel A-2-3-4-5)
  const distinct = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (distinct.length === 5) {
    if (distinct[0] - distinct[4] === 4) straightHigh = distinct[0];
    else if (distinct[0] === 14 && distinct[1] === 5 && distinct[4] === 2) straightHigh = 5; // wheel
  }

  if (isFlush && straightHigh) return [8, straightHigh];
  if (countPattern[0] === 4) return [7, byCount[0], byCount[1]];
  if (countPattern[0] === 3 && countPattern[1] === 2) return [6, byCount[0], byCount[1]];
  if (isFlush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (countPattern[0] === 3) return [3, byCount[0], ...byCount.slice(1)];
  if (countPattern[0] === 2 && countPattern[1] === 2) return [2, byCount[0], byCount[1], byCount[2]];
  if (countPattern[0] === 2) return [1, byCount[0], ...byCount.slice(1)];
  return [0, ...ranks];
}

export function compareScores(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

function* combos(arr, k, start = 0, prefix = []) {
  if (prefix.length === k) { yield prefix; return; }
  for (let i = start; i < arr.length; i++) {
    yield* combos(arr, k, i + 1, [...prefix, arr[i]]);
  }
}

// Best 5-card score from 5–7 cards.
export function evaluateBest(cards) {
  let best = null;
  for (const combo of combos(cards, 5)) {
    const score = evaluate5(combo);
    if (!best || compareScores(score, best) > 0) best = score;
  }
  return best;
}

export function categoryName(score) { return CATEGORY_NAMES[score[0]]; }

// Monte-Carlo win probability for `hole` (2 cards) given the known `board`
// (0–5 cards), against one random opponent. Returns win+½tie fraction in [0,1].
export function estimateEquity(hole, board, samples = 200, rand = Math.random) {
  const seen = new Set([...hole, ...board].map((c) => c.r * 4 + c.s));
  const deck = makeDeck().filter((c) => !seen.has(c.r * 4 + c.s));
  let score = 0, n = 0;
  for (let i = 0; i < samples; i++) {
    const d = shuffle(deck, rand);
    let k = 0;
    const oppHole = [d[k++], d[k++]];
    const need = 5 - board.length;
    const fill = [];
    for (let j = 0; j < need; j++) fill.push(d[k++]);
    const full = [...board, ...fill];
    const mine = evaluateBest([...hole, ...full]);
    const theirs = evaluateBest([...oppHole, ...full]);
    const cmp = compareScores(mine, theirs);
    score += cmp > 0 ? 1 : cmp < 0 ? 0 : 0.5;
    n++;
  }
  return n ? score / n : 0.5;
}
