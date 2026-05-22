import { el, header, toolbar, status, setStatus } from '../helpers.js';
import { celebrate } from '../celebration.js';
import { timers } from '../timer.js';
import { ANAGRAM_SET, ANAGRAM_WORDS } from '../data/words.js';

// Pick a "pangram" — a word using all letters of a given length — as the rack.
// Then collect every word ≥3 letters formable from those letters (each letter once).
export function anagrams(shell, { getMode }) {
  const mode = getMode();
  const RACK_SIZE = mode === 'advanced' ? 7 : 6;
  const MIN_LEN = 3;

  header(shell, {
    title: '🔤 Anagrams',
    tag: `${RACK_SIZE} letters · find ≥3-letter words`,
    desc: `Tap letters to build a word, then SUBMIT. Each letter can be used at most once per word. Find ${mode === 'advanced' ? '70%' : '50%'} of the possible words to win.`,
  });

  // Build a rack by sampling a real word, then computing all valid sub-anagrams.
  const candidates = ANAGRAM_WORDS.filter((w) => w.length === RACK_SIZE && new Set(w).size === RACK_SIZE);
  let rackWord = candidates[Math.floor(Math.random() * candidates.length)];
  let rackLetters = rackWord.toUpperCase().split('');
  // Shuffle the letters
  rackLetters = rackLetters.sort(() => Math.random() - 0.5);

  const allWords = findAllWords(rackLetters);
  const targetPct = mode === 'advanced' ? 0.70 : 0.50;
  const targetCount = Math.max(3, Math.ceil(allWords.size * targetPct));

  const tb = toolbar(shell);
  const restartBtn = el('button', { class: 'btn ghost' }, '↺ New rack');
  const shuffleBtn = el('button', { class: 'btn ghost' }, '🔀 Shuffle');
  const progress = el('span', { class: 'game-tag' });
  tb.append(progress, shuffleBtn, restartBtn);

  const s = status(shell);

  const inputRow = el('div', { class: 'anagrams-input' });
  shell.appendChild(inputRow);

  const lettersRow = el('div', { class: 'anagrams-letters' });
  shell.appendChild(lettersRow);

  const controls = el('div', { class: 'gt-row', style: { marginTop: '12px', justifyContent: 'center' } });
  const clearBtn = el('button', { class: 'btn ghost' }, 'Clear');
  const submitBtn = el('button', { class: 'btn primary' }, 'Submit');
  controls.append(clearBtn, submitBtn);
  shell.appendChild(controls);

  shell.appendChild(el('h3', { style: { marginTop: '12px' } }, 'Found words'));
  const foundList = el('div', { class: 'anagrams-found' });
  shell.appendChild(foundList);

  let used, // letter indices used in current input
      currentLetters,
      found;

  function reset() {
    used = []; found = new Set();
    rackLetters = rackLetters.sort(() => Math.random() - 0.5);
    renderAll();
    setStatus(s, `Tap letters to build a word. Find ${targetCount} of ${allWords.size} words to win.`);
    timers.resetGame();
  }

  function renderAll() {
    renderInput(); renderLetters(); renderFound();
    progress.textContent = `Found ${found.size} / ${targetCount} (of ${allWords.size})`;
  }

  function renderInput() {
    inputRow.innerHTML = '';
    used.forEach((idx) => {
      inputRow.appendChild(el('div', { class: 'anagram-tile' }, rackLetters[idx]));
    });
    if (used.length === 0) inputRow.appendChild(el('div', { class: 'game-tag' }, 'Tap letters below'));
  }

  function renderLetters() {
    lettersRow.innerHTML = '';
    rackLetters.forEach((ch, idx) => {
      const cls = 'anagram-letter' + (used.includes(idx) ? ' used' : '');
      const tile = el('div', { class: cls }, ch);
      tile.onclick = () => {
        if (used.includes(idx)) return;
        used.push(idx);
        renderInput(); renderLetters();
      };
      lettersRow.appendChild(tile);
    });
  }

  function renderFound() {
    foundList.innerHTML = '';
    [...found].sort((a, b) => b.length - a.length || a.localeCompare(b)).forEach((w) => {
      foundList.appendChild(el('div', { class: 'word' }, w));
    });
  }

  function getWord() {
    return used.map((i) => rackLetters[i]).join('').toLowerCase();
  }

  function clear() {
    used = []; renderInput(); renderLetters();
  }

  function submit() {
    const w = getWord();
    if (w.length < MIN_LEN) { setStatus(s, `Words must be at least ${MIN_LEN} letters.`, 'warn'); return; }
    if (found.has(w.toUpperCase())) { setStatus(s, `Already found "${w.toUpperCase()}".`, 'warn'); clear(); return; }
    if (!ANAGRAM_SET.has(w)) { setStatus(s, `"${w.toUpperCase()}" isn't in our dictionary.`, 'bad'); clear(); return; }
    if (!allWords.has(w)) { setStatus(s, `"${w.toUpperCase()}" — not from these letters.`, 'bad'); clear(); return; }
    found.add(w.toUpperCase());
    setStatus(s, `Found "${w.toUpperCase()}"! +${w.length} pts`, 'good');
    clear(); renderFound(); progress.textContent = `Found ${found.size} / ${targetCount} (of ${allWords.size})`;
    if (found.size >= targetCount) finish();
  }

  function finish() {
    timers.stopGame();
    setStatus(s, `Reached ${found.size} / ${targetCount} words!`, 'good');
    celebrate({
      gameName: 'Anagrams',
      gameTimeMs: timers.getGameElapsed(),
      totalTimeMs: timers.getTotalElapsed(),
      extra: `Found <b>${found.size}</b> of <b>${allWords.size}</b> possible`,
    });
  }

  clearBtn.onclick = clear;
  submitBtn.onclick = submit;
  shuffleBtn.onclick = () => { rackLetters = rackLetters.sort(() => Math.random() - 0.5); renderLetters(); };
  restartBtn.onclick = () => location.hash = location.hash; // remount via app router

  const onKey = (e) => {
    if (e.key === 'Enter') { submit(); e.preventDefault(); }
    else if (e.key === 'Backspace') { used.pop(); renderInput(); renderLetters(); e.preventDefault(); }
    else if (/^[a-zA-Z]$/.test(e.key)) {
      const ch = e.key.toUpperCase();
      // Find first unused matching letter
      for (let i = 0; i < rackLetters.length; i++) {
        if (rackLetters[i] === ch && !used.includes(i)) { used.push(i); renderInput(); renderLetters(); return; }
      }
    }
  };
  window.addEventListener('keydown', onKey);

  reset();
  return () => window.removeEventListener('keydown', onKey);
}

function findAllWords(rack) {
  // Return set of valid lowercase words formable using each rack letter at most once.
  const rackLower = rack.map((c) => c.toLowerCase());
  const counts = {};
  rackLower.forEach((c) => counts[c] = (counts[c] || 0) + 1);
  const set = new Set();
  for (const w of ANAGRAM_WORDS) {
    if (w.length < 3 || w.length > rack.length) continue;
    const local = { ...counts };
    let ok = true;
    for (const ch of w) {
      if (!local[ch]) { ok = false; break; }
      local[ch]--;
    }
    if (ok) set.add(w);
  }
  return set;
}
