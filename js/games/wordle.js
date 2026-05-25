import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import { FIVE_SET, FIVE_COMMON } from '../data/words.js';
import { rngFor } from '../rng.js';

export function wordle(shell, { getMode, seed = null, onResult = null }) {
  const mode = getMode();
  const MAX_TRIES = mode === 'advanced' ? 6 : 7;
  let target;

  header(shell, {
    title: '🟩 Wordle',
    tag: `5-letter word · ${MAX_TRIES} guesses`,
    desc: 'Guess the 5-letter word. After each guess, tiles turn 🟩 green (correct spot), 🟨 yellow (in word, wrong spot), or ⬜ gray (not in word). Use the on-screen keyboard or your keyboard.',
  });

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ New word');
  tb.append(restartBtn);

  const s = status(shell);
  const grid = el('div', { class: 'wordle-grid' });
  shell.appendChild(grid);
  const keyboard = el('div', { class: 'wordle-keyboard' });
  shell.appendChild(keyboard);

  let guesses, current, won, over, keyState;
  function reset() {
    // Seeded → same word each reset (fair for challenges); else a fresh word.
    const rng = rngFor(seed);
    target = FIVE_COMMON[Math.floor(rng() * FIVE_COMMON.length)].toUpperCase();
    guesses = []; current = ''; won = false; over = false;
    keyState = {};
    renderGrid(); renderKeyboard();
    setStatus(s, 'Type a 5-letter word, then press ENTER.');
    timers.resetGame();
  }

  function renderGrid() {
    grid.innerHTML = '';
    for (let r = 0; r < MAX_TRIES; r++) {
      const row = el('div', { class: 'wordle-row' });
      const word = guesses[r] || (r === guesses.length ? current : '');
      const colors = guesses[r] ? scoreWord(guesses[r], target) : null;
      for (let c = 0; c < 5; c++) {
        const ch = word[c] || '';
        const cls = 'wordle-cell'
          + (ch ? ' filled' : '')
          + (colors ? ' ' + colors[c] : '');
        row.appendChild(el('div', { class: cls }, ch));
      }
      grid.appendChild(row);
    }
  }

  function renderKeyboard() {
    keyboard.innerHTML = '';
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    rows.forEach((rowChars, i) => {
      const row = el('div', { class: 'wordle-krow' });
      if (i === 2) {
        const enterKey = el('button', { class: 'wordle-key wide' }, 'ENTER');
        enterKey.onclick = () => commit();
        row.appendChild(enterKey);
      }
      rowChars.split('').forEach((ch) => {
        const key = el('button', {
          class: 'wordle-key' + (keyState[ch] ? ' ' + keyState[ch] : ''),
        }, ch);
        key.onclick = () => typeChar(ch);
        row.appendChild(key);
      });
      if (i === 2) {
        const backKey = el('button', { class: 'wordle-key wide' }, '⌫');
        backKey.onclick = () => backspace();
        row.appendChild(backKey);
      }
      keyboard.appendChild(row);
    });
  }

  function scoreWord(guess, tgt) {
    const colors = Array(5).fill('gray');
    const tgtArr = tgt.split('');
    // First pass: greens
    for (let i = 0; i < 5; i++) {
      if (guess[i] === tgtArr[i]) {
        colors[i] = 'green';
        tgtArr[i] = null;
      }
    }
    // Second pass: yellows
    for (let i = 0; i < 5; i++) {
      if (colors[i] === 'green') continue;
      const idx = tgtArr.indexOf(guess[i]);
      if (idx >= 0) { colors[i] = 'yellow'; tgtArr[idx] = null; }
    }
    return colors;
  }

  function typeChar(ch) {
    if (over) return;
    if (current.length >= 5) return;
    current = current + ch;
    renderGrid();
  }
  function backspace() {
    if (over) return;
    if (current.length === 0) return;
    current = current.slice(0, -1);
    renderGrid();
  }
  function commit() {
    if (over) return;
    if (current.length !== 5) { setStatus(s, 'Need 5 letters.', 'warn'); return; }
    if (!FIVE_SET.has(current.toLowerCase())) {
      setStatus(s, `"${current}" isn't in the word list.`, 'bad');
      return;
    }
    guesses.push(current);
    const colors = scoreWord(current, target);
    // Update key colors (highest priority: green > yellow > gray)
    for (let i = 0; i < 5; i++) {
      const ch = current[i], c = colors[i];
      const cur = keyState[ch];
      if (c === 'green' || (c === 'yellow' && cur !== 'green') || (!cur && c === 'gray')) {
        keyState[ch] = c;
      }
    }
    const guessed = current;
    current = '';
    renderGrid(); renderKeyboard();
    if (guessed === target) {
      won = true; over = true;
      timers.stopGame();
      setStatus(s, `Got it! "${target}" in ${guesses.length} guess${guesses.length===1?'':'es'}.`, 'good');
      if (onResult) onResult({ solved: true, moves: guesses.length, timeMs: timers.getGameElapsed(), score: 0 });
      else celebrate({
        gameName: 'Wordle',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Solved in <b>${guesses.length}/${MAX_TRIES}</b>`,
      });
    } else if (guesses.length >= MAX_TRIES) {
      over = true;
      setStatus(s, `Out of guesses. The word was <b>${target}</b>.`, 'bad');
      if (onResult) onResult({ solved: false, moves: guesses.length, timeMs: timers.getGameElapsed(), score: 0 });
    } else {
      setStatus(s, `${MAX_TRIES - guesses.length} guess${MAX_TRIES - guesses.length===1?'':'es'} left.`);
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter') { commit(); e.preventDefault(); }
    else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
    else if (/^[a-zA-Z]$/.test(e.key)) typeChar(e.key.toUpperCase());
  };
  window.addEventListener('keydown', onKey);

  restartBtn.onclick = () => reset();
  reset();

  return () => window.removeEventListener('keydown', onKey);
}
