// Seedable PRNG so a challenge can hand both players the identical puzzle.
// mulberry32 — small, fast, good enough for game shuffles.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a random() compatible fn: seeded when a seed is given, else Math.random.
export function rngFor(seed) {
  return seed == null ? Math.random : mulberry32(seed);
}

export function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeSeed() {
  return (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
}
