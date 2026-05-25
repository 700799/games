import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import { rngFor } from '../rng.js';

// Mastermind: crack the hidden colour code. Feedback after each guess —
// a black key peg for each peg of the right colour AND position, a white key
// peg for each peg of the right colour in the wrong position.
const PALETTE = [
  { id: 0, name: 'red',    css: '#ef476f' },
  { id: 1, name: 'orange', css: '#f78c2a' },
  { id: 2, name: 'yellow', css: '#ffd166' },
  { id: 3, name: 'green',  css: '#06d6a0' },
  { id: 4, name: 'blue',   css: '#118ab2' },
  { id: 5, name: 'purple', css: '#9b5de5' },
  { id: 6, name: 'pink',   css: '#ff8fab' },
  { id: 7, name: 'cyan',   css: '#48cae4' },
];

export function mastermind(shell, { getMode, seed = null, onResult = null }) {
  const mode = getMode();
  const SLOTS = mode === 'advanced' ? 5 : 4;
  const COLORS = mode === 'advanced' ? 8 : 6;
  const MAX_GUESSES = mode === 'advanced' ? 12 : 10;
  const colors = PALETTE.slice(0, COLORS);

  header(shell, {
    title: '🎯 Mastermind',
    tag: `${SLOTS} pegs · ${COLORS} colours · ${MAX_GUESSES} guesses · repeats allowed`,
    desc: 'Crack the hidden code. Tap a colour to drop it into the next slot of your current row (tap a placed peg to remove it), then press Check. ● = right colour & spot, ○ = right colour, wrong spot.',
  });

  const tb = toolbar(shell);
  const leftSpan = el('span', {});
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ New code');
  tb.append(leftSpan, restartBtn);

  const s = status(shell);
  const boardEl = el('div', { class: 'mm-board' });
  shell.appendChild(boardEl);

  const paletteEl = el('div', { class: 'mm-palette' });
  shell.appendChild(paletteEl);

  const controls = el('div', { class: 'gt-row', style: { justifyContent: 'center', marginTop: '10px' } });
  const clearBtn = el('button', { class: 'btn ghost' }, 'Clear row');
  const checkBtn = el('button', { class: 'btn primary' }, '✓ Check');
  controls.append(clearBtn, checkBtn);
  shell.appendChild(controls);

  let code, guesses, current, row, over, won;

  function reset() {
    // Seeded → identical code on every reset (fair for challenges); else random.
    const rng = rngFor(seed);
    code = Array.from({ length: SLOTS }, () => Math.floor(rng() * COLORS));
    guesses = []; current = []; row = 0; over = false; won = false;
    renderBoard(); renderPalette();
    setStatus(s, `Guess the ${SLOTS}-colour code. ${MAX_GUESSES} tries.`);
    timers.resetGame();
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < MAX_GUESSES; r++) {
      const isActive = r === row && !over;
      const rowEl = el('div', { class: 'mm-row' + (isActive ? ' active' : '') });
      const pegsWrap = el('div', { class: 'mm-pegs' });
      const guess = guesses[r] || (r === row ? current : null);
      for (let i = 0; i < SLOTS; i++) {
        const val = guess ? guess[i] : undefined;
        const peg = el('div', {
          class: 'mm-peg' + (val == null ? ' empty' : ''),
          style: val != null ? { background: colors[val].css } : {},
          title: val != null ? colors[val].name : 'empty',
        });
        if (isActive) peg.onclick = () => removeAt(i);
        pegsWrap.appendChild(peg);
      }
      rowEl.appendChild(pegsWrap);
      // Feedback
      const fb = el('div', { class: 'mm-feedback' });
      if (guesses[r]) {
        const { black, white } = scoreGuess(guesses[r], code);
        for (let k = 0; k < black; k++) fb.appendChild(el('div', { class: 'mm-key black' }));
        for (let k = 0; k < white; k++) fb.appendChild(el('div', { class: 'mm-key white' }));
        const blanks = SLOTS - black - white;
        for (let k = 0; k < blanks; k++) fb.appendChild(el('div', { class: 'mm-key' }));
      } else {
        for (let k = 0; k < SLOTS; k++) fb.appendChild(el('div', { class: 'mm-key' }));
      }
      rowEl.appendChild(fb);
      boardEl.appendChild(rowEl);
    }
    leftSpan.textContent = `Guesses left: ${MAX_GUESSES - row}`;
  }

  function renderPalette() {
    paletteEl.innerHTML = '';
    colors.forEach((c) => {
      const btn = el('div', {
        class: 'mm-swatch', style: { background: c.css }, title: c.name,
      });
      btn.onclick = () => addColor(c.id);
      paletteEl.appendChild(btn);
    });
  }

  function addColor(id) {
    if (over) return;
    if (current.length >= SLOTS) { setStatus(s, 'Row full — press Check or remove a peg.', 'warn'); return; }
    current.push(id);
    renderBoard();
  }
  function removeAt(i) {
    if (over) return;
    if (i < current.length) { current.splice(i, 1); renderBoard(); }
  }
  function clearRow() { if (over) return; current = []; renderBoard(); }

  function scoreGuess(guess, secret) {
    let black = 0, white = 0;
    const codeRem = {}, guessRem = {};
    for (let i = 0; i < secret.length; i++) {
      if (guess[i] === secret[i]) black++;
      else {
        codeRem[secret[i]] = (codeRem[secret[i]] || 0) + 1;
        guessRem[guess[i]] = (guessRem[guess[i]] || 0) + 1;
      }
    }
    for (const c in guessRem) {
      if (codeRem[c]) white += Math.min(codeRem[c], guessRem[c]);
    }
    return { black, white };
  }

  function check() {
    if (over) return;
    if (current.length !== SLOTS) { setStatus(s, `Fill all ${SLOTS} slots first.`, 'warn'); return; }
    guesses[row] = current.slice();
    const { black } = scoreGuess(current, code);
    current = [];
    row++;
    if (black === SLOTS) {
      won = true; over = true;
      timers.stopGame();
      renderBoard();
      setStatus(s, `Cracked it in ${row} guess${row === 1 ? '' : 'es'}!`, 'good');
      if (onResult) onResult({ solved: true, moves: row, timeMs: timers.getGameElapsed(), score: 0 });
      else celebrate({
        gameName: 'Mastermind',
        gameTimeMs: timers.getGameElapsed(),
        totalTimeMs: timers.getTotalElapsed(),
        extra: `Solved in <b>${row}/${MAX_GUESSES}</b> guesses`,
      });
      return;
    }
    if (row >= MAX_GUESSES) {
      over = true;
      renderBoard();
      revealCode();
      setStatus(s, `Out of guesses! The code is shown above.`, 'bad');
      if (onResult) onResult({ solved: false, moves: row, timeMs: timers.getGameElapsed(), score: 0 });
      return;
    }
    renderBoard();
    setStatus(s, `${MAX_GUESSES - row} guess${MAX_GUESSES - row === 1 ? '' : 'es'} left.`);
  }

  function revealCode() {
    const rowEl = el('div', { class: 'mm-row reveal' });
    const pegsWrap = el('div', { class: 'mm-pegs' });
    code.forEach((v) => pegsWrap.appendChild(el('div', {
      class: 'mm-peg', style: { background: colors[v].css },
    })));
    rowEl.appendChild(pegsWrap);
    rowEl.appendChild(el('div', { class: 'mm-feedback' }, [el('span', { class: 'game-tag' }, 'code')]));
    boardEl.prepend(rowEl);
  }

  const onKey = (e) => {
    if (e.key === 'Enter') { check(); e.preventDefault(); }
    else if (e.key === 'Backspace') { removeAt(current.length - 1); e.preventDefault(); }
    else if (/^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < COLORS) addColor(idx);
    }
  };
  window.addEventListener('keydown', onKey);

  clearBtn.onclick = clearRow;
  checkBtn.onclick = check;
  restartBtn.onclick = reset;
  reset();

  return () => window.removeEventListener('keydown', onKey);
}
