/* ============================================================
   main.js — Proimprint Quest game engine (vanilla JS, no build)
   Host on GitHub Pages. Optional multiplayer: fill in
   SUPABASE_URL / SUPABASE_ANON_KEY below or as query params.
   ============================================================ */

import { initDb, query } from './db.js';
import { CHALLENGES } from './challenges.js';
import { renderMiniGame } from './minigames.js';
import * as mp from './multiplayer.js';

/* ---- Supabase config (safe to hardcode: anon key is public) ---- */
const SUPABASE_URL = "https://jzugkkhcwmshtxfcmvip.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SUHTWIazvjUh7LBOWyCEWA_bNGyhsH7";
/* You can also pass them as: index.html?sb_url=...&sb_key=... */

const app = document.getElementById('app');

const state = {
  name: '', emoji: '🕵️',
  scene: parseInt(localStorage.getItem('pq_scene') || '0'),
  completed: parseInt(localStorage.getItem('pq_completed') || '0'),
  roster: [], feed: [], lastResult: null,
};
function persist() {
  localStorage.setItem('pq_scene', state.scene);
  localStorage.setItem('pq_completed', state.completed);
}

const AVATARS = ['🕵️','🧑‍🎤','🧑‍🚀','👩‍🔬','🧑‍🔧','🧙‍♀️','🦹‍♀️','👩‍🌾','🧑‍🎨','🤵','👩‍💼','🧑‍🍳','🕺','💃','🙋‍♂️','💁‍♀️'];

/* ============================================================ */
async function boot() {
  const params = new URLSearchParams(location.search);
  let mpOk = false;
  try {
    mpOk = await mp.configureSupabase(
      params.get('sb_url') || SUPABASE_URL,
      params.get('sb_key') || SUPABASE_ANON_KEY,
    );
  } catch (e) { console.warn('Multiplayer disabled:', e); }
  try {
    await initDb();
  } catch (e) {
    app.innerHTML = `
      <div class="card">
        <h1>🖨️✨ Proimprint Quest</h1>
        <p>Couldn't load the in-browser SQLite engine (sql.js).</p>
        <p class="sub">Check your network/CDN access, then reload. If you opened index.html directly from disk, serve it over http instead (e.g. \`python3 -m http.server\`).</p>
        <p class="sub">Details: <code>${esc(e.message)}</code></p>
      </div>`;
    console.error(e);
    return;
  }
  renderIntro(mpOk);
}

