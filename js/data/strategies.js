// Strategy advisor content for every game. Keyed by the game id used in the
// GAMES array (js/app.js). Each entry: { goal, strategies[], mistakes[]?,
// optimal? } — `optimal` is a callout for games with a provably best method.
export const STRATEGIES = {
  hanoi: {
    goal: 'Move every disk onto the rightmost peg (C), never placing a larger disk on a smaller one.',
    optimal: 'The minimum is exactly 2ⁿ−1 moves. There is a simple rule that achieves it without thinking recursively.',
    strategies: [
      'Move the smallest disk every other turn, always cycling the same direction: with an ODD number of disks go A→C→B→A…; with an EVEN number go A→B→C→A….',
      'On the turns you do NOT move the smallest disk, there is only ONE legal move available — make it.',
      'Recursive view: to move n disks A→C, first move n−1 disks A→B, move the biggest A→C, then move n−1 disks B→C.',
      'Never undo your previous move — that wastes two turns and is never part of an optimal solution.',
    ],
    mistakes: ['Burying a disk you’ll soon need under a stack on the wrong peg.'],
  },
  fifteen: {
    goal: 'Slide tiles into ascending order with the blank in the bottom-right.',
    strategies: [
      'Solve the top row, then the left column, and repeat — each time you shrink the unsolved area by one row/column.',
      'For the last two tiles of a row, place them together using the “corner rotation” trick rather than one at a time.',
      'Once only a 2×3 block remains, it can always be solved by rotating the six cells.',
      'Think about where the blank needs to be BEFORE you move a target tile, so it’s ready to receive it.',
    ],
    mistakes: ['Greedily placing one tile and disturbing tiles you already solved.'],
  },
  'water-jug': {
    goal: 'Measure the exact target volume in one of the jugs.',
    optimal: 'The target is reachable only if it is a multiple of the GCD of the jug capacities.',
    strategies: [
      'Repeatedly fill the larger jug and pour it into the smaller; empty the smaller when full. This “pour-across” loop sweeps through every reachable amount.',
      'Or run it the other way (fill small, pour into large) — one of the two directions reaches the target faster.',
      'Track the amount in each jug after every step; you’re doing modular arithmetic with the capacities.',
    ],
    mistakes: ['Random fills/empties — pick one consistent pour direction and follow it.'],
  },
  'peg-solitaire': {
    goal: 'Jump-and-remove until a single peg remains (ideally in the centre).',
    strategies: [
      'Work toward the centre and keep pegs connected — avoid stranding a lone peg in a corner.',
      'Plan in “packages”: short L-shaped sequences of 3 pegs clear cleanly and leave a tidy board.',
      'Leave the final clearing chain set up so its last jump lands in the centre hole.',
      'Look several jumps ahead — a move that gains nothing now may set up a long chain later.',
    ],
    mistakes: ['Creating isolated pegs early that can never be jumped.'],
  },
  'lights-out': {
    goal: 'Turn every light off.',
    optimal: 'Use “light chasing”: it reduces any solvable board to at most a single corrective first move.',
    strategies: [
      'Light chasing: going top to bottom, for every lit light in a row, press the cell directly BELOW it. This clears each row in turn.',
      'After chasing to the bottom, the remaining lit pattern in the bottom row tells you (via a fixed lookup) which TOP-row cells to press first — then chase again to finish.',
      'Order never matters and pressing a cell twice cancels out, so each cell is pressed at most once in the solution.',
    ],
    mistakes: ['Clicking lights directly off — that just shifts the problem around.'],
  },
  nim: {
    goal: 'Take the last stone (normal play).',
    optimal: 'Compute the nim-sum: XOR all heap sizes. Move to make the nim-sum 0.',
    strategies: [
      'After your move the XOR of all heaps should equal 0 — that hands your opponent a losing position.',
      'A winning move always exists exactly when the current nim-sum is non-zero: find a heap whose size XOR (nim-sum) is smaller, and reduce it to that.',
      'If the nim-sum is already 0 on your turn, you’re theoretically lost — play on and hope for an opponent slip.',
    ],
    mistakes: ['Taking from the biggest heap by feel instead of computing the XOR.'],
  },
  'misere-nim': {
    goal: 'Force your opponent to take the last stone (last move LOSES).',
    optimal: 'Play normal Nim (nim-sum 0) — except in the endgame of single-stone heaps.',
    strategies: [
      'Use the normal XOR strategy right up until your normal move would leave every remaining heap with just one stone.',
      'At that point switch: leave an ODD number of 1-stone heaps, so your opponent is forced to take the last one.',
      'Heaps of size ≥2 are what let you keep control — don’t collapse them all too early.',
    ],
    mistakes: ['Applying the normal-play rule all the way to the end — the misère endgame is reversed.'],
  },
  prisoner: {
    goal: 'Maximise your total score across the repeated game.',
    strategies: [
      'Tit-for-tat wins long run: cooperate first, then copy whatever the opponent did last turn.',
      'Be nice (don’t defect first), retaliatory (punish a defection), forgiving (return to cooperation), and clear (predictable).',
      'Against an AI that mirrors you, sustained mutual cooperation beats alternating betrayals.',
      'Only defect near the very end if there’s no future round to be punished in.',
    ],
    mistakes: ['Defecting early and triggering an endless retaliation spiral.'],
  },
  'stag-hunt': {
    goal: 'Earn more by coordinating on the high-reward hunt.',
    strategies: [
      'Stag/stag is the best outcome — establish trust by repeatedly choosing stag.',
      'Hare is the safe fallback: if the partner keeps bailing to hare, protect yourself.',
      'Signal commitment with a run of stag choices to pull a cautious partner toward cooperation.',
    ],
    mistakes: ['Switching to hare the moment you’re nervous — it collapses the coordination you built.'],
  },
  'hawk-dove': {
    goal: 'Win resources while avoiding the mutually destructive Hawk–Hawk clash.',
    strategies: [
      'The equilibrium is mixed — don’t always escalate. Play Hawk against doves and Dove against hawks.',
      'Mutual Hawk is the worst cell for everyone; avoid escalating into a known aggressor.',
      'Read the opponent’s recent pattern and exploit it: dove-heavy opponents can be bullied; hawk-heavy ones should be yielded to.',
    ],
    mistakes: ['Always playing Hawk — the injuries from Hawk–Hawk erase your gains.'],
  },
  ultimatum: {
    goal: 'Maximise the money you bank across rounds.',
    strategies: [
      'As proposer, offer just enough to clear the responder’s acceptance threshold — keep the rest.',
      'As responder, accept any positive offer when your aim is total money (rejecting only burns chips).',
      'Probe the threshold with offers and remember what got accepted or rejected.',
    ],
    mistakes: ['Rejecting “unfair” but positive offers out of spite when you’re scoring on totals.'],
  },
  centipede: {
    goal: 'Bank more than the opponent as the pot grows.',
    strategies: [
      'Strict theory says take immediately, but against an AI that often passes, let the pot grow.',
      'Take the turn BEFORE you expect the opponent to take — grab the larger share just ahead of them.',
      'Watch the AI’s take-probability climb as the pot grows and step in just before it does.',
    ],
    mistakes: ['Passing one step too many and letting the opponent scoop the big pot.'],
  },
  'public-goods': {
    goal: 'End with the most tokens.',
    strategies: [
      'Early cooperation keeps the multiplier pumping value into the pool for everyone.',
      'Be a conditional cooperator: match the group’s average so you’re not the lone sucker.',
      'In the final rounds contributions decay — hold back late since there’s no future to sustain.',
    ],
    mistakes: ['Free-riding from the start — it triggers a collapse that shrinks everyone’s pie, including yours.'],
  },
  'battle-sexes': {
    goal: 'Coordinate on the same event despite differing preferences.',
    strategies: [
      'Any coordination beats missing each other — landing on either shared option scores.',
      'Alternate between the two equilibria across rounds for a fair split of the better payoff.',
      'Or commit consistently to your preferred option to “anchor” the partner onto it.',
    ],
    mistakes: ['Stubbornly insisting every round and repeatedly mis-coordinating to zero.'],
  },
  tsp: {
    goal: 'Find the shortest round-trip visiting every city once.',
    strategies: [
      'Start with nearest-neighbour: from each city hop to the closest unvisited one.',
      'Then apply 2-opt: if two edges of your tour cross, swap them to uncross — this almost always shortens it.',
      'Roughly follow the outer hull of the points and tuck interior cities into the nearest pass.',
      'A good tour has NO crossing lines — hunt down and remove every crossing.',
    ],
    mistakes: ['Leaving crossed edges in the route — they’re always longer than the uncrossed version.'],
  },
  wordle: {
    goal: 'Identify the 5-letter word in as few guesses as possible.',
    strategies: [
      'Open with a vowel- and consonant-rich word like SLATE, CRANE, or AUDIO to test many common letters.',
      'Use a second guess with all-new letters to gather maximum information before narrowing.',
      'Lock greens in place, float yellows to new positions, and never re-use a known-grey letter.',
      'Late in the puzzle, prefer a word that distinguishes between your remaining candidates.',
    ],
    mistakes: ['Wasting a guess on a word that repeats letters you’ve already ruled out.'],
  },
  anagrams: {
    goal: 'Find as many valid words as possible from the rack.',
    strategies: [
      'Mine common endings (-ING, -ED, -ER, -ES) and prefixes (RE-, UN-, IN-) to spawn families of words.',
      'Build up by length: lock in the 3-letter words first, then extend them with extra letters.',
      'Hunt for the “pangram” that uses ALL the letters — it’s worth the most and confirms the rack.',
      'Shuffle the tiles to jolt your brain into seeing new combinations.',
    ],
  },
  chess: {
    goal: 'Find the forced winning line in each puzzle.',
    strategies: [
      'Scan Checks, Captures and Threats (CCT) first — the solution is almost always forcing.',
      'Use the theme tag (pin, fork, skewer, smothered mate…) as a direct clue to the motif.',
      'Calculate the opponent’s only replies to the end of the line before you commit.',
      'In mating puzzles, count the enemy king’s escape squares and find the move that removes them.',
    ],
    mistakes: ['Grabbing material when a forcing checkmate or bigger tactic was available.'],
  },
  'speed-chess': {
    goal: 'Deliver the checkmate before the clock runs out.',
    strategies: [
      'Train pattern recognition: most positions are a known mating shape (back-rank, smothered, ladder).',
      'Look at the king’s escape squares first — the mate is the check that covers them all.',
      'Trust the forcing move; under time pressure, a check that limits replies is usually the answer.',
      'Solve the easy ones fast to bank the speed bonus and buy thinking time on the hard ones.',
    ],
  },
  'chinese-checkers': {
    goal: 'Get all your pegs into the opposite triangle first.',
    strategies: [
      'Build “ladders” — line up pegs so one piece chains multiple jumps across the board in a single turn.',
      'Keep your pieces together; a long jump chain beats several single steps.',
      'Don’t leave stragglers in your home triangle — advance your rear pieces every chance.',
      'Deny the opponent: avoid leaving a peg that hands them a long jump path forward.',
    ],
    mistakes: ['Advancing a lone runner while the rest of your pegs lag behind.'],
  },
  mahjong: {
    goal: 'Clear the board by matching all tiles in pairs.',
    strategies: [
      'Only “free” tiles (open on the left or right, with nothing on top) can be matched — scan those first.',
      'Think one step ahead: prefer matches that FREE the most blocked tiles underneath or beside them.',
      'When four identical tiles are all available, decide which two to remove so you don’t strand the other two.',
      'Use the hint/undo when stuck, but plan removals so you keep future pairs reachable.',
    ],
    mistakes: ['Matching a pair that buries or strands the tiles you needed next.'],
  },
  'donut-hunt': {
    goal: 'Find and eat all the opponent’s donuts before they find yours.',
    strategies: [
      'Search in a checkerboard (parity) pattern — every donut is at least 2 cells long, so this finds them with half the shots.',
      'After a hit, probe the four neighbours; once you get a second hit in line, keep firing along that line both ways.',
      'When placing YOUR donuts, spread them out and avoid touching edges/each other to dodge the AI’s line-hunt.',
      'Track misses to rule out regions that can’t fit the remaining donut sizes.',
    ],
    mistakes: ['Firing randomly after a hit instead of extending along the discovered line.'],
  },
  mastermind: {
    goal: 'Crack the hidden colour code in as few guesses as possible.',
    optimal: 'Knuth’s minimax method solves the classic 4-peg/6-colour game in at most 5 guesses.',
    strategies: [
      'Open with a two-colour pattern like AABB to learn how many of each colour are present.',
      'Use each feedback to eliminate impossible codes; pick a next guess that splits the remaining possibilities most evenly.',
      'Black peg = right colour AND spot; white = right colour, wrong spot. Separate “which colours” from “which positions”.',
      'Once you know the multiset of colours, spend guesses arranging their positions.',
    ],
    mistakes: ['Changing several pegs at once so you can’t tell which change caused the feedback shift.'],
  },
  match: {
    goal: 'Collect more pairs than your opponent.',
    strategies: [
      'Memorise the position of every card each time one is flipped — by either player.',
      'When you already know where a pair is, take it immediately (a match lets you go again).',
      'Otherwise flip an UNKNOWN card first; if it matches something you’ve seen, finish the pair — if not, you’ve learned a new card.',
      'Late game, chain known pairs together to clear several in one turn.',
    ],
    mistakes: ['Flipping two unknown cards when you already knew a guaranteed pair.'],
  },
  poker: {
    goal: 'Bust the computer by winning its chips.',
    strategies: [
      'The built-in advisor panel is live — it shows your equity, the pot odds, and the recommended action with the reasoning. Use it!',
      'Call when your equity beats the pot odds; fold when it doesn’t; raise your strong value hands to get paid.',
      'Play tight-aggressive: enter fewer hands, but bet and raise the ones you do play.',
      'Apply pressure when the board misses the opponent, and don’t pay off obvious strength.',
    ],
    mistakes: ['Calling all the way with a weak hand “to see” — that’s how you bleed chips.'],
  },
  'poker-scenarios': {
    goal: 'Choose the highest-EV action in each spot.',
    strategies: [
      'Compare your equity to the pot odds: call when equity > pot odds, fold when it’s lower.',
      'Value-bet and raise your strong hands; turn weak ones into folds against pressure.',
      'Identify the spot type (premium preflop, draw, bluff-catch) — each has a standard best play.',
      'Read the explanations after each answer; the patterns repeat across real games.',
    ],
  },
};

export function strategyFor(id) {
  return STRATEGIES[id] || null;
}
