/* ============================================================
   multiplayer.js — Supabase-backed presence & chat.
   Requires a `players` and `messages` table (see supabase/schema.sql).
   If Supabase isn't configured, the game still works fully solo.
   ============================================================ */

import { CHALLENGES } from './challenges.js';

let sb = null;          // supabase client
let myId = null;        // my player id
let me = null;          // my { name, emoji }
let subs = [];          // realtime subscriptions
let onChange = () => {}; // callback when roster/chat updates

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

  // Realtime: any player row changes -> refresh roster
  const ch = sb.channel('pq-players')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'players' },
      () => refresh())
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => onChange({ chat: payload.new }))
    .subscribe();
  subs.push(ch);
  await refresh();
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

export async function sendMessage(text) {
  if (!sb || !me || !text.trim()) return;
  try {
    await sb.from('messages').insert({ name: me.name, text: text.trim().slice(0, 200) });
  } catch (e) { console.warn(e); }
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
