// Progressive chess puzzles. Each puzzle stores an 8×8 board, side to move,
// and a forced solution path. We validate the player's move against the next
// expected step; opponent replies are auto-played.

const row = (s) => s.split('').map((c) => c === ' ' ? '.' : c);

// Each puzzle:
//   board: 8 rows top→bottom (row 0 = rank 8)
//   side: 'w' or 'b'
//   moves: array of [from, to] pairs alternating player/opponent
//     ('e2' style notation, file a-h + rank 1-8)
//   title, hint
export const PUZZLES = [
  {
    title: 'Back-rank mate (Mate in 1)',
    hint: 'White rook to the back rank — black king has nowhere to hide.',
    side: 'w',
    board: [
      row('....r.k.'),
      row('.....ppp'),
      row('........'),
      row('........'),
      row('........'),
      row('........'),
      row('.....PPP'),
      row('R...K...'),
    ],
    moves: [['a1','a8']],
  },
  {
    title: 'Knight mate (Mate in 1)',
    hint: 'Find the killer knight square.',
    side: 'w',
    board: [
      row('r....rk.'),
      row('ppp..ppp'),
      row('..N.....'),
      row('........'),
      row('........'),
      row('........'),
      row('PPP..PPP'),
      row('R...R.K.'),
    ],
    moves: [['c6','e7']],
  },
  {
    title: 'Queen mate (Mate in 1)',
    hint: 'Deliver mate with the queen; nothing can block.',
    side: 'w',
    board: [
      row('......k.'),
      row('R....ppp'),
      row('........'),
      row('.......Q'),
      row('........'),
      row('........'),
      row('.....PPP'),
      row('......K.'),
    ],
    moves: [['h5','h8']],
  },
  {
    title: 'Win the queen (Tactic)',
    hint: 'A pin wins material.',
    side: 'w',
    board: [
      row('r...k..r'),
      row('ppp.qppp'),
      row('..n.....'),
      row('....p...'),
      row('....P...'),
      row('..N.....'),
      row('PPPB.PPP'),
      row('R..Q.RK.'),
    ],
    moves: [['d2','g5'], ['e7','g5'], ['d1','d8']],
    // Note: simplified — accept the bishop pin sequence.
  },
  {
    title: 'Smothered mate (Mate in 2)',
    hint: 'Sacrifice the queen — let the knight finish.',
    side: 'w',
    board: [
      row('......rk'),
      row('.....Npp'),
      row('........'),
      row('.......Q'),
      row('........'),
      row('........'),
      row('.....PPP'),
      row('......K.'),
    ],
    moves: [['h5','g6'], ['h7','g6'], ['f7','h6']],
    // Qg6 hxg6 Nh6# (illustrative; sequence is fixed for the puzzle).
  },
  {
    title: 'Discovered check + win',
    hint: 'Move the bishop, unleash the rook.',
    side: 'w',
    board: [
      row('....k...'),
      row('pppq.ppp'),
      row('...B....'),
      row('........'),
      row('........'),
      row('........'),
      row('PPP..PPP'),
      row('R...K..R'),
    ],
    moves: [['d6','b8'], ['e8','f8'], ['b8','d6']],
  },
  {
    title: 'Promotion to win (Endgame)',
    hint: 'Push the pawn — the king is too far.',
    side: 'w',
    board: [
      row('........'),
      row('....P...'),
      row('........'),
      row('........'),
      row('........'),
      row('........'),
      row('......k.'),
      row('K.......'),
    ],
    moves: [['e7','e8']],
  },
  {
    title: 'Fork the king and rook',
    hint: 'A knight fork wins material.',
    side: 'w',
    board: [
      row('r...k...'),
      row('.ppp.ppp'),
      row('........'),
      row('....N...'),
      row('........'),
      row('........'),
      row('PPPP.PPP'),
      row('R...K...'),
    ],
    moves: [['e5','c6']],
  },
  {
    title: 'Greek gift (Mate in 2)',
    hint: 'Sacrifice the bishop to draw the king out.',
    side: 'w',
    board: [
      row('r..q.rk.'),
      row('ppp..ppp'),
      row('..n.....'),
      row('...Bp...'),
      row('....P...'),
      row('..N.....'),
      row('PPP..PPP'),
      row('R..Q.RK.'),
    ],
    moves: [['d5','h7'], ['g8','h7'], ['d1','h5']],
  },
  {
    title: 'Two-rook ladder (Mate in 2)',
    hint: 'Rooks on the 7th and 8th rank.',
    side: 'w',
    board: [
      row('....k...'),
      row('R.......'),
      row('.R......'),
      row('........'),
      row('........'),
      row('........'),
      row('.....PPP'),
      row('......K.'),
    ],
    moves: [['b6','b8'], ['e8','f8'], ['a7','a8']],
  },
];
