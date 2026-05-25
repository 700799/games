// Supabase backend — loaded lazily by auth.js ONLY when js/config.js is filled
// in. Dormant (never imported) in local-guest mode, so the app works with no
// backend. Provides account sign-in and cross-device point persistence.
//
// Uses the PKCE flow so the OAuth callback returns ?code= (a query param) and
// never collides with the app's #hash game routing.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;
const authListeners = new Set();

export async function init() {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
  });
  client.auth.onAuthStateChange(async (_event, session) => {
    notify(await toUser(session));
  });
}

function notify(user) { authListeners.forEach((cb) => { try { cb(user); } catch (e) { console.error(e); } }); }
export function onAuth(cb) { authListeners.add(cb); return () => authListeners.delete(cb); }

async function toUser(session) {
  if (!session?.user) return null;
  const u = session.user;
  const isGuest = u.is_anonymous === true;
  let points = 0, wins = 0, losses = 0;
  let name = u.user_metadata?.name || u.user_metadata?.full_name || u.email || 'Player';
  try {
    const { data } = await client.from('profiles')
      .select('display_name, total_points, wins, losses').eq('id', u.id).single();
    if (data) {
      points = data.total_points || 0; wins = data.wins || 0; losses = data.losses || 0;
      if (data.display_name) name = data.display_name;
    }
  } catch (e) { /* profile row may not exist yet (created by signup trigger) */ }
  return { id: u.id, name, points, wins, losses, isGuest, avatar: u.user_metadata?.avatar_url || null };
}

export async function currentUser() {
  const { data } = await client.auth.getSession();
  return toUser(data.session);
}

// Consume the ?code= OAuth/PKCE callback. Returns true if it handled one.
export async function handleCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return false;
  await client.auth.exchangeCodeForSession(code);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return true;
}

const redirectTo = () => window.location.origin + window.location.pathname;

export async function signInProvider(provider) {
  if (provider === 'email') throw new Error('use-email-form');
  const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
  if (error) throw error;
}
export async function signInEmail(email, password, create) {
  const { error } = await (create
    ? client.auth.signUp({ email, password })
    : client.auth.signInWithPassword({ email, password }));
  if (error) throw error;
}
export async function signInGuest() {
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
}
export async function signOut() { await client.auth.signOut(); }

export async function updateName(name) {
  const { data } = await client.auth.getUser();
  if (data?.user) await client.from('profiles').update({ display_name: name }).eq('id', data.user.id);
}

// Cross-device point/record persistence via SECURITY DEFINER RPCs (see
// supabase/schema.sql). Return the authoritative new totals.
export async function addPoints(delta) {
  const { data, error } = await client.rpc('add_points', { p_delta: delta });
  if (error) throw error;
  return data; // new total_points
}
export async function recordOutcome(kind) {
  const { error } = await client.rpc('record_outcome', { p_kind: kind });
  if (error) throw error;
}
