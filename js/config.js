// Supabase project config. These values are PUBLISHABLE (safe to commit) and
// are protected server-side by Row-Level Security — they are not secrets.
//
// To enable real accounts + cross-device points + leaderboards:
//   1. Create a free project at https://supabase.com
//   2. Run supabase/schema.sql in the Supabase SQL editor
//   3. Settings → API: copy the Project URL and the "anon"/"publishable" key here
//   4. Auth → URL Configuration: add your site URL + http://localhost:8000 as
//      redirect URLs
//
// Until these are filled in, the app runs in LOCAL GUEST mode: head-to-head
// challenges still work via share links and points are stored in the browser.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
