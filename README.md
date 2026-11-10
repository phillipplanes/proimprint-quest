# 🖨️✨ Proimprint Quest

A real-time multiplayer **SQL adventure game** for the classroom. Students are hired
as junior analysts at Proimprint HQ (the dropship print shop) and work through
**10 gated SQL challenges** across the hip office, guided by cute characters
(Dot the office dog, BrewBot 3000, Captain Valor the CEO unicorn…).

Players enter their name (and pick a cute avatar) at the start, then walk floor
by floor. Each floor is one scene with one challenge; clearing it unlocks the next.
SQL runs **100% in the browser** with sql.js (SQLite → WebAssembly), so nothing
leaves the student's laptop except their roster presence.

## The 10 challenges (difficulty ramp)

| # | Scene | SQL skills |
|---|-------|-----------|
| 1 | Lobby | `SELECT *` |
| 2 | Onboarding Desk | specific columns |
| 3 | Coffee Bar | `WHERE` numeric |
| 4 | Design Studio | `WHERE` text |
| 5 | Sales Floor | `ORDER BY` + `LIMIT` |
| 6 | Warehouse Wall | `LIKE` |
| 7 | Marketing Mezzanine | `COUNT(*)` |
| 8 | Finance Corner | `GROUP BY` |
| 9 | Rooftop Garden | `JOIN` + `GROUP BY` + `SUM` |
| 10 | Executive Suite | multi-`JOIN` + `WHERE` + `GROUP BY` + `ORDER BY` + `LIMIT` |

## Deploy on GitHub Pages (no build step!)

1. Create a GitHub repo and push this folder's contents to the root (or `docs/`).
2. Repo **Settings → Pages → Source**: deploy from the branch (e.g. `main`, folder `/root`).
3. Done. Your game is live at `https://<you>.github.io/<repo>/`.

## Enable real-time multiplayer (Supabase)

Without Supabase the game runs fully in **solo mode**. With it, students also see:

- 🏢 a live roster ("Who's in the office") with everyone's progress bars and current scene
- 💬 an office chat

Setup:

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the whole of `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and the `anon` public key.
4. Edit `js/main.js` and fill in:
   ```js
   const SUPABASE_URL = "https://xxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...";
   ```
   (The anon key is designed to be public; Row Level Security in the schema
   restricts what it can do.)
   Or pass them as URL parameters so you don't hardcode:
   `index.html?sb_url=https://xxxx.supabase.co&sb_key=eyJ...`

## Run locally

Just open `index.html` in a browser, or:

```bash
npx serve .        # or python3 -m http.server
```

## How validation works

Each challenge stores a reference query. The student's query and the reference
query both run against the same in-browser SQLite database; the result sets are
compared (row-by-row, order-insensitive unless the challenge requires ordering).
Any query that produces the right answer passes, so there's no single "correct"
spelling of the SQL.

## Files

```
index.html            — entry point
css/style.css         — cute office styling
js/db.js              — in-browser SQLite database + Proimprint seed data
js/challenges.js      — the 10 challenges, scenes, characters, stories
js/multiplayer.js     — Supabase presence + chat (optional)
js/main.js            — game engine: scenes, editor, validation, confetti
supabase/schema.sql   — tables + RLS policies for multiplayer
```

## Classroom tips

- Students can refresh without losing progress (saved in localStorage per browser).
- Hint buttons scaffold each challenge without giving the full answer.
- "Peek at all tables" shows which tables exist; `db.js` seed data mirrors the
  Proimprint value chain (customers → orders → order_items → distributors/suppliers),
  so it doubles as review of the role-play activity.
# proimprint-quest
