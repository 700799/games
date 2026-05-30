// App shell: tabs, routing via location.hash, mode toggle, and game lifecycle.
import { timers } from './timer.js';
import { dismiss as dismissCheer } from './celebration.js';
import { el } from './helpers.js';
import * as auth from './auth.js';
import {
  CHALLENGEABLE, POINTS_PER_WIN, compareResults, describeResult,
  encodeChallenge, decodeChallenge,
} from './challenges.js';
import { makeSeed } from './rng.js';
import { strategyFor } from './data/strategies.js';

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
import { match } from './games/match.js';
import { poker } from './games/poker.js';
import { pokerScenarios } from './games/poker-scenarios.js';

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
  { id: 'match',           icon: '🧠', name: 'Memory Match',          mount: match },
  { id: 'poker',           icon: '🃏', name: 'Heads-Up Poker',        mount: poker },
  { id: 'poker-scenarios', icon: '🎓', name: 'Poker Scenarios',       mount: pokerScenarios },
];

const state = {
  mode: 'quick',
  currentId: null,
  currentTeardown: null,
  activeChallenge: null, // suppresses normal hashchange re-mount during a challenge
};

function buildTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  GAMES.forEach((g, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.id = g.id;
    btn.innerHTML = `<span>${g.icon}</span><span class="tab-num">${idx + 1}.</span><span>${g.name}</span>`;
    btn.onclick = () => { state.activeChallenge = null; navigate(g.id); };
    nav.appendChild(btn);
  });
}

// opts: { seed, onResult, force }
function navigate(id, opts = {}) {
  if (state.currentId === id && !opts.force) return;
  if (state.currentTeardown) {
    try { state.currentTeardown(); } catch (e) { console.error(e); }
    state.currentTeardown = null;
  }
  dismissCheer();

  state.currentId = id;
  history.replaceState(null, '', `#${id}`);

  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.id === id);
  });

  const game = GAMES.find((g) => g.id === id) || GAMES[0];
  const area = document.getElementById('game-area');
  area.innerHTML = '';
  const shell = document.createElement('section');
  shell.className = 'game-shell';
  area.appendChild(shell);

  timers.resetGame();
  state.currentTeardown = game.mount(shell, {
    mode: state.mode,
    getMode: () => state.mode,
    seed: opts.seed ?? null,
    onResult: opts.onResult ?? null,
  });

  area.focus({ preventScroll: true });
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  state.activeChallenge = null; // changing difficulty leaves any challenge
  if (state.currentId) {
    const id = state.currentId;
    state.currentId = null;
    navigate(id);
  }
}

/* ------------------------------------------------------------------ */
/* Profile chip + sign-in menu                                         */
/* ------------------------------------------------------------------ */
function renderUserArea() {
  const host = document.getElementById('user-area');
  if (!host) return;
  const me = auth.getIdentity();
  host.innerHTML = '';
  const chip = el('button', { class: 'profile-chip', title: 'Account & points' }, [
    el('span', { class: 'avatar' }, me.isGuest ? '👤' : '🧠'),
    el('span', { class: 'who' }, [
      el('span', { class: 'uname' }, me.name),
      el('span', { class: 'upts' }, `★ ${me.points} pts`),
    ]),
  ]);
  chip.onclick = (e) => { e.stopPropagation(); openUserMenu(chip); };
  host.appendChild(chip);
}

function openUserMenu(anchor) {
  closeMenus();
  const me = auth.getIdentity();
  const menu = el('div', { class: 'menu' });

  menu.appendChild(el('div', { class: 'menu-head' }, [
    el('div', {}, me.name),
    el('div', { class: 'menu-sub' }, `★ ${me.points} pts · ${me.wins}W / ${me.losses}L`),
  ]));

  const renameBtn = el('button', { class: 'menu-item' }, '✏️ Change display name');
  renameBtn.onclick = () => {
    const name = prompt('Display name:', me.name);
    if (name != null) auth.setName(name);
    closeMenus();
  };
  menu.appendChild(renameBtn);

  if (auth.realAuthAvailable()) {
    menu.appendChild(el('div', { class: 'menu-label' }, 'Sign in'));
    auth.PROVIDERS.forEach((p) => {
      const b = el('button', { class: 'menu-item' }, `Continue with ${p.label}`);
      b.onclick = async () => {
        closeMenus();
        try {
          if (p.id === 'email') return promptEmail();
          await auth.signIn(p.id);
        } catch (e) { toast('Sign-in failed: ' + (e.message || e)); }
      };
      menu.appendChild(b);
    });
    if (!me.isGuest) {
      const out = el('button', { class: 'menu-item danger' }, '↩ Sign out');
      out.onclick = async () => { closeMenus(); await auth.signOut(); };
      menu.appendChild(out);
    }
  } else {
    menu.appendChild(el('div', { class: 'menu-note' },
      'Playing as a local guest. Real Google/Apple/GitHub sign-in and cross-device points activate once Supabase is configured in js/config.js.'));
  }

  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
}

