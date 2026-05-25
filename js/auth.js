// Identity + points façade.
//   - Default: LOCAL GUEST mode — name + points + head-to-head W/L in
//     localStorage. Fully functional offline; challenges work via share links.
//   - When js/config.js is filled in, a Supabase backend is loaded lazily and
//     takes over auth (Google/Apple/GitHub/Microsoft/Facebook/email + guest)
//     and cross-device points.
import { isConfigured } from './config.js';

const LS = {
  id: 'ba_id', name: 'ba_name', pts: 'ba_points', win: 'ba_wins', loss: 'ba_losses',
};

export const PROVIDERS = [
  { id: 'google',   label: 'Google' },
  { id: 'apple',    label: 'Apple' },
  { id: 'github',   label: 'GitHub' },
  { id: 'azure',    label: 'Microsoft' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'email',    label: 'Email' },
];

const listeners = new Set();
let sb = null;            // Supabase backend module, if loaded
let identity = readLocal();

function readLocal() {
  let id = localStorage.getItem(LS.id);
  if (!id) { id = 'guest-' + Math.random().toString(36).slice(2, 10); localStorage.setItem(LS.id, id); }
  return {
    id,
    name: localStorage.getItem(LS.name) || 'Guest',
    points: +(localStorage.getItem(LS.pts) || 0),
    wins: +(localStorage.getItem(LS.win) || 0),
    losses: +(localStorage.getItem(LS.loss) || 0),
    isGuest: true,
    avatar: null,
  };
}

function emit() { listeners.forEach((cb) => { try { cb(identity); } catch (e) { console.error(e); } }); }

export function onChange(cb) { listeners.add(cb); cb(identity); return () => listeners.delete(cb); }
export function getIdentity() { return identity; }
export function realAuthAvailable() { return isConfigured(); }

export function setName(name) {
  name = (name || '').trim().slice(0, 24) || 'Guest';
  localStorage.setItem(LS.name, name);
  identity = { ...identity, name };
  if (sb && !identity.isGuest) sb.updateName(name).catch(() => {});
  emit();
}

// Award points. Updates the local mirror immediately for a snappy UI; when a
// real (non-guest) Supabase session is active, also persists to the account and
// reconciles to the server's authoritative total.
export function addPoints(n) {
  const points = identity.points + n;
  localStorage.setItem(LS.pts, points);
  identity = { ...identity, points };
  emit();
  if (sb && !identity.isGuest) {
    sb.addPoints(n)
      .then((total) => { if (typeof total === 'number') { identity = { ...identity, points: total }; emit(); } })
      .catch((e) => console.error(e));
  }
  return points;
}

export function recordOutcome(kind) {
  if (kind === 'win') {
    const wins = identity.wins + 1; localStorage.setItem(LS.win, wins); identity = { ...identity, wins };
  } else if (kind === 'loss') {
    const losses = identity.losses + 1; localStorage.setItem(LS.loss, losses); identity = { ...identity, losses };
  }
  emit();
  if (sb && !identity.isGuest) sb.recordOutcome(kind).catch((e) => console.error(e));
}

export async function initAuth() {
  if (!isConfigured()) return;
  try {
    sb = await import('./supabase-backend.js');
    await sb.init();
    sb.onAuth((user) => {
      identity = user ? { ...readLocal(), ...user } : readLocal();
      emit();
    });
    const user = await sb.currentUser();
    if (user) { identity = { ...identity, ...user }; emit(); }
  } catch (e) {
    console.error('Supabase unavailable — staying in local guest mode.', e);
    sb = null;
  }
}

// Returns true if it consumed an OAuth redirect (so the router can skip it).
export async function handleAuthCallback() {
  if (sb && sb.handleCallback) {
    try { return await sb.handleCallback(); } catch (e) { console.error(e); }
  }
  return false;
}

export async function signIn(provider) {
  if (!sb) throw new Error('not-configured');
  return sb.signInProvider(provider);
}
export async function signInEmail(email, password, create) {
  if (!sb) throw new Error('not-configured');
  return sb.signInEmail(email, password, create);
}
export async function signOut() {
  if (sb) { try { await sb.signOut(); } catch (e) { console.error(e); } }
  identity = readLocal();
  emit();
}
