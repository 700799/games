// Async same-seed challenge logic (host-agnostic, pure).
// A challenge encodes { game, mode, seed, by (name), result } so both players
// face the identical puzzle; the better result wins 100 points.

// Games that support head-to-head: each declares how results compare.
//   metric 'lessMoves'  → fewer moves wins, tiebreak faster time
//   metric 'moreScore'  → higher score wins, tiebreak faster time
export const CHALLENGEABLE = {
  'hanoi':       { label: 'Tower of Hanoi', metric: 'lessMoves', unit: 'moves' },
  'fifteen':     { label: '15-Puzzle',      metric: 'lessMoves', unit: 'moves' },
  'lights-out':  { label: 'Lights Out',     metric: 'lessMoves', unit: 'moves' },
  'mastermind':  { label: 'Mastermind',     metric: 'lessMoves', unit: 'guesses' },
  'wordle':      { label: 'Wordle',         metric: 'lessMoves', unit: 'guesses' },
  'speed-chess': { label: 'Speed Mates',    metric: 'moreScore', unit: 'pts' },
};

export const POINTS_PER_WIN = 100;

// Compare two results for a given game.
// result = { solved:boolean, moves:number, timeMs:number, score:number }
// Returns 1 if A wins, -1 if B wins, 0 draw.
export function compareResults(gameId, a, b) {
  const meta = CHALLENGEABLE[gameId];
  if (!meta) return 0;
  // Solved beats unsolved.
  if (a.solved !== b.solved) return a.solved ? 1 : -1;
  if (!a.solved && !b.solved) return 0; // neither solved → draw
  if (meta.metric === 'lessMoves') {
    if (a.moves !== b.moves) return a.moves < b.moves ? 1 : -1;
  } else { // moreScore
    if ((a.score || 0) !== (b.score || 0)) return (a.score || 0) > (b.score || 0) ? 1 : -1;
  }
  // Tiebreak: faster time.
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? 1 : -1;
  return 0;
}

export function describeResult(gameId, r) {
  const meta = CHALLENGEABLE[gameId];
  if (!r) return '—';
  if (!r.solved) return 'did not finish';
  if (!meta) return 'done';
  if (meta.metric === 'moreScore') return `${r.score} ${meta.unit} (${fmtTime(r.timeMs)})`;
  return `${r.moves} ${meta.unit} (${fmtTime(r.timeMs)})`;
}

function fmtTime(ms) {
  const t = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// ---- URL-safe encode/decode of a challenge payload ----
export function encodeChallenge(obj) {
  const json = JSON.stringify(obj);
  return base64UrlEncode(json);
}
export function decodeChallenge(str) {
  try {
    return JSON.parse(base64UrlDecode(str));
  } catch {
    return null;
  }
}

function base64UrlEncode(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}