/* ---------------- intro / name screen ---------------- */
function renderIntro(mpOk) {
  app.innerHTML = `
    <div class="card intro">
      <div class="logo">🖨️✨</div>
      <h1>Proimprint Quest</h1>
      <p class="sub">A SQL adventure for junior analysts.</p>
      <div class="mt" style="text-align:left">
        <h2>Your first day at Proimprint HQ</h2>
        <p class="sub">Proimprint is a dropship print shop: we take orders, route them to distributors, and suppliers ship cool merch straight to customers. We make nothing… except <b>data-driven decisions</b>. That's where you come in.</p>
        <p class="sub">Complete 10 SQL challenges across the office to earn your promotion. ${mpOk ? 'Your classmates are playing too: watch their progress in the roster!' : ''}</p>
      </div>
      <div class="mt">
        <input type="text" id="nameInput" placeholder="Enter your analyst name…" maxlength="24" />
      </div>
      <div class="mt" id="avatarRow" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center"></div>
      <div class="mt"><button id="startBtn">Clock in ▶</button></div>
      <p class="hint mt">${mpOk ? '🟢 Multiplayer connected' : '⚪ Solo mode (no Supabase configured — see README)'}</p>
    </div>`;
  const row = app.querySelector('#avatarRow');
  AVATARS.forEach(a => {
    const b = document.createElement('button');
    b.className = 'small ghost' + (a === state.emoji ? ' sel' : '');
    b.style.fontSize = '1.3rem';
    b.textContent = a;
    b.onclick = () => {
      state.emoji = a;
      row.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
    row.appendChild(b);
  });
  const start = async () => {
    const n = app.querySelector('#nameInput').value.trim();
    if (!n) { app.querySelector('#nameInput').focus(); return; }
    state.name = n;
    document.title = `${n} · Proimprint Quest`;
    await mp.joinGame(n, state.emoji, onRemote);
    await mp.setScene(state.scene, state.completed); persist();
    renderGame();
  };
  app.querySelector('#startBtn').onclick = start;
  app.querySelector('#nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
}

function onRemote(data) {
  if (data.roster) { state.roster = data.roster; }
  if (data.event) {
    const ev = data.event;
    const myId = localStorage.getItem('pq_player_id');
    const who = esc(ev.name || 'Analyst') + (ev.id === myId ? ' (you)' : '');
    let text;
    if (ev.kind === 'join') text = `${who} clocked in — welcome to the office!`;
    else if (ev.kind === 'victory') text = `🏆 ${who} finished the quest — Junior Data Analyst II!`;
    else text = `🎉 ${who} cleared the ${CHALLENGES[ev.floor - 1]?.scene ?? 'Floor ' + ev.floor}!`;
    state.feed = [{ emoji: ev.emoji || '🙂', text }, ...state.feed].slice(0, 14);
    if (app.querySelector('#feed')) renderFeed();
  }
  // Patch only the live panels in place. Never re-render the whole app here:
  // realtime events fire for our own progress/heartbeat updates too, and a
  // full re-render would stomp the intro, the arcade bonus round, or an
  // unsolved challenge mid-typing.
  if (app.querySelector('#rosterList')) renderRoster();
  if (app.querySelector('#questMap')) renderPeers();
  const fr = app.querySelector('#finalRoster');
  if (fr) fr.innerHTML = finalRosterHtml();
}

/* ---------------- main game screen ---------------- */
function renderGame() {
  if (state.completed >= CHALLENGES.length) { renderVictory(); return; }
  const c = CHALLENGES[state.scene];
  const solved = state.scene < state.completed;

  app.innerHTML = `
    <div class="hud">
      <div class="pill"><span class="em">${state.emoji}</span> ${esc(state.name)}</div>
      <div class="pill"><span class="em">🏅</span> ${state.completed}/${CHALLENGES.length} challenges</div>
      <div class="map" id="questMap">${CHALLENGES.map((_, i) =>
        `<div class="node-col" title="Challenge ${i+1}">
           <div class="node ${i < state.completed ? 'done' : i === state.scene ? 'current' : 'locked'}">${i < state.completed ? '✓' : i + 1}</div>
           <div class="node-peers"></div>
         </div>`).join('')}
      </div>
      <button id="resetBtn" class="ghost small">🔄 Reset</button>
    </div>

    <div class="grid">
      <div>
        <div class="stage" style="background:${c.bg}">
          <div class="decor">${c.decor.map(d => `<span>${d}</span>`).join('')}</div>
          <div class="ground"></div>
          <div class="char">
            <div class="bubble">…</div>
            <div class="face">${c.guide.emoji}</div>
          </div>
          <div class="char" style="align-self:flex-end">
            <div class="face">${state.emoji}</div>
          </div>
        </div>

        <div class="card">
          <h2>${c.emoji} Floor ${c.id}: ${c.scene}</h2>
          <p class="sub" id="guideSay"></p>
          <div class="mt">
            <p class="section-label">📋 The task</p>
            <p><b>${c.task}</b></p>
            <p class="sub" style="white-space:pre-line"><code>${esc(c.tables)}</code></p>
          </div>
          <div class="mt">
            <textarea id="sql" spellcheck="false" placeholder="Type your SQL here…">${solved ? '' : (state.lastSql || '')}</textarea>
            <div class="editor-row">
              <button id="runBtn">▶ Run SQL</button>
              <button id="hintBtn" class="ghost small">💡 Hint</button>
              <button id="schemaBtn" class="ghost small">🗄️ Peek at all tables</button>
            </div>
            <div class="feedback" id="feedback"></div>
            <div id="result" class="mt"></div>
          </div>
        </div>
      </div>

      <div>
        ${mp.hasSupabase() ? `
        <div class="card roster">
          <p class="section-label">🏢 Who's in the office</p>
          <div id="rosterList"></div>
        </div>
        <div class="card mt">
          <p class="section-label">📈 Office feed</p>
          <div id="feed"></div>
        </div>` : `
        <div class="card">
          <p class="section-label">🏢 Solo mode</p>
          <p class="sub">Add Supabase (see README) to see classmates' progress on the floor map in real time.</p>
        </div>`}
      </div>
    </div>`;

  // guide speech bubble + typewriter
  const bubble = app.querySelector('.bubble');
  typeOut(bubble, `"${c.story}"`);

  // roster
  renderRoster();
  renderPeers();
  renderFeed();

  // wiring
  const run = () => runChallenge(c);
  app.querySelector('#runBtn').onclick = run;
  app.querySelector('#sql').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run();
  });

  // two-step reset: first click arms, second click within 3s resets
  const resetBtn = app.querySelector('#resetBtn');
  let armed = false, disarmT = null;
  resetBtn.onclick = () => {
    if (!armed) {
      armed = true;
      resetBtn.textContent = '⚠️ Sure? Click again';
      resetBtn.classList.add('danger');
      disarmT = setTimeout(() => {
        armed = false;
        resetBtn.textContent = '🔄 Reset';
        resetBtn.classList.remove('danger');
      }, 3000);
    } else {
      clearTimeout(disarmT);
      resetGame();
      toast('🔄 Quest reset — back to the Lobby!');
    }
  };
  app.querySelector('#hintBtn').onclick = () => toast('💡 ' + c.hint);
  app.querySelector('#schemaBtn').onclick = () => toast('Tables: customers, products, distributors, suppliers, orders, order_items', 6000);
}

