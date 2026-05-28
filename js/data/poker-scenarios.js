// Hand-crafted heads-up Hold'em scenarios for the Poker Scenarios trainer.
// Each scenario tests one common decision (value bet, semi-bluff, fold to
// pressure, etc.) with a clear "correct" line and a written explanation that
// walks through pot odds, equity, and the strategic reasoning.

const C = (r, s) => ({ r, s }); // suits: 0=♠ 1=♥ 2=♦ 3=♣

export const SCENARIOS = [
  {
    title: 'Preflop premium — 3-bet for value',
    street: 'preflop',
    position: 'BB',
    blinds: '10/20',
    stacks: { you: 1000, opp: 1000 },
    history: 'Opponent opens to 60 from the button (small blind). You\'re in the BB.',
    hole: [C(14, 0), C(14, 1)],
    board: [],
    potBefore: 80, toCall: 40,
    options: [
      { label: 'Fold', action: 'fold' },
      { label: 'Call 40', action: 'call' },
      { label: 'Raise to 180 (3-bet)', action: 'raise' },
    ],
    correct: 'raise',
    explanation: {
      tag: 'Raise: print money with the nuts preflop',
      points: [
        'Pocket Aces is ~85% vs. a random hand and still ~80% vs. a typical opening range.',
        '3-betting builds the pot while you\'re a massive favorite. Slow-playing AA leaks value.',
        'A standard 3-bet is ≈ 3× the open — about 180 here.',
      ],
    },
  },
  {
    title: 'Preflop discipline — junk doesn\'t fit',
    street: 'preflop',
    position: 'BTN/SB',
    blinds: '10/20',
    stacks: { you: 600, opp: 600 },
    history: 'You\'re the button (SB). Action is on you with 7♠ 2♦.',
    hole: [C(7, 0), C(2, 2)],
    board: [],
    potBefore: 30, toCall: 10,
    options: [
      { label: 'Fold', action: 'fold' },
      { label: 'Limp 10', action: 'call' },
      { label: 'Raise to 60', action: 'raise' },
    ],
    correct: 'fold',
    explanation: {
      tag: 'Fold: realising equity with 7-high is brutal',
      points: [
        '7-2 offsuit is the worst hand in Hold\'em (~35% vs. random, but plays much worse than that).',
        'Pot odds 25% look tempting, but you\'ll be in tough spots on most flops with no clear plan.',
        'Folding here preserves chips for spots where you have initiative and an actual hand.',
      ],
    },
  },
  {
    title: 'Top pair, dry board — value bet',
    street: 'flop',
    position: 'BB',
    blinds: '10/20',
    stacks: { you: 800, opp: 800 },
    history: 'Preflop: you defended BB with K♥ Q♣ vs. a 3× raise. Flop: K♠ 7♦ 2♣. Opp checks.',
    hole: [C(13, 1), C(12, 3)],
    board: [C(13, 0), C(7, 2), C(2, 3)],
    potBefore: 120, toCall: 0,
    options: [
      { label: 'Check', action: 'check' },
      { label: 'Bet 60 (½ pot)', action: 'bet-half' },
      { label: 'Bet 120 (pot)', action: 'bet-pot' },
    ],
    correct: 'bet-half',
    explanation: {
      tag: 'Bet half-pot: get value from worse Kx, pocket pairs, and floats',
      points: [
        'Top pair, second kicker on a totally dry board — strong value hand (~75% vs. typical check-back range).',
        'A small bet (~½ pot) keeps weaker pairs paying and isolates floats; a pot-sized bet folds out the worst hands.',
        'You can size up on later streets if villain calls.',
      ],
    },
  },
  {
    title: 'Nut flush draw + overcard — call the pot odds',
    street: 'flop',
    position: 'BB',
    blinds: '10/20',
    stacks: { you: 800, opp: 800 },
    history: 'Preflop: you call BB with A♥ 7♥. Flop: K♥ T♥ 4♠. Opp bets 80 into a 120 pot.',
    hole: [C(14, 1), C(7, 1)],
    board: [C(13, 1), C(10, 1), C(4, 0)],
    potBefore: 200, toCall: 80,
    options: [
      { label: 'Fold', action: 'fold' },
      { label: 'Call 80', action: 'call' },
      { label: 'Raise to 220 (semi-bluff)', action: 'raise' },
    ],
    correct: 'call',
    explanation: {
      tag: 'Call: pot odds 29% vs. ~46% equity to hit by river',
      points: [
        '9 clean flush outs + 3 ace outs ≈ 12 clean outs ≈ 24% to hit on the turn, ~46% by the river.',
        'Pot odds: 80 to win 280 → 28.6%. Your draw equity easily beats this.',
        'Raising as a semi-bluff is also defensible (fold equity + draw equity), but calling is the lowest-variance +EV line.',
      ],
    },
  },
  {
    title: 'Ace-high facing a turn lead — give it up',
    street: 'turn',
    position: 'BTN',
    blinds: '10/20',
    stacks: { you: 700, opp: 700 },
    history: 'Preflop: you raise A♣ 2♠ from the button, BB called. Flop 8♥ 7♥ 4♦ — BB checks, you c-bet, BB calls. Turn J♠ — BB leads pot.',
    hole: [C(14, 3), C(2, 0)],
    board: [C(8, 1), C(7, 1), C(4, 2), C(11, 0)],
    potBefore: 600, toCall: 300,
    options: [
      { label: 'Fold', action: 'fold' },
      { label: 'Call 300', action: 'call' },
      { label: 'Raise (bluff)', action: 'raise' },
    ],
    correct: 'fold',
    explanation: {
      tag: 'Fold: ace-high with no draws vs. a pot-sized lead',
      points: [
        'Your equity is ~10–15% vs. a typical pot-leading range (pairs, sets, made straights).',
        'Pot odds: 300 to win 900 → 33%. You\'re nowhere close.',
        'Hero-calling here bleeds money. Save your stack for spots with showdown value or fold equity.',
      ],
    },
  },
  {
    title: 'Top set on the river — pay it off',
    street: 'river',
    position: 'BB',
    blinds: '10/20',
    stacks: { you: 400, opp: 400 },
    history: 'Preflop: you call SB with 9♠ 9♣. Flop 9♥ 6♣ 2♦ (you flop top set). Turn 5♥, river 3♣. Opp shoves all-in into a 400 pot.',
    hole: [C(9, 0), C(9, 3)],
    board: [C(9, 1), C(6, 3), C(2, 2), C(5, 1), C(3, 3)],
    potBefore: 800, toCall: 400,
    options: [
      { label: 'Fold', action: 'fold' },
      { label: 'Call 400', action: 'call' },
    ],
    correct: 'call',
    explanation: {
      tag: 'Snap-call: top set is too strong to ever fold here',
      points: [
        'Only 4-7 makes a straight against you. Realistically villain shoves with two pair, sets, busted draws, and the occasional straight.',
        'Vs. that range you\'re ~70–80%. Pot odds 33% mean you only need to be ahead 1 in 3 times.',
        'Easy +EV call; folding top set on a non-paired, non-flushing board would be a major leak.',
      ],
    },
  },
  {
    title: 'Set on a dry flop — raise for value',
    street: 'flop',
    position: 'BB',
    blinds: '10/20',
    stacks: { you: 600, opp: 600 },
    history: 'Preflop: you call with 5♣ 5♦. Flop 5♥ K♦ 2♠. Opp bets 80 into a 100 pot.',
    hole: [C(5, 3), C(5, 2)],
    board: [C(5, 1), C(13, 2), C(2, 0)],
    potBefore: 180, toCall: 80,
    options: [
      { label: 'Fold', action: 'fold' },
      { label: 'Call 80', action: 'call' },
      { label: 'Raise to 220', action: 'raise' },
    ],
    correct: 'raise',
    explanation: {
      tag: 'Raise: bottom set is ~95% vs. their bet-flop range',
      points: [
        'Top combo on the board — you almost always have the best hand.',
        'Raise gets value from top-pair Kx and overpairs, and charges any backdoor draws.',
        'Slow-playing risks letting cheap straight/flush draws materialise on later streets.',
      ],
    },
  },
  {
    title: 'River check-raise jam — call or fold?',
    street: 'river',
    position: 'BTN',
    blinds: '10/20',
    stacks: { you: 1000, opp: 1000 },
    history: 'Preflop opp 3-bets, you call with J♠ T♠. Flop 8♣ 6♦ 2♠ (check, check). Turn J♣ — you bet, opp called. River 9♠. Opp checks; you bet 200 into 400; opp check-raises all-in for 600 more.',
    hole: [C(11, 0), C(10, 0)],
    board: [C(8, 3), C(6, 2), C(2, 0), C(11, 3), C(9, 0)],
    potBefore: 1400, toCall: 600,
    options: [
      { label: 'Fold', action: 'fold' },
      { label: 'Call 600', action: 'call' },
    ],
    correct: 'fold',
    explanation: {
      tag: 'Fold: a polarised check-raise jam is rarely bluffing',
      points: [
        'You have top pair, weak kicker — a mediocre bluff-catcher.',
        'Villain\'s line (call turn, check-raise river) is overwhelmingly two-pair, sets, or straights (7-T).',
        'Pot odds 30%; your equity vs. that range is well under 20%. Disciplined fold.',
      ],
    },
  },
];
