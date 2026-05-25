# 🎮 Brain Arcade

A single-page tab arcade of **25 classic puzzle, word, card & game-theory games**, designed for GitHub Pages. No build step — pure HTML/CSS/JS modules. Fully mobile-friendly with responsive layouts and touch-friendly targets.

## Games

### Logic puzzles
1. 🗼 **Tower of Hanoi** — tap source peg, then destination peg
2. 🧩 **15-Puzzle / Sliding Tile Puzzle** — grid rearrangement via empty space
3. 🪣 **Water Jug** — measure exact volumes using limited containers
4. 🟠 **Peg Solitaire** — jump-and-remove until one remains
5. 💡 **Lights Out** — toggle grid with neighbor-cascade effects
6. ⚫ **Nim** — heap removal with XOR strategy AI
7. 🗺️ **Traveling Salesman** — find optimal route through cities

### Game theory
8. ⚪ **Misère Nim** — last move loses, with optimal misère AI
9. 🤝 **Prisoner's Dilemma** — iterated cooperation vs defection
10. 🦌 **Stag Hunt** — coordination vs safety dilemma
11. 🦅 **Hawk–Dove (Chicken)** — escalation vs compromise
12. 💰 **Ultimatum** — split-money negotiation with thresholds
13. 🐛 **Centipede** — escalating turn-based pot with stop temptation
14. 🏛️ **Public Goods** — group cooperation vs free-rider incentives
15. 🎭 **Battle of the Sexes** — coordination with asymmetric preferences

### Word, board & strategy
16. 🟩 **Wordle** — guess the 5-letter word in 6 tries
17. 🔤 **Anagrams** — find every word from a rack of letters
18. ♟ **Chess Puzzles** — progressively harder mate-in-N tactics
19. ⏱️ **Speed Mates** — timed mate puzzles (6–12 pieces) of growing difficulty; 100 pts per mate + speed bonus
20. ⭐ **Chinese Checkers** — Quick mode vs computer · Advanced two-player pass & play
21. 🀄 **Mahjong Solitaire** — Shanghai-style tile matching, full mahjong tile set
22. 🍩 **Donut Hunt** — battleship-style hunt for the opponent's donuts
23. 🎯 **Mastermind** — crack the hidden colour code from black/white peg feedback
24. 🧠 **Memory Match** — heads-up pairs: vs the computer (Quick) or pass-and-play (Advanced)
25. 🃏 **Heads-Up Poker** — no-limit Texas Hold'em against the computer; bust it to win

## Features

- **Tab-based SPA** with hash routing (deep-linkable per game)
- **Quick** and **Advanced** difficulty modes — each game scales board size, rounds, or constraints
- **Game timer** (per game) and **Session timer** (per visit)
- **Head-to-head challenges**: challenge a friend at any of the puzzle games — they play the *exact same* seeded puzzle from a share link, and the better time/score wins **100 points**
- **Accounts & points**: play as a local guest out of the box (points saved in the browser); enable real sign-in (Google, Apple, GitHub, Microsoft, Facebook, email, guest) + cross-device points by configuring Supabase (see below)
- **Funny win celebration**: elephant 🐘, pig 🐷, and bear 🐻 cheer you on with rotating speech bubbles, confetti and a banner for ~11 seconds after every win
- **Fully mobile-friendly**: responsive layouts, horizontally-scrolling tabs, 40px+ tap targets, prevent-zoom inputs
- All games target ~5–15 minutes of play depending on mode

## Accounts & head-to-head challenges

Works with **zero setup** as a local guest: hit **⚔️ Challenge**, pick a game, play your round, and share the generated link. Whoever does better on the identical puzzle banks 100 points (stored per-browser for guests).

To enable real accounts + cross-device points:
1. Create a free [Supabase](https://supabase.com) project and run `supabase/schema.sql` in its SQL editor.
2. Settings → API: copy the Project URL + anon (publishable) key into `js/config.js`.
3. Auth → URL Configuration: add your site URL and `http://localhost:8000` as redirect URLs.

The anon key is publishable and safe to commit; data is protected by Row-Level Security.

## Deploying to GitHub Pages

1. Push this repo to GitHub
2. In the repo's **Settings → Pages**, choose `Deploy from a branch`, branch `main` (or your default), folder `/ (root)`
3. Open `https://<user>.github.io/<repo>/`

No build, bundler, or framework dependency — everything is plain ES module JavaScript and runs directly from disk.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project layout

```
.
├── index.html
├── css/styles.css
├── js/
│   ├── app.js           # tab router, mode toggle, lifecycle
│   ├── timer.js         # per-game + session stopwatches
│   ├── celebration.js   # elephant/pig/bear win animation
│   ├── helpers.js       # tiny DOM helpers
│   └── games/           # one file per game
└── .nojekyll
```
