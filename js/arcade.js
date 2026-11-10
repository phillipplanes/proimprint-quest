/* ============================================================
   arcade.js — "Fulfillment Rush" bonus round.
   A little packing arcade played between SQL floors: steer the
   courier cart, catch falling orders (📦), grab coffee (☕) and
   mystery boxes (🎁), and dodge the socks (🧦) nobody ordered.
   Difficulty ramps with the number of floors cleared.
   ============================================================ */

const DURATION_S = 22;   // round length in seconds

const ITEM_DEFS = [
  { e: '📦', w: 60, pts: 10 },
  { e: '☕', w: 15, pts: 5 },
  { e: '🧦', w: 20, pts: -6 },
  { e: '🎁', w: 5,  pts: 25 },
];

export function renderArcade(container, {
  level = 1,       // floors cleared — drives difficulty
  clearedFloor = 1,
  onDone = () => {},
} = {}) {
  const best0 = parseInt(localStorage.getItem('pq_arcade_best') || '0');
  container.innerHTML = `
    <div class="card arcade">
      <h2>🕹️ Bonus Round: Fulfillment Rush!</h2>
      <p class="sub">Floor ${clearedFloor} cleared! The conveyor is going wild — help pack the orders before they hit the floor. <b>📦 +10 · ☕ +5 · 🎁 +25 · 🧦 −6</b> (nobody ordered socks!)</p>
      <div class="hud">
        <div class="pill"><span class="em">✨</span> <span id="arcScore">0</span></div>
        <div class="pill"><span class="em">⏱️</span> <span id="arcTime">${DURATION_S}s</span></div>
        <div class="pill"><span class="em">🏅</span> <span id="arcBest">${best0}</span></div>
      </div>
      <div class="playfield" id="arcField">
        <div class="arcade-floor"></div>
        <div class="cart" id="arcCart">🛒</div>
      </div>
      <p class="ctl-hint">Move with ← → or drag with your finger / mouse</p>
      <div class="mt" id="arcEnd"></div>
    </div>`;

  const field  = container.querySelector('#arcField');
  const cart   = container.querySelector('#arcCart');
  const scoreEl= container.querySelector('#arcScore');
  const bestEl = container.querySelector('#arcBest');
  const timeEl = container.querySelector('#arcTime');
  const endBox = container.querySelector('#arcEnd');

  const W = field.clientWidth, H = field.clientHeight;
  const fallSpeed  = 120 + level * 24;                    // px/sec
  const spawnEvery = Math.max(0.34, 0.95 - level * 0.07); // seconds
  const cartCatch  = 52;                                  // px either side
  const keys = { left: false, right: false };

  let score = 0, best = best0;
  let cartX = W / 2, targetX = W / 2;
  let running = true, raf = 0, spawnAcc = 0;
  const items = [];
  const start = performance.now();
  let last = start;

  /* ---- input ---- */
  const onKeyDown = e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      keys[e.key === 'ArrowLeft' ? 'left' : 'right'] = true;
    }
  };
  const onKeyUp = e => {
    if (e.key === 'ArrowLeft')  keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  };
  const onPointer = e => {
    const r = field.getBoundingClientRect();
    targetX = e.clientX - r.left;
  };
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  field.addEventListener('pointermove', onPointer);
  field.addEventListener('pointerdown', onPointer);

  function cleanup() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    field.removeEventListener('pointermove', onPointer);
    field.removeEventListener('pointerdown', onPointer);
  }

  /* ---- spawning ---- */
  function spawn() {
    let roll = Math.random() * 100, def = ITEM_DEFS[0], acc = 0;
    for (const d of ITEM_DEFS) { acc += d.w; if (roll < acc) { def = d; break; } }
    const el = document.createElement('span');
    el.className = 'item';
    el.textContent = def.e;
    const x = 26 + Math.random() * (W - 52);
    el.style.left = x + 'px';
    field.appendChild(el);
    items.push({ el, x, y: -36, vy: fallSpeed * (0.85 + Math.random() * 0.5), pts: def.pts });
  }

  function popText(x, y, text, good) {
    const p = document.createElement('span');
    p.className = 'pop' + (good ? ' good' : ' bad');
    p.textContent = text;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    field.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }

  function addScore(n) {
    score += n;
    scoreEl.textContent = score;
  }

  /* ---- round end ---- */
  function end() {
    cleanup();
    items.forEach(it => it.el.remove());
    items.length = 0;
    const newBest = score > best;
    if (newBest) { best = score; localStorage.setItem('pq_arcade_best', String(best)); bestEl.textContent = best; }
    endBox.innerHTML = `
      <h2>${newBest ? '🏅 New office record!' : 'Picker invoice:'} ${score} pts</h2>
      <button id="arcCont">Back to the office ▶</button>`;
    endBox.querySelector('#arcCont').onclick = () => { cleanup(); onDone(score); };
  }

  /* ---- main loop ---- */
  function frame(now) {
    if (!running) return;
    if (!document.contains(field)) { cleanup(); return; }  // scene moved on without us
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const remain = DURATION_S - (now - start) / 1000;
    if (remain <= 0) { end(); return; }
    timeEl.textContent = Math.ceil(remain) + 's';

    spawnAcc += dt;
    while (spawnAcc > spawnEvery) { spawnAcc -= spawnEvery; spawn(); }

    if (keys.left)  targetX -= 430 * dt;
    if (keys.right) targetX += 430 * dt;
    targetX = Math.max(40, Math.min(W - 40, targetX));
    cartX += (targetX - cartX) * Math.min(1, dt * 14);
    cart.style.left = (cartX - 34) + 'px';

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.el.style.transform = `translateY(${it.y}px)`;
      const inCatchBand = it.y > H - 110 && it.y < H - 60;
      if (inCatchBand && Math.abs(it.x - cartX) < cartCatch) {
        addScore(it.pts);
        popText(it.x - 16, it.y, (it.pts > 0 ? '+' : '') + it.pts, it.pts > 0);
        it.el.remove(); items.splice(i, 1);
      } else if (it.y > H - 30) {
        it.el.remove(); items.splice(i, 1);   // hit the floor
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}