/* ---------------- run + validate ---------------- */
function runChallenge(c) {
  const ta = app.querySelector('#sql');
  const fb = app.querySelector('#feedback');
  const resBox = app.querySelector('#result');
  const sqlText = ta.value.trim();
  state.lastSql = sqlText;
  fb.className = 'feedback';
  resBox.innerHTML = '';

  if (!sqlText) { showFeedback(false, 'Type some SQL first!'); return; }
  if (!/^select/i.test(sqlText)) { showFeedback(false, 'Analysts only need SELECT queries here. Start with SELECT!'); return; }

  let userRes, expRes;
  try { userRes = query(sqlText); }
  catch (e) { showFeedback(false, 'SQL error: ' + e.message); return; }
  try { expRes = query(c.answer); }
  catch (e) { showFeedback(false, 'Internal check failed: ' + e.message); return; }

  showResult(userRes);

  if (!sameShape(userRes, expRes, c)) {
    showFeedback(false, 'Not quite! Compare your result with the task.', userRes);
    return;
  }

  // success!
  showFeedback(true, solvedMsg(c));
  if (state.scene === state.completed) {
    state.completed += 1; persist();
    confetti();
    mp.setScene(state.scene + 1, state.completed);
    setTimeout(() => {
      if (state.completed < CHALLENGES.length) {
        showBonusRound(state.scene + 1);
      } else {
        renderGame();  // all floors cleared → victory
      }
    }, 1600);
  }
}

/* ---------------- bonus game interlude between floors ---------------- */
function showBonusRound(nextScene) {
  renderMiniGame(app, {
    index: state.completed - 1,   // one different game per gap between floors
    onDone: () => {
      state.scene = nextScene;
      state.lastSql = '';
      toast(`🎉 Bonus round cleared! Welcome to the ${CHALLENGES[state.scene].scene}!`);
      renderGame();
    },
  });
}

function sameShape(user, exp, c) {
  if (user.columns.length !== exp.columns.length) return false;
  const norm = rows => rows.map(r => r.map(v => v === null ? null : Number.isFinite(v) && typeof v === 'number'
      ? Math.round(v * 100) / 100 : String(v)));
  const u = norm(user.rows), e = norm(exp.rows);
  const key = r => JSON.stringify(r);
  if (c.ordered) return u.length === e.length && u.every((r, i) => key(r) === key(e[i]));
  const mu = new Map(); u.forEach(r => mu.set(key(r), (mu.get(key(r)) || 0) + 1));
  return e.every(r => { const n = mu.get(key(r)) || 0; if (!n) return false; mu.set(key(r), n - 1); return true; })
         && u.length === e.length;
}

function showFeedback(ok, msg, res) {
  const fb = app.querySelector('#feedback');
  fb.className = 'feedback ' + (ok ? 'ok' : 'err');
  fb.innerHTML = (ok ? '✅ ' : '❌ ') + esc(msg);
}

