/* ============================================================
   multiplayer.js — Supabase-backed player presence.
   Requires a `players` table (see supabase/schema.sql).
   If Supabase isn't configured, the game still works fully solo.
   ============================================================ */

import { CHALLENGES } from './challenges.js';

let sb = null;          // supabase client
let myId = null;        // my player id
let me = null;          // my { name, emoji }
let subs = [];          // realtime subscriptions
let onChange = () => {}; // callback when roster updates

const ONLINE_MS = 60_000;

export async function configureSupabase(url, anonKey) {
  if (!url || !anonKey) return false;
  try {
    // esm.sh serves a browser-ready ESM bundle; jsdelivr's dist/module
    // uses bare package specifiers that browsers cannot resolve.
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    sb = mod.createClient(url, anonKey);
    return true;
  } catch (e) {
    console.warn('Supabase SDK failed to load — falling back to solo mode.', e);
    sb = null;
    return false;
  }
}

export function hasSupabase() { return !!sb; }

export async function joinGame(name, emoji, callback) {
  onChange = callback || onChange;
  me = { name, emoji };
  if (!sb) return;
  myId = localStorage.getItem('pq_player_id') || crypto.randomUUID();
  localStorage.setItem('pq_player_id', myId);

  await upsert({ scene: 0, completed: 0 });
  startHeartbeat();

  // Realtime: any player row change -> refresh roster, and surface
  // progress milestones (floor clears, joins, finishes) as feed events.
  const ch = sb.channel('pq-players')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'players' },
      (payload) => {
        const ev = progressEvent(payload);
        refresh();
        if (ev) onChange(ev);
      })
    .subscribe();
  subs.push(ch);
  await refresh();
}

/* Turn a players-table change into a human milestone, or null for noise. */
function progressEvent(payload) {
  const neu = payload.new, alt = payload.old;
  const evtType = payload.eventType || payload.event;
  if (!neu) return null;
  if (evtType === 'INSERT' || alt == null) {
    return { kind: 'join', id: neu.id, name: neu.name, emoji: neu.emoji };
  }
  const before = alt.completed ?? 0, after = neu.completed ?? 0;
  if (after > before) {
    return {
      kind: after >= CHALLENGES.length ? 'victory' : 'floor',
      id: neu.id, name: neu.name, emoji: neu.emoji, floor: after,
    };
  }
  return null;   // heartbeat / scene nudges stay silent
}

async function upsert(patch) {
  if (!sb || !me) return;
  try {
    await sb.from('players').upsert({
      id: myId, name: me.name, emoji: me.emoji,
      last_seen: new Date().toISOString(),
      ...patch,
    });
  } catch (e) { console.warn('supabase upsert failed', e); }
}

export async function setScene(scene, completed) {
  return upsert({ scene, completed });
}

let hbTimer = null;
function startHeartbeat() {
  clearInterval(hbTimer);
  hbTimer = setInterval(() => upsert({}), 20_000);
}

export async function refresh() {
  if (!sb) return;
  const cutoff = new Date(Date.now() - ONLINE_MS).toISOString();
  const { data } = await sb.from('players')
    .select('id,name,emoji,scene,completed,last_seen')
    .gte('last_seen', cutoff)
    .order('completed', { ascending: false });
  onChange({ roster: data || [] });
}

export function disconnect() {
  subs.forEach(c => { try { sb.removeChannel(c); } catch (e) {} });
  clearInterval(hbTimer);
  subs = [];
}

export function sceneLabel(scene, completed) {
  if (scene >= CHALLENGES.length) return '🏆 Quest complete!';
  const c = CHALLENGES[scene];
  const tag = scene < completed ? ' (done)' : '';
  return `Floor ${scene + 1}: ${c.scene}${tag}`;
}
