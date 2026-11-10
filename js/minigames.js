/* ============================================================
   minigames.js — one different bonus game between each pair
   of SQL floors. Each interlude reinforces a SQL concept the
   student has just learned (or is about to).
   ============================================================ */

import { renderArcade } from './arcade.js';

/* ---------------- shared helpers ---------------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth; // restart animation
  el.classList.add('shake');
}
function scaffold(container, title, subtitle) {
  container.innerHTML = `
    <div class="card mg">
      <h2>${title}</h2>
      <p class="sub">${subtitle}</p>
      <div id="mgArea"></div>
      <div class="feedback" id="mgFb"></div>
      <div class="mt" id="mgEnd"></div>
    </div>`;
  return {
    area: container.querySelector('#mgArea'),
    fb: container.querySelector('#mgFb'),
    end: container.querySelector('#mgEnd'),
  };
}
function finish(fb, end, msg, onDone) {
  fb.className = 'feedback ok';
  fb.textContent = '✅ ' + msg;
  end.innerHTML = `<button>Back to the office ▶</button>`;
  end.querySelector('button').onclick = () => onDone();
}
function fail(fb, msg) {
  fb.className = 'feedback err';
  fb.textContent = '❌ ' + msg;
}

/* ---------------- game registry ---------------- */
const GAMES = [
  gameScramble, gameHangman, gameArcade, gameTrueFalse,
  gameOddOneOut, gameMatches, gameWordSearch, gameClauseBuilder,
  gamePickResult,
];

export function renderMiniGame(container, { index = 0, onDone = () => {} } = {}) {
  const game = GAMES[((index % GAMES.length) + GAMES.length) % GAMES.length];
  game(container, onDone);
}

/* ============================================================
   1. Scrabble Scramble — click tiles to spell SELECT
   ============================================================ */
function gameScramble(container, onDone) {
  const WORD = 'SELECT';
  const PTS = { S:1, E:1, L:1, C:3, T:1 };
  const { area, fb, end } = scaffold(container,
    '🧩 Break Room: Scrabble Scramble',
    'Spell the keyword you just used to pull the product catalog. Click tiles in order — click a placed tile to take it back.');

  let pool = shuffle([...WORD]);
  if (pool.join('') === WORD) pool = shuffle(pool);
  let built = [];

  const render = () => {
    area.innerHTML = `
      <div class="tile-row" id="scBuilt">${[...Array(WORD.length)].map((_, i) => {
        const ch = built[i];
        return ch
          ? `<button class="scrab" data-pop="${i}">${ch}<i>${PTS[ch] || 1}</i></button>`
          : `<span class="slot"></span>`;
      }).join('')}</div>
      <div class="tile-row" id="scPool">${pool.map((ch, i) =>
        `<button class="scrab" data-take="${i}">${ch}<i>${PTS[ch] || 1}</i></button>`).join('')}</div>`;
  };
  render();

  area.onclick = e => {
    const take = e.target.closest('[data-take]');
    const pop = e.target.closest('[data-pop]');
    if (take && built.length < WORD.length) {
      built.push(pool.splice(+take.dataset.take, 1)[0]);
      fb.className = 'feedback';
      render();
      if (built.length === WORD.length) {
        if (built.join('') === WORD) {
          finish(fb, end, 'SELECT — the magic word! Every query starts with it.', onDone);
        } else {
          fail(fb, 'Not quite — that spell fizzles. Rearranging…');
          setTimeout(() => { built = []; fb.className = 'feedback'; render(); }, 1000);
        }
      }
    } else if (pop) {
      pool.push(built.splice(+pop.dataset.pop, 1)[0]);
      fb.className = 'feedback';
      render();
    }
  };
}

/* ============================================================
   2. Hangman — guess COLUMN
   ============================================================ */
function gameHangman(container, onDone) {
  const WORD = 'COLUMN';
  const { area, fb, end } = scaffold(container,
    '☕ Coffee Break: Hangman',
    'Guess the letters! Hint: a table is a grid, and each vertical is one of these (6 letters).');
  const MAX = 6;
  let revealed = new Set(), wrong = 0;

  const render = () => {
    const masked = [...WORD].map(ch => revealed.has(ch) ? ch : '_').join(' ');
    area.innerHTML = `
      <p class="masked">${masked}</p>
      <p class="sub">Break coffees left: ${'☕'.repeat(MAX - wrong)}${'💀'.repeat(wrong)}</p>
      <div class="keys">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(L =>
        `<button class="key ${revealed.has(L) || wrong >= MAX ? 'used' : ''}" data-k="${L}">${L}</button>`).join('')}</div>`;
  };
  render();

  area.onclick = e => {
    const k = e.target.closest('[data-k]');
    if (!k || wrong >= MAX || revealed.has(k.dataset.k)) return;
    const L = k.dataset.k;
    revealed.add(L);
    if (!WORD.includes(L)) wrong++;
    render();
    if ([...WORD].every(ch => revealed.has(ch))) {
      finish(fb, end, 'COLUMN! You pick a mean column list, analyst.', onDone);
    } else if (wrong >= MAX) {
      fail(fb, `Out of break coffees — it was COLUMN. Resetting for another shot…`);
      setTimeout(() => { revealed = new Set(); wrong = 0; render(); }, 1800);
    }
  };
}