function showResult(res) {
  if (!res || !res.columns.length) return;
  app.querySelector('#result').innerHTML = `
    <p class="section-label">📊 Your result (${res.rows.length} rows)</p>
    <div class="result-box"><table>
      <thead><tr>${res.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${res.rows.map(r => `<tr>${r.map(v => `<td>${v === null ? 'NULL' : esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}

function solvedMsg(c) {
  return `${c.guide.emoji} ${c.guide.name} says: ${
    ['Nailed it!','Spectacular!','You get it!','CEO-grade work!','Spot on!','Smooth!','Legendary!','Textbook!','Wizardry!','Boardroom-ready!'][c.id - 1]}`;
}

function renderFeed() {
  const el = app.querySelector('#feed');
  if (!el) return;
  el.innerHTML = state.feed.length
    ? state.feed.map(f => `<div class="feed-item"><span class="fem">${f.emoji}</span> ${f.text}</div>`).join('')
    : '<p class="sub">Quiet office… progress updates will appear here.</p>';
}

/* ---------------- roster ---------------- */
function resetGame() {
  state.scene = 0;
  state.completed = 0;
  state.lastSql = '';
  persist();
  mp.setScene(0, 0);
}

function renderPeers() {
  const map = app.querySelector('#questMap');
  if (!map) return;
  const cols = map.querySelectorAll('.node-col');
  cols.forEach(col => { col.querySelector('.node-peers').innerHTML = ''; });
  const meId = localStorage.getItem('pq_player_id');
  const players = [...state.roster];
  if (state.name && !players.some(p => p.id === meId)) {
    players.push({ id: meId, name: state.name, emoji: state.emoji, scene: state.scene, completed: state.completed });
  }
  players.forEach(p => {
    const idx = Math.min(p.scene ?? 0, CHALLENGES.length - 1);
    const cell = cols[idx]?.querySelector('.node-peers');
    if (!cell) return;
    const s = document.createElement('span');
    s.className = 'peer' + (p.id === meId ? ' me' : '');
    s.textContent = p.emoji || '🙂';
    s.title = `${p.name || 'Analyst'}${p.id === meId ? ' (you)' : ''} · ${mp.sceneLabel(p.scene ?? 0, p.completed ?? 0)}`;
    cell.appendChild(s);
  });
}

function renderRoster() {
  const el = app.querySelector('#rosterList');
  if (!el) return;
  el.innerHTML = state.roster.map(p => `
    <div class="player">
      <div class="avatar">${p.emoji || '🙂'}</div>
      <div class="pinfo">
        <div class="pname">${esc(p.name)} ${p.id === localStorage.getItem('pq_player_id') ? '<span class="sub">(you)</span>' : ''}</div>
        <div class="ptask">${esc(mp.sceneLabel(p.scene, p.completed))}</div>
        <div class="bar"><i style="width:${(p.completed / CHALLENGES.length) * 100}%"></i></div>
      </div>
    </div>`).join('') || '<p class="sub">Nobody else online yet…</p>';
}

/* ---------------- victory ---------------- */
function renderVictory() {
  app.innerHTML = `
    <div class="card victory">
      <div class="trophy">🏆</div>
      <h1>Quest complete, ${esc(state.name)}!</h1>
      <p class="sub mt">You mastered all 10 SQL challenges and survived your first week at Proimprint. Here's your promotion: <b>Junior Data Analyst II</b> 🎉</p>
      <div class="mt"><button id="againBtn">Play again</button></div>
      ${mp.hasSupabase() ? '<div class="mt roster" id="finalRoster"></div>' : ''}
    </div>`;
  confetti(60);
  const fr = app.querySelector('#finalRoster');
  if (fr) fr.innerHTML = finalRosterHtml();
  const again = app.querySelector('#againBtn');
  if (again) again.onclick = () => {
    resetGame();
    renderGame();
    toast('🔄 Fresh start — Floor 1, here we come!');
  };
}

function finalRosterHtml() {
  return state.roster.map(p =>
    `<div class="player"><div class="avatar">${p.emoji || '🙂'}</div>
     <div class="pinfo"><div class="pname">${esc(p.name)}</div>
     <div class="ptask">${p.completed}/10 challenges</div></div></div>`).join('');
}

/* ---------------- little helpers ---------------- */
function typeOut(el, text) {
  let i = 0;
  el.textContent = '';
  clearInterval(el._t);
  el._t = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(el._t);
  }, 18);
}

function toast(msg, ms = 3200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function confetti(n = 30) {
  const bits = ['🎉','✨','🎊','⭐','💜'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = bits[i % bits.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDuration = (2 + Math.random() * 2) + 's';
    s.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 5000);
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

boot();