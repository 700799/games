// ============================================================================
// Party Arcade — shared framework for the 10 Mario-Party-style minigames.
//
// A single "🎉 Party" tab mounts a colourful HUB of minigame cards. Picking a
// card opens that minigame's flow:
//
//     INTRO  →  (🎮 Practice round, replayable, nothing counts)
//            →  (🏁 Start Challenge, scored run)
//            →  RESULTS  (stars, score, NEW BEST!, confetti)  →  back to INTRO/HUB
//
// Every minigame is a plain object:
//   { id, name, icon, color, blurb, goal, controls, howto:[...], run }
// where run(stage, opts) builds the game into `stage` and calls opts.onDone(res)
// exactly once when the round ends. It returns a teardown function that cancels
// any timers / animation frames / global listeners.
//
//   opts = { rng, practice, mode, rivals, ui:{setScore,setInfo}, onDone }
//   res  = { score, stars, win, detail, place }   (score: higher = better)
// ============================================================================
import { el } from '../../helpers.js';
import { celebrate } from '../../celebration.js';
import { timers } from '../../timer.js';
import { rngFor, makeSeed } from '../../rng.js';
import * as auth from '../../auth.js';

/* ----------------------------- CPU rivals -------------------------------- */
// Original party characters (no trademarked names) used as your opponents.
export const RIVALS = [
  { name: 'Coco',    emoji: '🐵' },
  { name: 'Tygo',    emoji: '🐯' },
  { name: 'Pip',     emoji: '🐧' },
  { name: 'Bruno',   emoji: '🐻' },
  { name: 'Fenn',    emoji: '🦊' },
  { name: 'Hopper',  emoji: '🐸' },
  { name: 'Otto',    emoji: '🦉' },
  { name: 'Inky',    emoji: '🐙' },
  { name: 'Bandit',  emoji: '🦝' },
  { name: 'Biscuit', emoji: '🐰' },
];
export const PLAYER = { name: 'You', emoji: '😎' };

export function pickRivals(rng, n) {
  const pool = RIVALS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/* ------------------------------ utilities -------------------------------- */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Pointer/touch position relative to an element's top-left.
export function localPoint(node, e) {
  const r = node.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: cx - r.left, y: cy - r.top, w: r.width, h: r.height };
}

// Map a raw score to 0–3 stars using ascending thresholds [s1, s2, s3].
export function starsFor(score, [s1, s2, s3]) {
  if (score >= s3) return 3;
  if (score >= s2) return 2;
  if (score >= s1) return 1;
  return 0;
}

/* --------------------------- best-score store ---------------------------- */
const bestKey = (id, mode) => `ba_party_best_${id}_${mode}`;
export function getBest(id, mode) { return +(localStorage.getItem(bestKey(id, mode)) || 0); }
export function setBest(id, mode, score) {
  const cur = getBest(id, mode);
  if (score > cur) { try { localStorage.setItem(bestKey(id, mode), String(score)); } catch (e) { /* ignore */ } return true; }
  return false;
}