/* ============================================================
   3. Fulfillment Rush — the packing arcade (unchanged)
   ============================================================ */
function gameArcade(container, onDone) {
  renderArcade(container, {
    level: 3, clearedFloor: 3,
    onDone: () => onDone(),
  });
}

/* ============================================================
   4. True / False quickfire
   ============================================================ */
function gameTrueFalse(container, onDone) {
  const { area, fb, end } = scaffold(container,
    '🍹 Water Cooler: Two Truths and a Query',
    'SQL true-or-false — get all four right to head upstairs.');
  const STMTS = [
    { t: "WHERE filters rows before they are grouped or sorted.", a: true },
    { t: "Text values in SQL must wear single quotes: city = 'Austin'.", a: true },
    { t: "ORDER BY must be written before FROM.", a: false },
    { t: "LIKE 'S%' matches every name that starts with S.", a: true },
  ];
  const solved = new Set();

  const render = () => {
    area.innerHTML = STMTS.map((s, i) => `
      <div class="quiz-row" data-i="${i}">
        <span class="st">${esc(s.t)}</span>
        <span class="tf-btns">
          <button data-pick="true" ${solved.has(i) ? 'disabled' : ''}>True</button>
          <button data-pick="false" class="ghost" ${solved.has(i) ? 'disabled' : ''}>False</button>
        </span>
      </div>`).join('');
    STMTS.forEach((s, i) => { if (solved.has(i)) area.querySelector(`[data-i="${i}"]`).classList.add('right'); });
  };
  render();

  area.onclick = e => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    const i = +btn.closest('[data-i]').dataset.i;
    if (solved.has(i)) return;
    const guess = (btn.dataset.pick === 'true') === STMTS[i].a;
    if (guess) {
      solved.add(i);
      render();
      if (solved.size === STMTS.length) {
        finish(fb, end, "That's a boardroom-level knowledge of the basics!", onDone);
      }
    } else {
      shake(btn.closest('.quiz-row'));
      fail(fb, 'Hmm, look at that one again…');
    }
  };
}

/* ============================================================
   5. Odd One Out — find the broken query
   ============================================================ */
function gameOddOneOut(container, onDone) {
  const { area, fb, end } = scaffold(container,
    '🍪 Snack Table: Odd One Out',
    'Three of these queries run perfectly. One would make the database wince — which?');
  const OPTS = [
    { q: 'SELECT * FROM products;', good: true },
    { q: "SELECT product_name, base_price FROM products WHERE base_price > 25;", good: true },
    { q: 'FROM products SELECT *;', good: false },
    { q: "SELECT name, city FROM customers WHERE city = 'Austin';", good: true },
  ];
  area.innerHTML = OPTS.map((o, i) =>
    `<button class="opt" data-i="${i}"><code>${esc(o.q)}</code></button>`).join('');
  area.onclick = e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const o = OPTS[+b.dataset.i];
    if (o.good) { shake(b); fail(fb, 'Nope — that one works fine!'); }
    else finish(fb, end, 'SQL sentences start with SELECT — FROM can never lead the parade.', onDone);
  };
}

/* ============================================================
   6. Perfect Matches — keyword ↔ purpose
   ============================================================ */
