// Funny win celebration with elephant, pig, bear. Animation lasts ~11 seconds.
import { formatMs } from './timer.js';

const CHEERS = [
  ['Trumpetastic!', 'Squee-tastic!', 'Bear-illiant!'],
  ['Unbe-leaf-able!', 'Oink yeah!', 'Pawsome!'],
  ['Tusk-tastic!', 'Hog-wild!', 'Grizzly good!'],
  ['Snorting smart!', 'Snout standing!', 'Beary impressive!'],
  ['Pachy-derm prodigy!', 'Hammy hero!', 'Honey of a brain!'],
];

const COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#7c3aed', '#fb7185', '#fbbf24', '#34d399'];

function spawnConfetti(host) {
  const root = host.querySelector('#confetti');
  root.innerHTML = '';
  const N = 90;
  for (let i = 0; i < N; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    p.style.animationDuration = `${2.4 + Math.random() * 3.6}s`;
    p.style.animationDelay = `${Math.random() * 1.5}s`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    if (Math.random() < 0.5) p.style.borderRadius = '50%';
    root.appendChild(p);
  }
}

let activeTimer = null;

export function celebrate({ gameName, gameTimeMs, totalTimeMs, extra }) {
  const host = document.getElementById('celebration');
  const stats = document.getElementById('cheer-stats');

  // Pick a random set of cheers
  const set = CHEERS[Math.floor(Math.random() * CHEERS.length)];
  host.querySelector('.elephant .speech').textContent = set[0];
  host.querySelector('.pig .speech').textContent = set[1];
  host.querySelector('.bear .speech').textContent = set[2];

  const parts = [
    `🏆 <b>${gameName}</b> complete!`,
    `Game time: <b>${formatMs(gameTimeMs)}</b>`,
    `Session: <b>${formatMs(totalTimeMs)}</b>`,
  ];
  if (extra) parts.push(extra);
  stats.innerHTML = parts.join('  •  ');

  spawnConfetti(host);
  host.classList.remove('hidden');
  host.setAttribute('aria-hidden', 'false');

  // Restart the character animations by re-adding nodes
  host.querySelectorAll('.cheer-character').forEach((el) => {
    el.style.animation = 'none';
    // force reflow
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.style.animation = '';
  });

  if (activeTimer) clearTimeout(activeTimer);
  // Animation duration: ~11 seconds (in the 10-12s window).
  activeTimer = setTimeout(() => dismiss(), 11000);

  // Click to dismiss early
  host.onclick = () => dismiss();
}

export function dismiss() {
  const host = document.getElementById('celebration');
  host.classList.add('hidden');
  host.setAttribute('aria-hidden', 'true');
  host.onclick = null;
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
}
