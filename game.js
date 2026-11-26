// ================================================================
//  WORD SEARCH — PewPlay
//  @bg #fff8ef
//  @accent #ff7a59
//  @light
//  12 temi, tre griglie (8×8, 10×10, 12×12). Si trascina dalla prima
//  all'ultima lettera. Diagonali e parole al contrario nei livelli alti.
// ================================================================
(function () {
  'use strict';
  const { clamp, sfx, store } = PP;

  const GAME_ID = 'word-search';
  const THEMES = {
    Animals: 'TIGER ZEBRA HORSE MONKEY RABBIT TURTLE PARROT DOLPHIN GIRAFFE PANDA KOALA LION WOLF CAMEL OTTER EAGLE BEAR FOX',
    Food: 'PIZZA PASTA BREAD CHEESE BURGER SALAD SOUP NOODLE TACO HONEY BUTTER COOKIE PANCAKE RICE OMELET WAFFLE',
    Space: 'PLANET COMET GALAXY ORBIT ROCKET METEOR NEBULA STAR MOON SATURN MARS COSMOS ASTEROID ECLIPSE SOLAR VENUS',
    Sports: 'SOCCER TENNIS HOCKEY RUGBY GOLF BOXING SKIING CYCLING ROWING KARATE SURFING ARCHERY BASEBALL CRICKET JUDO',
    Nature: 'FOREST RIVER MOUNTAIN VALLEY MEADOW CANYON DESERT ISLAND LAKE BREEZE FLOWER JUNGLE CLIFF PEBBLE MOSS FERN',
    Ocean: 'WHALE SHARK CORAL WAVE TIDE SQUID CRAB SEAHORSE OCTOPUS REEF ANCHOR SHELL OYSTER LOBSTER SAILOR HARBOR',
    Music: 'GUITAR PIANO DRUMS VIOLIN FLUTE MELODY RHYTHM CHORUS TEMPO HARP TRUMPET SONG CELLO BANJO OPERA CHORD',
    Weather: 'SUNNY CLOUD STORM THUNDER RAINBOW SNOW FROST BREEZE TORNADO DRIZZLE FOG HAIL MONSOON CLIMATE WIND HUMID',
    Jobs: 'DOCTOR TEACHER PILOT CHEF NURSE FARMER BAKER PLUMBER ARTIST DENTIST LAWYER WRITER JUDGE BARBER TAILOR',
    Fruits: 'APPLE BANANA CHERRY MANGO GRAPE LEMON MELON PEACH PEAR PLUM KIWI ORANGE PAPAYA LIME APRICOT COCONUT',
    Colors: 'RED BLUE GREEN YELLOW PURPLE ORANGE PINK BLACK WHITE BROWN SILVER GOLD VIOLET INDIGO MAROON TEAL BEIGE',
    Travel: 'TICKET PASSPORT AIRPORT HOTEL LUGGAGE BEACH CRUISE MAP COMPASS TRAIN JOURNEY CAMERA TOURIST VISA SUITCASE',
  };
  const THEME_NAMES = Object.keys(THEMES);
  const LEVELS = ['Easy', 'Medium', 'Hard'];
  const SIZE = [8, 10, 12], COUNT = [7, 10, 13];
  const DIRS = [[[1, 0], [0, 1]], [[1, 0], [0, 1], [1, 1], [1, -1]], [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]]];
  const HUES = ['#ff7a59', '#4fb3ff', '#5ac46e', '#b57bef', '#f2b632', '#ff5d8f', '#2ec4b6', '#8d6bff', '#ff9f1c', '#3ddc97', '#e85d75', '#5c7cfa', '#fab005'];

  let level = 0, themeIdx = -1;
  let N, grid, words, found, sel, time, theme, done;
  let geo = {};

  function build() {
    N = SIZE[level];
    theme = themeIdx >= 0 ? THEME_NAMES[themeIdx] : PP.pick(THEME_NAMES);
    const pool = PP.shuffle(THEMES[theme].split(' ').filter(w => w.length <= N));
    for (let attempt = 0; attempt < 50; attempt++) {
      grid = Array.from({ length: N }, () => Array(N).fill(''));
      words = [];
      for (const w of pool) {
        if (words.length >= COUNT[level]) break;
        let placed = false;
        for (let t = 0; t < 200 && !placed; t++) {
          const [dx, dy] = PP.pick(DIRS[level]);
          const x = PP.randInt(0, N - 1), y = PP.randInt(0, N - 1);
          const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
          if (ex < 0 || ey < 0 || ex >= N || ey >= N) continue;
          let ok = true;
          for (let i = 0; i < w.length; i++) { const c = grid[y + dy * i][x + dx * i]; if (c && c !== w[i]) { ok = false; break; } }
          if (!ok) continue;
          for (let i = 0; i < w.length; i++) grid[y + dy * i][x + dx * i] = w[i];
          words.push({ w, x, y, dx, dy, color: HUES[words.length % HUES.length] });
          placed = true;
        }
      }
      if (words.length >= Math.min(COUNT[level], pool.length - 2)) break;
    }
    const L = 'ABCDEFGHIJKLMNOPRSTUVWYEAIO';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!grid[y][x]) grid[y][x] = L[PP.randInt(0, L.length - 1)];
    words.sort((a, b) => a.w.localeCompare(b.w));
  }

  function start() { build(); found = new Set(); sel = null; time = 0; done = false; }

  // ── GEOMETRIA ───────────────────────────────────
  function layout() {
    const W = PP.W, H = PP.H, top = 64;
    const land = W > H * 1.15;
    const listW = land ? Math.min(260, W * 0.3) : W - 24;
    const listH = land ? H - top - 16 : Math.min(H * 0.24, 46 + Math.ceil((words ? words.length : 10) / 3) * 30);
    const gw = land ? W - listW - 40 : W - 24, gh = land ? H - top - 16 : H - top - listH - 24;
    const cell = Math.floor(Math.min(gw / N, gh / N));
    const gx = land ? 16 + (gw - cell * N) / 2 : (W - cell * N) / 2, gy = top + (gh - cell * N) / 2;
    geo = { land, cell, gx, gy, lx: land ? W - listW - 16 : 12, ly: land ? top : gy + cell * N + 16, lw: listW, lh: listH };
  }

  // ── LOGICA ──────────────────────────────────────
  function cellAt(p) {
    const x = Math.floor((p.x - geo.gx) / geo.cell), y = Math.floor((p.y - geo.gy) / geo.cell);
    return x >= 0 && y >= 0 && x < N && y < N ? { x, y } : null;
  }
  function selection() {
    if (!sel || !sel.end) return null;
    let dx = sel.end.x - sel.start.x, dy = sel.end.y - sel.start.y;
    // aggancia alla direzione più vicina tra le 8
    const len = Math.max(Math.abs(dx), Math.abs(dy));
    if (!len) return { x: sel.start.x, y: sel.start.y, dx: 0, dy: 0, len: 0 };
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const ux = Math.round(Math.cos(ang)), uy = Math.round(Math.sin(ang));
    let n = len;
    while (n > 0 && (sel.start.x + ux * n < 0 || sel.start.y + uy * n < 0 || sel.start.x + ux * n >= N || sel.start.y + uy * n >= N)) n--;
    return { x: sel.start.x, y: sel.start.y, dx: ux, dy: uy, len: n };
  }
  function check() {
    const s = selection(); if (!s || !s.len) return;
    let str = '';
    for (let i = 0; i <= s.len; i++) str += grid[s.y + s.dy * i][s.x + s.dx * i];
    const rev = [...str].reverse().join('');
    const w = words.find(w => !found.has(w.w) && (w.w === str || w.w === rev) && w.w.length === s.len + 1 &&
      ((w.x === s.x && w.y === s.y) || (w.x === s.x + s.dx * s.len && w.y === s.y + s.dy * s.len) || true));
    if (w) {
      found.add(w.w);
      const ex = w.x + w.dx * (w.w.length - 1), ey = w.y + w.dy * (w.w.length - 1);
      PP.burst(geo.gx + (ex + 0.5) * geo.cell, geo.gy + (ey + 0.5) * geo.cell, [w.color, '#fff'], 18, 200, 4, 0.7, 200);
      sfx.chord([523 + found.size * 20, 659 + found.size * 20], 0.12, 'triangle', 0.13, 0.05);
      if (found.size === words.length) finish();
    } else sfx.tone(200, 0.06, 'sine', 0.05);
  }
  function finish() {
    done = true;
    const key = `best-${level}`, b = store.get(key, 0), rec = !b || time < b;
    if (rec) store.set(key, Math.floor(time));
    sfx.win();
    PP.burst(PP.W / 2, PP.H / 2, HUES, 60, 420, 5, 1.4, 300);
    PP.game.overDelay = 1000;
    PP.over(rec ? 'New best time!' : 'All words found!', `${theme} · ${LEVELS[level]} · ${fmt(time)}\nBest: ${fmt(rec ? time : b)}`);
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function update(dt) { if (!done) time += dt; }

  // ── DISEGNO ─────────────────────────────────────
  function capsule(ctx, x0, y0, x1, y1, color, alpha) {
    const c = geo.cell;
    const ax = geo.gx + (x0 + 0.5) * c, ay = geo.gy + (y0 + 0.5) * c, bx = geo.gx + (x1 + 0.5) * c, by = geo.gy + (y1 + 0.5) * c;
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = c * 0.78;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
  }

  function draw(ctx, W, H) {
    ctx.fillStyle = '#fff8ef'; ctx.fillRect(0, 0, W, H);
    if (!grid) start();
    layout();
    const { cell, gx, gy } = geo;
    ctx.save(); ctx.shadowColor = 'rgba(80,50,20,.15)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
    PP.rr(gx - 8, gy - 8, cell * N + 16, cell * N + 16, 16); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    if (PP.state !== 'menu') {
      for (const w of words) if (found.has(w.w)) capsule(ctx, w.x, w.y, w.x + w.dx * (w.w.length - 1), w.y + w.dy * (w.w.length - 1), w.color, 0.45);
      const s = selection();
      if (s) capsule(ctx, s.x, s.y, s.x + s.dx * s.len, s.y + s.dy * s.len, '#ffcf5a', 0.7);
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) PP.text(PP.state === 'menu' ? '•' : grid[y][x], gx + (x + 0.5) * cell, gy + (y + 0.5) * cell + 1, cell * 0.52, '#2b2a33', 'center', 800);
    if (PP.state === 'menu') return;
    // elenco parole
    const cols = geo.land ? 1 : 3;
    const colW = geo.lw / cols;
    const rowH = geo.land ? Math.min(34, (geo.lh - 40) / words.length) : 28;
    PP.text(theme.toUpperCase(), geo.lx + (geo.land ? 0 : 4), geo.ly + 12, 13, '#ff7a59', 'left', 900);
    words.forEach((w, i) => {
      const cx = geo.lx + (i % cols) * colW + (geo.land ? 0 : 4), cy = geo.ly + 36 + Math.floor(i / cols) * rowH;
      const f = found.has(w.w);
      ctx.globalAlpha = f ? 0.45 : 1;
      PP.circle(cx + 6, cy, 5, w.color);
      PP.text(w.w, cx + 18, cy + 1, Math.min(16, rowH * 0.55, colW / (w.w.length * 0.75)), '#2b2a33', 'left', 800);
      if (f) { ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = 2; ctx.font = `800 ${Math.min(16, rowH * 0.55, colW / (w.w.length * 0.75))}px ${PP.FONT}`; const tw = ctx.measureText(w.w).width; ctx.beginPath(); ctx.moveTo(cx + 16, cy + 1); ctx.lineTo(cx + 20 + tw, cy + 1); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
    PP.text(`${found.size}/${words.length} · ${fmt(time)}`, 14, 30, 17, '#2b2a33', 'left', 800);
    PP.drawFx();
  }

  // ── INPUT ───────────────────────────────────────
  function pointerDown(p) { const c = cellAt(p); if (c) { sel = { start: c, end: c }; sfx.click(); } }
  function pointerMove(p) { if (!sel) return; const c = cellAt(p); if (c) sel.end = c; }
  function pointerUp() { if (sel) { check(); sel = null; } }

  function demo(n) {
    level = [0, 0, 1, 2][n]; themeIdx = [0, 0, 2, 9][n];
    start();
    const k = [0, 2, 5, 9][n];
    words.slice(0, k).forEach(w => found.add(w.w));
    time = [0, 48, 132, 260][n];
    if (n === 1 || n === 3) { const w = words[k]; if (w) sel = { start: { x: w.x, y: w.y }, end: { x: w.x + w.dx * (w.w.length - 2), y: w.y + w.dy * (w.w.length - 2) } }; }
    themeIdx = -1;
    PP.game.update = () => {};
  }

  function icon(c, S) {
    c.fillStyle = '#fff8ef'; c.fillRect(0, 0, S, S);
    const cell = S * 0.13, n = 4, x0 = S / 2 - cell * n / 2, y0 = S / 2 - cell * n / 2;
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(x0 - 10, y0 - 10, cell * n + 20, cell * n + 20, 18); c.fill();
    c.lineCap = 'round'; c.lineWidth = cell * 0.78;
    c.strokeStyle = 'rgba(255,122,89,.5)'; c.beginPath(); c.moveTo(x0 + cell * 0.5, y0 + cell * 0.5); c.lineTo(x0 + cell * 3.5, y0 + cell * 0.5); c.stroke();
    c.strokeStyle = 'rgba(79,179,255,.5)'; c.beginPath(); c.moveTo(x0 + cell * 0.5, y0 + cell * 1.5); c.lineTo(x0 + cell * 2.5, y0 + cell * 3.5); c.stroke();
    const L = ['WORD', 'AXRE', 'TSKO', 'QPEN'];
    c.fillStyle = '#2b2a33'; c.font = `800 ${cell * 0.55}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    L.forEach((row, r) => [...row].forEach((ch, k) => c.fillText(ch, x0 + (k + 0.5) * cell, y0 + (r + 0.5) * cell + 2)));
  }

  const realUpdate = update;
  PP.run({
    id: GAME_ID,
    title: 'Word Search',
    intro: 'Find every hidden word in the grid — each puzzle has a new theme.\nDrag from the first letter to the last.',
    choices: () => [
      { label: 'Difficulty', options: LEVELS, value: level, onChange: i => { level = i; store.set('level', i); PP.showMain(); } },
    ],
    bestText: () => { const b = store.get(`best-${level}`, 0); return b ? `Best time (${LEVELS[level]}): ${fmt(b)}` : ''; },
    pauseText: () => `${theme} · ${found.size}/${words.length} words`,
    init() { level = store.get('level', 0); },
    start() { PP.game.update = realUpdate; start(); },
    update, draw, pointerDown, pointerMove, pointerUp, demo, icon,
  });
})();