function promptEmail() {
  const email = prompt('Email:');
  if (!email) return;
  const password = prompt('Password (min 6 chars):');
  if (!password) return;
  const create = confirm('OK = create a new account, Cancel = sign in to an existing one');
  auth.signInEmail(email, password, create).catch((e) => toast('Email auth failed: ' + (e.message || e)));
}

function closeMenus() {
  document.querySelectorAll('.menu').forEach((m) => m.remove());
}

/* ------------------------------------------------------------------ */
/* Modal helper                                                        */
/* ------------------------------------------------------------------ */
function modal(children, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  const overlay = el('div', { class: 'modal-overlay' });
  const card = el('div', { class: 'modal-card' }, children);
  overlay.appendChild(card);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  root.appendChild(overlay);
  function close() { overlay.remove(); if (onClose) onClose(); }
  return { close, card };
}

function toast(msg) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ------------------------------------------------------------------ */
/* Strategy advisor — "how to win" for the current game                 */
/* ------------------------------------------------------------------ */
function openAdvisor() {
  const game = GAMES.find((g) => g.id === state.currentId) || GAMES[0];
  const strat = strategyFor(game.id);
  if (!strat) { toast('No advisor available for this game yet.'); return; }

  const sections = [
    el('h2', {}, `${game.icon} ${game.name} — Advisor`),
    el('div', { class: 'adv-goal' }, [el('b', {}, 'Goal: '), strat.goal]),
  ];
  if (strat.optimal) {
    sections.push(el('div', { class: 'adv-optimal' }, [el('b', {}, '★ Optimal play: '), strat.optimal]));
  }
  sections.push(el('div', { class: 'adv-section' }, [
    el('h4', {}, 'How to win'),
    el('ol', {}, strat.strategies.map((t) => el('li', {}, t))),
  ]));
  if (strat.mistakes && strat.mistakes.length) {
    sections.push(el('div', { class: 'adv-section' }, [
      el('h4', {}, 'Avoid'),
      el('ul', { class: 'adv-mistakes' }, strat.mistakes.map((t) => el('li', {}, t))),
    ]));
  }
  const closeBtn = el('button', { class: 'btn primary' }, 'Got it');
  const row = el('div', { class: 'gt-row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [closeBtn]);
  sections.push(row);

  const m = modal(sections);
  closeBtn.onclick = () => m.close();
}

/* ------------------------------------------------------------------ */
/* Head-to-head challenges (async same-seed race)                      */
/* ------------------------------------------------------------------ */
function openChallengePanel() {
  const games = Object.entries(CHALLENGEABLE);
  let pickedId = games[0][0];
  let pickedMode = state.mode;

  const gameSel = el('select', {},
    games.map(([id, meta]) => el('option', { value: id }, meta.label)));
  gameSel.value = pickedId;
  gameSel.onchange = () => { pickedId = gameSel.value; };

  const modeSel = el('select', {}, [
    el('option', { value: 'quick' }, 'Quick'),
    el('option', { value: 'advanced' }, 'Advanced'),
  ]);
  modeSel.value = pickedMode;
  modeSel.onchange = () => { pickedMode = modeSel.value; };

  const startBtn = el('button', { class: 'btn primary' }, 'Play my round →');
  const m = modal([
    el('h2', {}, '⚔️ Create a challenge'),
    el('p', { class: 'game-desc' },
      'Pick a game and difficulty, play your round, then share the link. Your friend plays the exact same puzzle — better result wins 100 points.'),
    el('div', { class: 'gt-row' }, [el('label', {}, 'Game: '), gameSel]),
    el('div', { class: 'gt-row', style: { marginTop: '8px' } }, [el('label', {}, 'Difficulty: '), modeSel]),
    el('div', { class: 'gt-row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, [startBtn]),
  ]);
  startBtn.onclick = () => { m.close(); startChallengeAsChallenger(pickedId, pickedMode); };
}

function startChallengeAsChallenger(gameId, mode) {
  const seed = makeSeed();
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  state.activeChallenge = { role: 'challenger', gameId, mode, seed };
  toast(`Your challenge round — ${CHALLENGEABLE[gameId].label} (${mode}). Finish to get a share link.`);
  navigate(gameId, {
    force: true,
    seed,
    onResult: (result) => {
      const me = auth.getIdentity();
      const payload = { v: 1, g: gameId, m: mode, s: seed, by: me.name, r: result };
      const link = location.origin + location.pathname + '#challenge=' + encodeChallenge(payload);
      showShareModal(gameId, result, link);
      state.activeChallenge = null;
    },
  });
}

function showShareModal(gameId, result, link) {
  const input = el('input', { type: 'text', readonly: 'readonly', value: link, class: 'share-link' });
  const copyBtn = el('button', { class: 'btn' }, '📋 Copy link');
  copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(link); copyBtn.textContent = '✓ Copied!'; }
    catch { input.select(); document.execCommand && document.execCommand('copy'); copyBtn.textContent = '✓ Copied!'; }
  };
  modal([
    el('h2', {}, '📨 Challenge ready!'),
    el('p', { class: 'game-desc' },
      `You scored ${describeResult(gameId, result)} at ${CHALLENGEABLE[gameId].label}. Send this link — whoever does better earns ${POINTS_PER_WIN} points.`),
    input,
    el('div', { class: 'gt-row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, [copyBtn]),
  ]);
}

function handleIncomingChallenge(payload) {
  if (!payload || !CHALLENGEABLE[payload.g]) { toast('That challenge link is invalid.'); return; }
  const meta = CHALLENGEABLE[payload.g];
  const playBtn = el('button', { class: 'btn primary' }, 'Accept & play →');
  const m = modal([
    el('h2', {}, '⚔️ You’ve been challenged!'),
    el('p', { class: 'game-desc' },
      `${payload.by || 'A friend'} challenges you at ${meta.label} (${payload.m}). ` +
      `Their result: ${describeResult(payload.g, payload.r)}. Play the same puzzle and beat it to win ${POINTS_PER_WIN} points!`),
    el('div', { class: 'gt-row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, [playBtn]),
  ]);
  playBtn.onclick = () => { m.close(); acceptChallenge(payload); };
}

function acceptChallenge(payload) {
  state.mode = payload.m;
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === payload.m));
  state.activeChallenge = { role: 'opponent', ...payload };
  toast(`Beat ${describeResult(payload.g, payload.r)} at ${CHALLENGEABLE[payload.g].label}!`);
  navigate(payload.g, {
    force: true,
    seed: payload.s,
    onResult: (result) => {
      state.activeChallenge = null;
      resolveChallenge(payload, result);
    },
  });
}

function resolveChallenge(payload, myResult) {
  const cmp = compareResults(payload.g, myResult, payload.r); // 1 = I win, -1 = they win, 0 = draw
  let title, body;
  if (cmp > 0) {
    auth.addPoints(POINTS_PER_WIN);
    auth.recordOutcome('win');
    title = '🏆 You win! +' + POINTS_PER_WIN + ' points';
    body = `You: ${describeResult(payload.g, myResult)} · ${payload.by || 'Opponent'}: ${describeResult(payload.g, payload.r)}`;
  } else if (cmp < 0) {
    auth.recordOutcome('loss');
    title = '🥈 So close!';
    body = `${payload.by || 'Opponent'} wins: ${describeResult(payload.g, payload.r)} · You: ${describeResult(payload.g, myResult)}`;
  } else {
    title = '🤝 Draw — no points';
    body = `Both: ${describeResult(payload.g, myResult)}`;
  }
  const rematchBtn = el('button', { class: 'btn primary' }, '⚔️ Send your own challenge');
  const m = modal([
    el('h2', {}, title),
    el('p', { class: 'game-desc' }, body),
    el('div', { class: 'gt-row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, [rematchBtn]),
  ]);
  rematchBtn.onclick = () => { m.close(); startChallengeAsChallenger(payload.g, payload.m); };
}

/* ------------------------------------------------------------------ */
/* Routing + init                                                      */
/* ------------------------------------------------------------------ */
function routeFromHash() {
  const raw = location.hash.replace(/^#/, '');
  if (raw.startsWith('challenge=')) {
    const payload = decodeChallenge(raw.slice('challenge='.length));
    // Clear the challenge param from the URL so a refresh doesn't re-trigger.
    history.replaceState(null, '', location.pathname);
    handleIncomingChallenge(payload);
    return true;
  }
  const id = GAMES.find((g) => g.id === raw)?.id;
  if (id) { navigate(id); return true; }
  return false;
}

async function init() {
  buildTabs();
  renderUserArea();
  auth.onChange(renderUserArea);

  document.querySelectorAll('.mode-btn').forEach((b) => {
    b.onclick = () => setMode(b.dataset.mode);
  });
  const challengeBtn = document.getElementById('challenge-btn');
  if (challengeBtn) challengeBtn.onclick = openChallengePanel;
  const advisorBtn = document.getElementById('advisor-btn');
  if (advisorBtn) advisorBtn.onclick = openAdvisor;

  // Bring up Supabase if configured, then consume any OAuth ?code= callback.
  await auth.initAuth();
  await auth.handleAuthCallback();

  // Initial route: a challenge link, a game hash, or the default game.
  if (!routeFromHash()) navigate(GAMES[0].id);

  window.addEventListener('hashchange', () => {
    if (state.activeChallenge) return; // don't fight an in-progress challenge
    const raw = location.hash.replace(/^#/, '');
    if (raw.startsWith('challenge=')) { routeFromHash(); return; }
    if (raw && raw !== state.currentId) navigate(raw);
  });
}

init();