/* --------------------------------- hub ----------------------------------- */
function buildHub(games, mode, onPick) {
  const wrap = el('div', { class: 'party-hub' });

  wrap.appendChild(el('div', { class: 'party-hero' }, [
    el('div', { class: 'party-hero-emojis' }, '🎲 🎮 ⭐ 🎉 🍄'),
    el('h2', { class: 'party-hero-title' }, 'Party Arcade'),
    el('p', { class: 'party-hero-sub' },
      'Ten bite-sized party minigames. Warm up with a free Practice round, then hit ' +
      'Start Challenge for a scored run and chase 3 ⭐ — beat your best and bank party points!'),
  ]));

  const grid = el('div', { class: 'party-grid' });
  games.forEach((g, i) => {
    const best = getBest(g.id, mode);
    const card = el('button', {
      class: 'party-card',
      style: { borderColor: g.color, boxShadow: `0 10px 26px rgba(0,0,0,.35), inset 0 0 0 1px ${g.color}55` },
    }, [
      el('span', { class: 'party-card-badge', style: { background: g.color } }, String(i + 1)),
      el('span', { class: 'party-card-icon' }, g.icon),
      el('span', { class: 'party-card-name' }, g.name),
      el('span', { class: 'party-card-blurb' }, g.blurb),
      el('span', { class: 'party-card-best' },
        best > 0 ? `★ Best: ${best}` : 'Tap to play'),
    ]);
    card.style.setProperty('--card-accent', g.color);
    card.onclick = () => onPick(g);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);

  wrap.appendChild(el('p', { class: 'party-foot-note' },
    'Tip: switch the top toggle to Advanced for tougher, longer rounds. Every game keeps its own ⭐ best score.'));
  return wrap;
}

/* ----------------------------- the Party tab ----------------------------- */
export function makePartyHub(games) {
  return function partyMode(shell, { getMode }) {
    const root = el('div', { class: 'party-root' });
    shell.appendChild(root);

    let roundTeardown = null;   // teardown of the live minigame, if any
    let pending = [];           // pending countdown timeouts
    let roundToken = null;      // identifies the live round; stray callbacks check it

    function stop() {
      roundToken = null;        // invalidate any in-flight onDone from the old round
      if (roundTeardown) { try { roundTeardown(); } catch (e) { console.error(e); } roundTeardown = null; }
      pending.forEach(clearTimeout); pending = [];
      timers.stopGame();
    }
    const mode = () => getMode();

    /* ---- HUB ---- */
    function showHub() {
      stop();
      root.innerHTML = '';
      root.appendChild(buildHub(games, mode(), showIntro));
    }

    /* ---- INTRO ---- */
    function showIntro(g) {
      stop();
      root.innerHTML = '';
      const m = mode();
      const best = getBest(g.id, m);

      const back = el('button', { class: 'party-back' }, '← All minigames');
      back.onclick = showHub;

      const practiceBtn = el('button', { class: 'party-btn ghost big' }, '🎮 Practice round');
      practiceBtn.onclick = () => startRound(g, true);
      const challengeBtn = el('button', { class: 'party-btn primary big' }, '🏁 Start Challenge');
      challengeBtn.onclick = () => startRound(g, false);

      const card = el('div', { class: 'party-screen', style: { '--accent': g.color } }, [
        back,
        el('div', { class: 'party-screen-head' }, [
          el('span', { class: 'party-screen-icon', style: { background: g.color } }, g.icon),
          el('div', {}, [
            el('h2', { class: 'party-screen-title' }, g.name),
            el('div', { class: 'party-screen-goal' }, g.goal),
          ]),
        ]),
        el('div', { class: 'party-howto' }, [
          el('h3', {}, 'How to play'),
          el('ul', {}, g.howto.map((line) => el('li', {}, line))),
          el('div', { class: 'party-controls' }, [
            el('span', { class: 'party-chip' }, `🎮 ${g.controls}`),
            el('span', { class: 'party-chip' }, m === 'advanced' ? '🔥 Advanced' : '🟢 Quick'),
            el('span', { class: 'party-chip' }, best > 0 ? `⭐ Best: ${best}` : '⭐ No score yet'),
          ]),
        ]),
        el('div', { class: 'party-practice-callout' },
          'New here? Take a 🎮 Practice round first — it never counts. When you feel ready, hit 🏁 Start Challenge to play for stars.'),
        el('div', { class: 'party-actions' }, [practiceBtn, challengeBtn]),
      ]);
      // set CSS custom property for accent (Object.assign can't set --vars)
      card.style.setProperty('--accent', g.color);
      root.appendChild(card);
    }

    /* ---- COUNTDOWN ---- */
    function countdown(stage, go) {
      const ov = el('div', { class: 'party-countdown' });
      stage.appendChild(ov);
      const seq = ['3', '2', '1', 'GO!'];
      let i = 0;
      const step = () => {
        if (i >= seq.length) { ov.remove(); go(); return; }
        ov.textContent = seq[i];
        ov.classList.toggle('go', seq[i] === 'GO!');
        ov.classList.remove('pop'); void ov.offsetWidth; ov.classList.add('pop');
        const dur = seq[i] === 'GO!' ? 550 : 650;
        i++;
        pending.push(setTimeout(step, dur));
      };
      step();
    }

    /* ---- PLAY ---- */
    function startRound(g, practice) {
      stop();
      root.innerHTML = '';
      const token = (roundToken = {});   // unique to this round
      const m = mode();
      const rng = rngFor(makeSeed());
      const rivals = pickRivals(rng, 3);

      const scoreEl = el('div', { class: 'party-hud-score' }, '');
      const infoEl = el('div', { class: 'party-hud-info' }, g.name);
      const quit = el('button', { class: 'party-quit' }, '✕ Quit');
      quit.onclick = () => showIntro(g);
      const hud = el('div', { class: 'party-hud' }, [
        el('div', { class: 'party-hud-tag', style: { background: g.color } },
          practice ? '🎮 PRACTICE' : '🏁 CHALLENGE'),
        scoreEl, infoEl, quit,
      ]);
      const stage = el('div', { class: 'party-stage' });
      const play = el('div', { class: 'party-play', style: { '--accent': g.color } }, [hud, stage]);
      play.style.setProperty('--accent', g.color);
      root.appendChild(play);

      const ui = {
        setScore: (html) => { scoreEl.innerHTML = html; },
        setInfo: (html) => { infoEl.innerHTML = html; },
      };

      countdown(stage, () => {
        if (roundToken !== token) return;   // quit during the countdown
        timers.resetGame();
        let fired = false;
        const td = g.run(stage, {
          rng, practice, mode: m, rivals, ui,
          onDone: (res) => {
            // ignore stray callbacks from a round the player already left
            if (fired || roundToken !== token) return;
            fired = true;
            timers.stopGame();
            finishRound(g, practice, res || {});
          },
        });
        roundTeardown = typeof td === 'function' ? td : () => {};
      });
    }

    /* ---- RESULTS ---- */
    function finishRound(g, practice, res) {
      const m = mode();
      const score = Math.max(0, Math.round(res.score || 0));
      const stars = clamp(res.stars != null ? res.stars : 0, 0, 3);
      let isBest = false;
      if (!practice) {
        isBest = setBest(g.id, m, score);
        if (isBest) auth.addPoints(10 + stars * 10);
        if (res.place != null) auth.recordOutcome(res.win ? 'win' : 'loss');
      }
      showResults(g, practice, { ...res, score, stars }, isBest);

      if (!practice && (res.win || stars >= 2 || isBest)) {
        celebrate({
          gameName: g.name,
          gameTimeMs: timers.getGameElapsed(),
          totalTimeMs: timers.getTotalElapsed(),
          extra: `${'⭐'.repeat(Math.max(1, stars))}  Score: <b>${score}</b>${isBest ? '  ·  NEW BEST!' : ''}`,
        });
      }
    }

    function showResults(g, practice, res, isBest) {
      stop();
      root.innerHTML = '';
      const m = mode();
      const best = getBest(g.id, m);

      const starRow = el('div', { class: 'party-stars' },
        [0, 1, 2].map((i) => el('span', { class: 'party-star' + (i < res.stars ? ' lit' : '') }, '★')));

      const headline = practice
        ? 'Practice complete!'
        : res.win ? '🏆 Winner!'
          : res.stars >= 2 ? 'Great run!'
            : res.stars === 1 ? 'Nice!' : 'Round over';

      const playAgain = el('button', { class: 'party-btn primary big' },
        practice ? '🏁 Start Challenge' : '🏁 Play again');
      playAgain.onclick = () => startRound(g, false);
      const prac = el('button', { class: 'party-btn ghost big' },
        practice ? '🎮 Practice again' : '🎮 Practice');
      prac.onclick = () => startRound(g, true);
      const board = el('button', { class: 'party-btn ghost big' }, '🎲 Party board');
      board.onclick = showHub;

      const card = el('div', { class: 'party-screen results', style: { '--accent': g.color } }, [
        el('span', { class: 'party-screen-icon', style: { background: g.color, margin: '0 auto' } }, g.icon),
        el('h2', { class: 'party-result-headline' }, headline),
        practice ? null : starRow,
        el('div', { class: 'party-result-score' }, `Score: ${res.score}`),
        res.detail ? el('div', { class: 'party-result-detail' }, res.detail) : null,
        practice
          ? el('div', { class: 'party-result-best' }, 'This was practice — your score did not count. Ready for the real thing?')
          : el('div', { class: 'party-result-best' + (isBest ? ' newbest' : '') },
            isBest ? '🎉 NEW BEST SCORE!' : `Your best: ${best}`),
        el('div', { class: 'party-actions' }, [playAgain, prac, board]),
      ]);
      card.style.setProperty('--accent', g.color);
      root.appendChild(card);
    }

    showHub();
    return () => stop();
  };
}