function gameMatches(container, onDone) {
  const { area, fb, end } = scaffold(container,
    '📌 Pinboard: Perfect Matches',
    'Pair each SQL tool with what it does. Click one from each side.');
  const PAIRS = [
    ['COUNT(*)', 'counts how many rows there are'],
    ['SUM()', 'adds up a numeric column'],
    ['LIKE', 'pattern matching with % wildcards'],
    ['ORDER BY', 'sorts your results'],
    ['JOIN', 'connects two tables on matching columns'],
  ];
  const keys = shuffle(PAIRS.map(p => p[0]));
  const defs = shuffle(PAIRS.map(p => p[1]));
  const matchedKeys = new Set(), matchedDefs = new Set();
  let sel = null;   // index of the selected keyword chip
  let matched = 0;

  const draw = () => {
    area.innerHTML = `
      <div class="match-grid">
        <div class="match-col">${keys.map((k, i) =>
          `<button class="chip ${matchedKeys.has(k) ? 'matched' : ''} ${sel === i ? 'sel' : ''}" data-side="k" data-i="${i}"><code>${esc(k)}</code></button>`).join('')}</div>
        <div class="match-col">${defs.map((d, i) =>
          `<button class="chip ${matchedDefs.has(d) ? 'matched' : ''}" data-side="d" data-i="${i}">${esc(d)}</button>`).join('')}</div>
      </div>`;
  };
  draw();

  area.onclick = e => {
    const chipEl = e.target.closest('[data-side]');
    if (!chipEl || matched === PAIRS.length) return;
    const side = chipEl.dataset.side, i = +chipEl.dataset.i;
    if (side === 'k') {
      sel = (sel === i) ? null : i;
      draw();
    } else if (sel !== null) {
      const key = keys[sel], def = defs[i];
      const pair = PAIRS.find(p => p[0] === key && p[1] === def);
      if (pair) {
        matchedKeys.add(pair[0]); matchedDefs.add(pair[1]); matched++;
        sel = null; draw();
        if (matched === PAIRS.length) {
          finish(fb, end, 'All matched — you know your SQL toolbox by heart!', onDone);
        }
      } else {
        shake(chipEl); fail(fb, 'Nope, those two do different jobs. Try again!');
        sel = null; draw();
      }
    }
  };
}

/* ============================================================
   7. SQL Word Search
   ============================================================ */
function gameWordSearch(container, onDone) {
  const { area, fb, end } = scaffold(container,
    '📋 Bulletin Board: SQL Word Search',
    'The six SQL keywords are listed below — click a word\'s first letter, then its last letter. Really stuck? Tap 💡 Hint!');
  const SIZE = 8;
  const WORDS = ['SUM', 'COUNT', 'GROUP', 'LIMIT', 'ORDER', 'AVG'];
  const DIRS = [[0, 1], [1, 0], [1, 1]];

  function build() {
    for (let attempt = 0; attempt < 60; attempt++) {
      const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      const placed = [];
      let ok = true;
      for (const w of WORDS) {
        let done = false;
        for (let t = 0; t < 250 && !done; t++) {
          const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
          const r0 = Math.floor(Math.random() * SIZE);
          const c0 = Math.floor(Math.random() * SIZE);
          if (r0 + dr * (w.length - 1) >= SIZE || c0 + dc * (w.length - 1) >= SIZE) continue;
          const cells = [];
          let fits = true;
          for (let i = 0; i < w.length; i++) {
            const r = r0 + dr * i, c = c0 + dc * i;
            if (grid[r][c] !== null && grid[r][c] !== w[i]) { fits = false; break; }
            cells.push([r, c]);
          }
          if (!fits) continue;
          cells.forEach(([r, c], i) => grid[r][c] = w[i]);
          placed.push({ word: w, cells, found: false });
          done = true;
        }
        if (!done) { ok = false; break; }
      }
      if (ok) {
        const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const filled = grid.map(row => row.map(ch => ch ?? LETTERS[Math.floor(Math.random() * LETTERS.length)]));
        return { filled, placed };
      }
    }
  }
  const { filled, placed } = build();
  const foundCells = new Set();
  let sel = null;
  let hintsLeft = 3;

  const foundWords = () => placed.filter(p => p.found).map(p => p.word);

  const render = () => {
    area.innerHTML = `
      <div class="ws-bar">
        <p class="sub">Find: ${placed.map(p => p.found
          ? `<s>${p.word}</s>` : `<b>${p.word}</b>`).join(' · ')}</p>
        <button id="wsHint" class="ghost small" ${hintsLeft ? '' : 'disabled'}>💡 Hint (${hintsLeft})</button>
      </div>
      <div class="ws-grid">${filled.map((row, r) => row.map((ch, c) =>
        `<button class="ws ${foundCells.has(r + ',' + c) ? 'hit' : ''} ${sel && sel[0] === r && sel[1] === c ? 'sel' : ''}" data-r="${r}" data-c="${c}">${ch}</button>`).join('')).join('')}</div>`;
  };
  render();

  const useHint = () => {
    if (hintsLeft <= 0) return;
    const target = placed.find(p => !p.found);
    if (!target) return;
    hintsLeft--;
    render();
    const [hr, hc] = target.cells[0];
    const cell = area.querySelector(`.ws[data-r="${hr}"][data-c="${hc}"]`);
    cell.classList.add('hint');
    setTimeout(() => cell.classList.remove('hint'), 2600);
    fb.className = 'feedback info';
    fb.textContent = `💡 One of the words starts at a glowing tile! ${hintsLeft} hint${hintsLeft === 1 ? '' : 's'} left.`;
  };

  area.onclick = e => {
    if (e.target.closest('#wsHint')) { useHint(); return; }
    const b = e.target.closest('.ws');
    if (!b) return;
    const r = +b.dataset.r, c = +b.dataset.c;
    if (sel && sel[0] === r && sel[1] === c) { sel = null; render(); return; }
    if (!sel) { sel = [r, c]; render(); return; }
    // second click: does sel→this match a word's endpoints?
    const hit = placed.find(p => !p.found &&
      ((p.cells[0][0] === sel[0] && p.cells[0][1] === sel[1] && p.cells.at(-1)[0] === r && p.cells.at(-1)[1] === c)
    || (p.cells.at(-1)[0] === sel[0] && p.cells.at(-1)[1] === sel[1] && p.cells[0][0] === r && p.cells[0][1] === c)));
    if (hit) {
      hit.found = true;
      hit.cells.forEach(([rr, cc]) => foundCells.add(rr + ',' + cc));
      sel = null; render();
      if (foundWords().length === WORDS.length) {
        finish(fb, end, 'All six found — GROUP BY has nothing to hide from you!', onDone);
      }
    } else {
      sel = [r, c]; render();  // treat as a new first click (forgiving)
    }
  };
}

