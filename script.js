(() => {
  const N = 4;
  const MOVE_MS = 110;
  const POP_MS = 180;
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlay-text");
  const keepBtn = document.getElementById("keep-going");

  const COLORS = {
    board: "#bbada0", empty: "#cdc1b4", // nadpisywane z CSS w applyTheme()
    2: ["#eee4da", "#776e65"], 4: ["#ede0c8", "#776e65"],
    8: ["#f2b179", "#f9f6f2"], 16: ["#f59563", "#f9f6f2"],
    32: ["#f67c5f", "#f9f6f2"], 64: ["#f65e3b", "#f9f6f2"],
    128: ["#edcf72", "#f9f6f2"], 256: ["#edcc61", "#f9f6f2"],
    512: ["#edc850", "#f9f6f2"], 1024: ["#edc53f", "#f9f6f2"],
    2048: ["#edc22e", "#f9f6f2"],
  };

  let score, best, won, over;
  // kafelek: {v, r, c, fr, fc, born, mergedAt}; ghosts – kafelki wchłonięte przy scalaniu
  let tiles = [], ghosts = [];
  let animStart = 0;
  let size = 0, gap = 0, cell = 0;

  best = Number(safeGet("best2048")) || 0;
  bestEl.textContent = best;

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    size = canvas.clientWidth;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gap = size * 0.03;
    cell = (size - gap * 5) / 4;
  }

  function init() {
    tiles = [];
    ghosts = [];
    score = 0;
    won = false;
    over = false;
    eggThisGame = false;
    overlay.hidden = true;
    addRandom();
    addRandom();
    updateScore();
  }

  function emptyCells() {
    const taken = new Set(tiles.map(t => t.r * N + t.c));
    const res = [];
    for (let i = 0; i < N * N; i++) if (!taken.has(i)) res.push(i);
    return res;
  }

  function addRandom() {
    const empty = emptyCells();
    if (!empty.length) return;
    const i = empty[Math.floor(Math.random() * empty.length)];
    const r = Math.floor(i / N), c = i % N;
    tiles.push({ v: Math.random() < 0.9 ? 2 : 4, r, c, fr: r, fc: c, born: performance.now() + MOVE_MS, mergedAt: 0 });
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      safeSet("best2048", best);
    }
  }

  // ---------- easter egg (pierwszy kafelek 256 w grze; maks. 3 razy na urządzeniu) ----------
  const egg = document.getElementById("egg");
  const eggHearts = document.getElementById("egg-hearts");
  const EGG_TILE = 256;
  const EGG_MAX_SHOWS = 3;
  let eggThisGame = false;

  function checkEgg() {
    if (eggThisGame || !egg.hidden) return;
    if (!tiles.some(t => t.v >= EGG_TILE)) return;
    eggThisGame = true;
    const count = Number(safeGet("egg2048count")) || 0;
    if (count >= EGG_MAX_SHOWS) return;
    safeSet("egg2048count", count + 1);
    setTimeout(openEgg, 500);
  }

  function openEgg() {
    eggHearts.innerHTML = "";
    const icons = ["💖", "💗", "💕", "🌸", "✨", "💞"];
    for (let i = 0; i < 24; i++) {
      const sp = document.createElement("span");
      sp.textContent = icons[i % icons.length];
      sp.style.left = Math.random() * 95 + "%";
      sp.style.fontSize = 18 + Math.random() * 28 + "px";
      sp.style.animationDuration = 5 + Math.random() * 5 + "s";
      sp.style.animationDelay = Math.random() * 6 + "s";
      eggHearts.appendChild(sp);
    }
    egg.hidden = false;
    document.getElementById("egg-close").focus();
  }
  document.getElementById("egg-close").addEventListener("click", () => { egg.hidden = true; });

  // ---------- dev menu (długie przytrzymanie tytułu >= 2 s) ----------
  const devDlg = document.getElementById("dev");
  const devInfo = document.getElementById("dev-info");
  const devValue = document.getElementById("dev-value");
  const title = document.querySelector("h1");
  const modalOpen = () => confirmDlg.open || devDlg.open || !egg.hidden;

  for (let v = 2; v <= 8192; v *= 2) devValue.add(new Option(v, v));
  devValue.value = "256";

  function refreshDevInfo() {
    const count = Number(safeGet("egg2048count")) || 0;
    devInfo.textContent = `Easter egg: ${count}/${EGG_MAX_SHOWS} wyświetleń · ` +
      `kafelków: ${tiles.length} · wolnych pól: ${emptyCells().length} · wynik: ${score}`;
  }

  function openDev() {
    refreshDevInfo();
    devDlg.showModal();
  }

  let pressTimer = null;
  const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
  title.addEventListener("pointerdown", () => {
    cancelPress();
    pressTimer = setTimeout(() => { pressTimer = null; openDev(); }, 2000);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(t => title.addEventListener(t, cancelPress));
  title.addEventListener("contextmenu", e => e.preventDefault());

  function devAddTile(v) {
    const empty = emptyCells();
    if (!empty.length) return false;
    const i = empty[Math.floor(Math.random() * empty.length)];
    const r = Math.floor(i / N), c = i % N;
    tiles.push({ v, r, c, fr: r, fc: c, born: performance.now(), mergedAt: 0 });
    return true;
  }

  function afterDevChange() {
    updateScore();
    checkState();
    checkEgg();
    refreshDevInfo();
  }

  const DEV_ACTIONS = {
    "add-tile": () => { devAddTile(Number(devValue.value)); afterDevChange(); },
    "play-sound": () => playMerge(Number(devValue.value)),
    "clear-board": () => { restart(); refreshDevInfo(); },
    win: () => {
      if (!devAddTile(2048)) tiles[0].v = 2048;
      won = true;
      devDlg.close();
      afterDevChange();
    },
    lose: () => {
      // szachownica 2/4 – brak wolnych pól i brak możliwych scaleń
      tiles = [];
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          tiles.push({ v: (r + c) % 2 ? 2 : 4, r, c, fr: r, fc: c, born: performance.now(), mergedAt: 0 });
      devDlg.close();
      afterDevChange();
    },
    "score-plus": () => { score += 1000; updateScore(); refreshDevInfo(); },
    "reset-best": () => { best = 0; safeSet("best2048", 0); bestEl.textContent = 0; },
    "show-egg": () => { devDlg.close(); openEgg(); },
    "reset-egg": () => { safeSet("egg2048count", 0); eggThisGame = false; refreshDevInfo(); },
    "reset-all": () => {
      ["best2048", "mute2048", "theme2048", "egg2048count"].forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
      best = 0;
      bestEl.textContent = 0;
      refreshDevInfo();
    },
  };

  devDlg.addEventListener("click", e => {
    if (e.target === devDlg) return devDlg.close();
    const act = e.target.closest("[data-dev]");
    if (act) DEV_ACTIONS[act.dataset.dev]();
  });
  document.getElementById("dev-close").addEventListener("click", () => devDlg.close());

  // ---------- motyw dzienny/nocny ----------
  const themeBtns = document.querySelectorAll("[data-theme-value]");
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let theme = safeGet("theme2048") || (darkQuery.matches ? "dark" : "light");

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    const css = getComputedStyle(document.documentElement);
    COLORS.board = css.getPropertyValue("--board").trim();
    COLORS.empty = css.getPropertyValue("--empty").trim();
    themeBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeValue === theme)));
  }
  themeBtns.forEach(b => b.addEventListener("click", () => {
    theme = b.dataset.themeValue;
    safeSet("theme2048", theme);
    applyTheme();
    b.blur();
  }));

  // ---------- dźwięk (Web Audio, bez plików) ----------
  let audio = null;
  const PENTATONIC = [0, 2, 4, 7, 9]; // półtony skali pentatonicznej dur

  const muteBtn = document.getElementById("mute");
  let muted = safeGet("mute2048") === "1";

  function updateMuteBtn() {
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.setAttribute("aria-label", muted ? "Włącz dźwięk" : "Wycisz dźwięk");
  }
  updateMuteBtn();
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    safeSet("mute2048", muted ? "1" : "0");
    updateMuteBtn();
    muteBtn.blur(); // klawisze strzałek nie powinny przełączać przycisku
  });

  // --- iOS/Safari: kontekst audio działa dopiero po geście użytkownika, a przełącznik
  // wyciszenia (silent switch) domyślnie głuszy Web Audio. Obejście: tryb "playback"
  // (iOS 17+) oraz cichy element <audio>, który przełącza sesję audio na odtwarzanie mediów.
  let silentEl = null;

  function makeSilentWavUrl() {
    const rate = 8000, n = 800; // 0,1 s ciszy, mono 8-bit
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const str = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, "data"); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128); // 128 = cisza w 8-bit PCM
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }

  function unlockAudio() {
    if (muted) { if (silentEl) silentEl.pause(); return; }
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state !== "running") audio.resume();
      if (!silentEl) {
        silentEl = new Audio(makeSilentWavUrl());
        silentEl.loop = true;
        silentEl.setAttribute("playsinline", "");
      }
      silentEl.play().catch(() => {});
    } catch { /* brak wsparcia audio */ }
  }
  // touchend/click/keydown to gesty, które iOS uznaje za odblokowujące dźwięk
  ["touchend", "click", "keydown"].forEach(t => document.addEventListener(t, unlockAudio, { passive: true }));

  function playMerge(value, delay = 0) {
    if (muted) return;
    try {
      unlockAudio();
      const play = () => scheduleTone(value, delay);
      if (audio.state === "running") play();
      else audio.resume().then(play).catch(() => {});
    } catch { /* brak wsparcia audio – gra działa dalej */ }
  }

  function scheduleTone(value, delay) {
    // im większy kafelek, tym wyższy dźwięk
    const step = Math.log2(value) - 1;
    const semis = PENTATONIC[step % 5] + 12 * Math.floor(step / 5);
    const freq = 330 * Math.pow(2, semis / 12);
    const t0 = audio.currentTime + delay;

    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.28, t0 + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
    master.connect(audio.destination);

    // ton podstawowy z lekkim „bąbelkowym” podbiciem wysokości + kwinta dla blasku
    [[1, "sine", 1], [1.5, "triangle", 0.35], [2, "sine", 0.25]].forEach(([mult, type, vol]) => {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * mult * 0.85, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * mult, t0 + 0.06);
      g.gain.value = vol;
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    });
  }

  // ---------- rysowanie ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  function drawTile(t, now, scale = 1) {
    const p = Math.min(1, (now - animStart) / MOVE_MS);
    const e = ease(p);
    const gx = t.fc + (t.c - t.fc) * e;
    const gy = t.fr + (t.r - t.fr) * e;
    const x = gap + gx * (cell + gap);
    const y = gap + gy * (cell + gap);

    // animacje: pojawianie się i „pop” po scaleniu
    if (t.born > now - POP_MS) scale = Math.max(0, Math.min(1, (now - t.born) / POP_MS));
    if (t.mergedAt) {
      const q = (now - t.mergedAt) / POP_MS;
      if (q >= 0 && q < 1) scale = 1 + 0.2 * Math.sin(q * Math.PI);
    }
    if (scale <= 0) return;

    const [bg, fg] = COLORS[t.v] || ["#3c3a32", "#f9f6f2"];
    const cx = x + cell / 2, cy = y + cell / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    if (t.v === 2048) { ctx.shadowColor = "rgba(243,215,116,.6)"; ctx.shadowBlur = 25; }
    ctx.fillStyle = bg;
    roundRect(-cell / 2, -cell / 2, cell, cell, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    const digits = String(t.v).length;
    const k = digits <= 2 ? 0.45 : digits === 3 ? 0.38 : digits === 4 ? 0.3 : 0.24;
    ctx.fillStyle = fg;
    ctx.font = `bold ${cell * k}px "Clear Sans", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.v, 0, cell * 0.03);
    ctx.restore();
  }

  function draw(now) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = COLORS.board;
    roundRect(0, 0, size, size, 8);
    ctx.fill();

    // pusta siatka
    ctx.fillStyle = COLORS.empty;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        roundRect(gap + c * (cell + gap), gap + r * (cell + gap), cell, cell, 6);
        ctx.fill();
      }

    if (now - animStart > MOVE_MS) ghosts = [];
    for (const g of ghosts) drawTile(g, now);
    for (const t of tiles) drawTile(t, now);
    requestAnimationFrame(draw);
  }

  // ---------- logika ----------
  function move(dr, dc) {
    if (over || !egg.hidden) return;
    let moved = false;
    const now = performance.now();
    const grid = Array.from({ length: N }, () => Array(N).fill(null));
    for (const t of tiles) { t.fr = t.r; t.fc = t.c; t.mergedAt = 0; grid[t.r][t.c] = t; }

    const rows = [...Array(N).keys()];
    const cols = [...Array(N).keys()];
    if (dr > 0) rows.reverse();
    if (dc > 0) cols.reverse();

    const survivors = [];
    const newGhosts = [];
    const mergedFlag = new Set();
    const mergedValues = [];
    for (const r of rows) {
      for (const c of cols) {
        const t = grid[r][c];
        if (!t) continue;
        let nr = r, nc = c, absorbed = false;
        while (true) {
          const tr = nr + dr, tc = nc + dc;
          if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
          const other = grid[tr][tc];
          if (!other) { nr = tr; nc = tc; continue; }
          if (other.v === t.v && !mergedFlag.has(other)) {
            grid[r][c] = null;
            t.r = tr; t.c = tc;
            other.v *= 2;
            other.mergedAt = now + MOVE_MS;
            mergedFlag.add(other);
            mergedValues.push(other.v);
            score += other.v;
            if (other.v === 2048 && !won) won = true;
            newGhosts.push(t);
            absorbed = true;
            moved = true;
          }
          break;
        }
        if (absorbed) continue;
        if (nr !== r || nc !== c) {
          grid[r][c] = null;
          grid[nr][nc] = t;
          t.r = nr; t.c = nc;
          moved = true;
        }
        survivors.push(t);
      }
    }
    if (!moved) return;
    animStart = now;
    // dźwięk po dojechaniu kafelków; największe scalenia pierwsze, max 3 (arpeggio)
    mergedValues.sort((a, b) => b - a).slice(0, 3).reverse()
      .forEach((v, i) => playMerge(v, MOVE_MS / 1000 + i * 0.06));
    tiles = survivors;
    ghosts = newGhosts;
    addRandom();
    updateScore();
    checkState();
    checkEgg();
  }

  function canMove() {
    if (emptyCells().length) return true;
    const g = Array.from({ length: N }, () => Array(N));
    for (const t of tiles) g[t.r][t.c] = t.v;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (c + 1 < N && g[r][c] === g[r][c + 1]) return true;
        if (r + 1 < N && g[r][c] === g[r + 1][c]) return true;
      }
    return false;
  }

  function checkState() {
    if (won && !keepBtn.dataset.used) {
      overlayText.textContent = "Wygrałeś!";
      keepBtn.hidden = false;
      overlay.hidden = false;
      over = true;
      return;
    }
    if (!canMove()) {
      overlayText.textContent = "Koniec gry!";
      keepBtn.hidden = true;
      overlay.hidden = false;
      over = true;
    }
  }

  function restart() {
    delete keepBtn.dataset.used;
    init();
  }

  keepBtn.addEventListener("click", () => {
    keepBtn.dataset.used = "1";
    overlay.hidden = true;
    over = false;
    if (!canMove()) checkState();
  });
  document.getElementById("retry").addEventListener("click", restart);
  const confirmDlg = document.getElementById("confirm");
  document.getElementById("new-game").addEventListener("click", () => confirmDlg.showModal());
  // kliknięcie w przyciemnione tło zamyka arkusz
  confirmDlg.addEventListener("click", e => { if (e.target === confirmDlg) confirmDlg.close(); });
  confirmDlg.addEventListener("close", () => {
    if (confirmDlg.returnValue === "ok") restart();
    confirmDlg.returnValue = "";
  });

  const keys = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
  };
  document.addEventListener("keydown", e => {
    if (!egg.hidden && e.key === "Escape") egg.hidden = true;
    if (modalOpen()) return;
    const dir = keys[e.key] || keys[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    move(...dir);
  });

  let sx, sy;
  document.addEventListener("touchstart", e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (sx == null || modalOpen()) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
    else move(dy > 0 ? 1 : -1, 0);
  }, { passive: true });

  applyTheme();
  // plansza zmienia rozmiar razem z widocznym obszarem (dvh), np. po schowaniu paska adresu
  new ResizeObserver(resize).observe(canvas);
  resize();
  init();
  requestAnimationFrame(draw);
})();
