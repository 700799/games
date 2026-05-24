// App shell: tabs, routing via location.hash, mode toggle, and game lifecycle.
import { timers } from './timer.js';
import { dismiss as dismissCheer } from './celebration.js';

import { hanoi } from './games/tower-of-hanoi.js';
import { fifteen } from './games/fifteen-puzzle.js';
import { waterJug } from './games/water-jug.js';
import { pegSolitaire } from './games/peg-solitaire.js';
import { lightsOut } from './games/lights-out.js';
import { nim } from './games/nim.js';
import { misereNim } from './games/misere-nim.js';
import { prisoner } from './games/prisoners-dilemma.js';
import { stagHunt } from './games/stag-hunt.js';
import { hawkDove } from './games/hawk-dove.js';
import { ultimatum } from './games/ultimatum.js';
import { centipede } from './games/centipede.js';
import { publicGoods } from './games/public-goods.js';
import { battleOfSexes } from './games/battle-of-sexes.js';
import { tsp } from './games/traveling-salesman.js';
import { wordle } from './games/wordle.js';
import { anagrams } from './games/anagrams.js';
import { chessPuzzle } from './games/chess-puzzle.js';
import { speedChess } from './games/speed-chess.js';
import { chineseCheckers } from './games/chinese-checkers.js';
import { mahjong } from './games/mahjong.js';
import { donutHunt } from './games/donut-hunt.js';
import { mastermind } from './games/mastermind.js';

export const GAMES = [
  { id: 'hanoi',           icon: '🗼', name: 'Tower of Hanoi',       mount: hanoi },
  { id: 'fifteen',         icon: '🧩', name: '15-Puzzle',            mount: fifteen },
  { id: 'water-jug',       icon: '🪣', name: 'Water Jug',            mount: waterJug },
  { id: 'peg-solitaire',   icon: '🟠', name: 'Peg Solitaire',        mount: pegSolitaire },
  { id: 'lights-out',      icon: '💡', name: 'Lights Out',           mount: lightsOut },
  { id: 'nim',             icon: '⚫', name: 'Nim',                  mount: nim },
  { id: 'misere-nim',      icon: '⚪', name: 'Misère Nim',           mount: misereNim },
  { id: 'prisoner',        icon: '🤝', name: "Prisoner's Dilemma",   mount: prisoner },
  { id: 'stag-hunt',       icon: '🦌', name: 'Stag Hunt',            mount: stagHunt },
  { id: 'hawk-dove',       icon: '🦅', name: 'Hawk–Dove',            mount: hawkDove },
  { id: 'ultimatum',       icon: '💰', name: 'Ultimatum',            mount: ultimatum },
  { id: 'centipede',       icon: '🐛', name: 'Centipede',            mount: centipede },
  { id: 'public-goods',    icon: '🏛️', name: 'Public Goods',         mount: publicGoods },
  { id: 'battle-sexes',    icon: '🎭', name: 'Battle of the Sexes',  mount: battleOfSexes },
  { id: 'tsp',             icon: '🗺️', name: 'Traveling Salesman',   mount: tsp },
  { id: 'wordle',          icon: '🟩', name: 'Wordle',               mount: wordle },
  { id: 'anagrams',        icon: '🔤', name: 'Anagrams',             mount: anagrams },
  { id: 'chess',           icon: '♟', name: 'Chess Puzzles',         mount: chessPuzzle },
  { id: 'speed-chess',     icon: '⏱️', name: 'Speed Mates',          mount: speedChess },
  { id: 'chinese-checkers',icon: '⭐', name: 'Chinese Checkers',     mount: chineseCheckers },
  { id: 'mahjong',         icon: '🀄', name: 'Mahjong',              mount: mahjong },
  { id: 'donut-hunt',      icon: '🍩', name: 'Donut Hunt',           mount: donutHunt },
  { id: 'mastermind',      icon: '🎯', name: 'Mastermind',           mount: mastermind },
];

const state = {
  mode: 'quick',
  currentId: null,
  currentTeardown: null,
};

function buildTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  GAMES.forEach((g, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.id = g.id;
    btn.innerHTML = `<span>${g.icon}</span><span class="tab-num">${idx + 1}.</span><span>${g.name}</span>`;
    btn.onclick = () => navigate(g.id);
    nav.appendChild(btn);
  });
}

function navigate(id) {
  if (state.currentId === id) return;
  // Tear down old game
  if (state.currentTeardown) {
    try { state.currentTeardown(); } catch (e) { console.error(e); }
    state.currentTeardown = null;
  }
  // Hide celebration
  dismissCheer();

  state.currentId = id;
  history.replaceState(null, '', `#${id}`);

  // Update tab highlight
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.id === id);
  });

  // Mount new game
  const game = GAMES.find((g) => g.id === id) || GAMES[0];
  const area = document.getElementById('game-area');
  area.innerHTML = '';
  const shell = document.createElement('section');
  shell.className = 'game-shell';
  area.appendChild(shell);

  timers.resetGame();
  state.currentTeardown = game.mount(shell, { mode: state.mode, getMode: () => state.mode });

  area.focus({ preventScroll: true });
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  // Remount current game so it picks up the new mode
  if (state.currentId) {
    const id = state.currentId;
    state.currentId = null;
    navigate(id);
  }
}

function init() {
  buildTabs();
  document.querySelectorAll('.mode-btn').forEach((b) => {
    b.onclick = () => setMode(b.dataset.mode);
  });

  // Pick initial game from hash or default
  const hashId = location.hash.replace(/^#/, '');
  const initial = GAMES.find((g) => g.id === hashId)?.id || GAMES[0].id;
  navigate(initial);

  window.addEventListener('hashchange', () => {
    const id = location.hash.replace(/^#/, '');
    if (id && id !== state.currentId) navigate(id);
  });
}

init();