/* ============================================================
   8. Query Architect — clause ordering
   ============================================================ */
function gameClauseBuilder(container, onDone) {
  const { area, fb, end } = scaffold(container,
    '🧱 Whiteboard: Query Architect',
    'The Sales Floor huddle wants to know which cities have the most completed orders. Click the clauses below in the right order to build the query.');
  const STEPS = [
    "SELECT city, COUNT(*) AS orders",
    "FROM orders",
    "WHERE status = 'completed'",
    "GROUP BY city",
    "ORDER BY orders DESC",
    "LIMIT 3",
  ];
  const chips = shuffle(STEPS.map((s, i) => ({ s, i })));
  let builtCount = 0;

  const render = () => {
    area.innerHTML = `
      <div class="built-query" id="bq">${STEPS.slice(0, builtCount).map(s => esc(s)).join('\n') || '<span class="sub">// click the first clause…</span>'}</div>
      <div class="chip-row">${chips.map(ch => builtCount > ch.i ? '' :
        `<button class="chip" data-i="${ch.i}"><code>${esc(ch.s)}</code></button>`).join('')}</div>`;
  };
  render();

  area.onclick = e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const i = +b.dataset.i;
    if (i === builtCount) {
      builtCount++;
      fb.className = 'feedback';
      render();
      if (builtCount === STEPS.length) {
        const bq = area.querySelector('#bq');
        bq.textContent = STEPS.join('\n') + '\n-- 🏗️ structurally perfect!';
        finish(fb, end, 'SELECT → FROM → WHERE → GROUP BY → ORDER BY → LIMIT. That order never changes!', onDone);
      }
    } else {
      shake(b);
      fail(fb, 'That clause can\'t go there — SQL runs in one fixed order!');
    }
  };
}

/* ============================================================
   9. Pick the Result
   ============================================================ */
function gamePickResult(container, onDone) {
  const { area, fb, end } = scaffold(container,
    '🪑 Boardroom Preview: Pick the Result',
    'The boss runs this query on the table below. Which result comes back?');
  const TEAMS = [['Panthers', 8], ['Tigers', 6], ['Bears', 8], ['Eagles', 3]];
  const QUERY = 'SELECT team FROM teams WHERE wins = 8;';
  const OPTS = [
    { rows: [['Panthers'], ['Bears']], right: true },
    { rows: [['Panthers'], ['Tigers'], ['Bears'], ['Eagles']], right: false },
    { rows: [['Tigers']], right: false },
  ];
  const miniTable = (rows) => `<table class="mini"><tbody>${rows.map(r =>
    `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  area.innerHTML = `
    <div class="side-by-side">
      <div>
        <p class="section-label">teams</p>
        <table class="mini"><thead><tr><th>team</th><th>wins</th></tr></thead>
        <tbody>${TEAMS.map(t => `<tr><td>${t[0]}</td><td>${t[1]}</td></tr>`).join('')}</tbody></table>
      </div>
      <div>
        <p class="section-label">the query</p>
        <code class="code-line">${esc(QUERY)}</code>
        <p class="section-label mt">pick the output</p>
        ${shuffle(OPTS).map(o =>
          `<button class="opt" data-r="${o.right ? 1 : 0}">${miniTable(o.rows)}</button>`).join('')}
      </div>
    </div>`;
  area.onclick = e => {
    const b = e.target.closest('.opt');
    if (!b) return;
    if (b.dataset.r === '1')
      finish(fb, end, 'WHERE keeps only the rows that pass the test — Panthers and Bears head to the boardroom.', onDone);
    else { shake(b); fail(fb, 'Trace the WHERE clause again — only rows with wins = 8 survive.'); }
  };
}
