// ================================================================
//  PewPlay kit — base condivisa del gioco
//  Canvas nitido e ridimensionabile, loop con delta time, menu e
//  schermate in pagina, pausa automatica, audio sintetizzato con
//  pulsante mute, particelle, testi fluttuanti e salvataggi con
//  prefisso. La logica del gioco è in game.js.
// ================================================================
(function () {
  'use strict';

  const PP = {};
  window.PP = PP;

  // roundRect per i browser più vecchi (Safari < 16, Firefox < 112)
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.max(0, Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  // ── UTILITÀ ───────────────────────────────────────
  PP.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PP.lerp = (a, b, t) => a + (b - a) * t;
  PP.rand = (a, b) => a + Math.random() * (b - a);
  PP.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  PP.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  PP.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  PP.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  PP.easeOut = t => 1 - Math.pow(1 - t, 3);
  PP.easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  PP.FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ── SALVATAGGI (chiavi con prefisso GAME_ID) ──────
  PP.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(`${PP.id}:${key}`); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`${PP.id}:${key}`, JSON.stringify(value)); } catch (e) { /* storage pieno o bloccato */ }
    },
  };

  // ── CANVAS ────────────────────────────────────────
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  PP.canvas = canvas;
  PP.ctx = ctx;
  PP.W = 0; PP.H = 0; PP.dpr = 1;
  function resize() {
    PP.dpr = Math.min(window.devicePixelRatio || 1, 2);
    PP.W = Math.max(1, canvas.clientWidth);
    PP.H = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(PP.W * PP.dpr);
    canvas.height = Math.round(PP.H * PP.dpr);
    ctx.setTransform(PP.dpr, 0, 0, PP.dpr, 0, 0);
    if (PP.game && PP.game.resize) PP.game.resize(PP.W, PP.H);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  // Area di gioco a rapporto fisso, scalata e centrata: { s, x, y, w, h }
  PP.fit = (w, h, margin = 0) => {
    const s = Math.min((PP.W - margin * 2) / w, (PP.H - margin * 2) / h);
    return { s, x: (PP.W - w * s) / 2, y: (PP.H - h * s) / 2, w, h };
  };

  // ── DISEGNO ───────────────────────────────────────
  PP.rr = (x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  PP.text = (str, x, y, size, color, align = 'center', weight = 700, base = 'middle') => {
    ctx.font = `${weight} ${size}px ${PP.FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  };
  PP.circle = (x, y, r, color) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
  PP.vgrad = (y0, y1, c0, c1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };

  // ── AUDIO (Web Audio, solo dopo un gesto) ─────────
  let ac = null;
  let master = null;
  PP.muted = false;
  function ensureAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = PP.muted ? 0 : 0.5;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  PP.sfx = {
    // tono singolo: frequenza, durata, forma, volume, frequenza finale
    tone(freq, dur = 0.12, type = 'sine', vol = 0.3, to = null, delay = 0) {
      if (!ac || PP.muted) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur = 0.2, vol = 0.25, filter = 1200, delay = 0) {
      if (!ac || PP.muted) return;
      const t = ac.currentTime + delay;
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    },
    chord(freqs, dur = 0.3, type = 'triangle', vol = 0.16, gap = 0.07) {
      freqs.forEach((f, i) => PP.sfx.tone(f, dur, type, vol, null, i * gap));
    },
    click() { PP.sfx.tone(660, 0.05, 'square', 0.08); },
    win() { PP.sfx.chord([523, 659, 784, 1047], 0.35, 'triangle', 0.18, 0.09); },
    lose() { PP.sfx.chord([392, 330, 262], 0.4, 'sawtooth', 0.1, 0.12); },
  };

  // ── PARTICELLE, TESTI, SCOSSA ─────────────────────
  const parts = [];
  const floats = [];
  PP.shake = 0;
  PP.burst = (x, y, color, n = 16, speed = 220, size = 4, life = 0.7, gravity = 300) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: size * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? PP.pick(color) : color, g: gravity });
    }
  };
  PP.floatText = (str, x, y, color = '#fff', size = 22) => floats.push({ str, x, y, color, size, t: 0 });
  PP.clearFx = () => { parts.length = 0; floats.length = 0; PP.shake = 0; };
  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > 1) floats.splice(i, 1); }
    PP.shake = Math.max(0, PP.shake - dt * 30);
  }
  PP.drawFx = () => {
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * p.life / p.max), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of floats) {
      ctx.globalAlpha = 1 - f.t;
      ctx.font = `800 ${f.size}px ${PP.FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.strokeText(f.str, f.x, f.y - f.t * 40);
      ctx.fillStyle = f.color;
      ctx.fillText(f.str, f.x, f.y - f.t * 40);
    }
    ctx.globalAlpha = 1;
  };

  // ── SCHERMATE (menu, pausa, fine partita) ─────────
  const overlay = document.getElementById('overlay');
  const oTitle = document.getElementById('overlay-title');
  const oText = document.getElementById('overlay-text');
  const oChoices = document.getElementById('overlay-choices');
  const oButtons = document.getElementById('overlay-buttons');
  let primaryBtn = null;

  // menu({ title, text, choices: [{ label, options, value, onChange }], buttons: [{ label, onClick, primary }] })
  PP.menu = (opt) => {
    oTitle.textContent = opt.title || '';
    oText.textContent = opt.text || '';
    oText.style.display = opt.text ? '' : 'none';
    oChoices.innerHTML = '';
    for (const c of opt.choices || []) {
      const row = document.createElement('div');
      row.className = 'choice';
      if (c.label) { const l = document.createElement('span'); l.className = 'choice-label'; l.textContent = c.label; row.appendChild(l); }
      const seg = document.createElement('div');
      seg.className = 'seg';
      c.options.forEach((name, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = name;
        if (i === c.value) b.classList.add('on');
        b.addEventListener('click', e => {
          e.stopPropagation(); ensureAudio(); PP.sfx.click();
          seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          c.onChange(i);
        });
        seg.appendChild(b);
      });
      row.appendChild(seg);
      oChoices.appendChild(row);
    }
    oButtons.innerHTML = '';
    primaryBtn = null;
    for (const btn of opt.buttons || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = btn.primary ? 'btn primary' : 'btn';
      b.textContent = btn.label;
      b.addEventListener('click', e => { e.stopPropagation(); ensureAudio(); PP.sfx.click(); btn.onClick(); });
      oButtons.appendChild(b);
      if (btn.primary && !primaryBtn) primaryBtn = b;
    }
    overlay.classList.remove('hidden');
    PP.overlayOpen = true;
    if (primaryBtn) primaryBtn.focus({ preventScroll: true });
  };
  PP.hideMenu = () => { overlay.classList.add('hidden'); PP.overlayOpen = false; };
  PP.overlayOpen = false;

  // ── STATO E FLUSSO ────────────────────────────────
  // state: 'menu' | 'playing' | 'paused' | 'over'
  PP.state = 'menu';
  PP.time = 0;

  PP.showMain = () => {
    PP.state = 'menu';
    const g = PP.game;
    const best = g.bestText ? g.bestText() : '';
    PP.menu({
      title: g.title,
      text: g.intro + (best ? `\n\n${best}` : ''),
      choices: g.choices ? g.choices() : [],
      buttons: [{ label: g.playLabel || 'Play', primary: true, onClick: PP.start }],
    });
  };
  PP.start = () => {
    PP.clearFx();
    PP.hideMenu();
    PP.state = 'playing';
    PP.game.start();
  };
  PP.pause = () => {
    if (PP.state !== 'playing' || PP.game.noPause) return;
    PP.state = 'paused';
    PP.menu({
      title: 'Paused',
      text: PP.game.pauseText ? PP.game.pauseText() : '',
      buttons: [
        { label: 'Resume', primary: true, onClick: PP.resume },
        { label: 'Restart', onClick: PP.start },
        { label: 'Menu', onClick: PP.showMain },
      ],
    });
  };
  PP.resume = () => { PP.hideMenu(); PP.state = 'playing'; };
  // over(title, text, extraButtons?)
  PP.over = (title, text, extra) => {
    PP.state = 'over';
    setTimeout(() => {
      if (PP.state !== 'over') return;
      PP.menu({
        title, text,
        buttons: [
          { label: 'Play again', primary: true, onClick: PP.start },
          ...(extra || []),
          { label: 'Menu', onClick: PP.showMain },
        ],
      });
    }, PP.game.overDelay === undefined ? 650 : PP.game.overDelay);
  };

  // ── BARRA PULSANTI (pausa + audio) ────────────────
  const ICON_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  const ICON_MUTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';
  const muteBtn = document.getElementById('mute-btn');
  const pauseBtn = document.getElementById('pause-btn');
  function paintMute() {
    muteBtn.innerHTML = PP.muted ? ICON_MUTE : ICON_SOUND;
    muteBtn.setAttribute('aria-label', PP.muted ? 'Unmute' : 'Mute');
  }
  muteBtn.addEventListener('click', e => {
    e.stopPropagation();
    PP.muted = !PP.muted;
    PP.store.set('muted', PP.muted);
    ensureAudio();
    if (master) master.gain.value = PP.muted ? 0 : 0.5;
    paintMute();
  });
  pauseBtn.innerHTML = ICON_PAUSE;
  pauseBtn.addEventListener('click', e => { e.stopPropagation(); ensureAudio(); PP.pause(); });
  for (const b of [muteBtn, pauseBtn]) b.addEventListener('pointerdown', e => e.stopPropagation());

  // ── INPUT ─────────────────────────────────────────
  PP.keys = {};
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, type: e.pointerType, button: e.button };
  }
  canvas.addEventListener('pointerdown', e => {
    ensureAudio();
    if (PP.state !== 'playing') return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorato */ }
    if (PP.game.pointerDown) PP.game.pointerDown(local(e));
  });
  canvas.addEventListener('pointermove', e => { if (PP.state === 'playing' && PP.game.pointerMove) PP.game.pointerMove(local(e)); });
  const up = e => { if (PP.state === 'playing' && PP.game.pointerUp) PP.game.pointerUp(local(e)); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    ensureAudio();
    PP.keys[e.code] = true;
    const onButton = e.target && e.target.tagName === 'BUTTON';
    // nei giochi che usano le lettere (lettersInput) la P serve per scrivere
    if ((e.code === 'Escape' || (e.code === 'KeyP' && !PP.game.lettersInput)) && !e.repeat) {
      e.preventDefault();
      if (PP.state === 'playing') PP.pause();
      else if (PP.state === 'paused') PP.resume();
      return;
    }
    if (PP.overlayOpen) {
      if ((e.code === 'Enter' || e.code === 'Space') && !onButton && primaryBtn) { e.preventDefault(); primaryBtn.click(); }
      return;
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    if (PP.state === 'playing' && PP.game.keyDown) PP.game.keyDown(e.code, e);
  });
  document.addEventListener('keyup', e => { PP.keys[e.code] = false; if (PP.state === 'playing' && PP.game.keyUp) PP.game.keyUp(e.code, e); });

  document.addEventListener('visibilitychange', () => { if (document.hidden) PP.pause(); });
  window.addEventListener('blur', () => PP.pause());

  // ── LOOP ──────────────────────────────────────────
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    PP.time += dt;
    const g = PP.game;
    if (PP.state === 'playing' && g.update) g.update(dt);
    if (PP.state !== 'paused') updateFx(dt);
    if (g.idle && PP.state === 'menu') g.idle(dt);
    ctx.save();
    if (PP.shake > 0) ctx.translate((Math.random() - 0.5) * PP.shake, (Math.random() - 0.5) * PP.shake);
    g.draw(ctx, PP.W, PP.H);
    ctx.restore();
    requestAnimationFrame(loop);
  }

  // ── AVVIO ─────────────────────────────────────────
  // PP.run(game): game = { id, title, intro, start(), update(dt), draw(ctx,W,H), ... }
  PP.run = (game) => {
    PP.game = game;
    PP.id = game.id;
    PP.muted = PP.store.get('muted', false);
    paintMute();
    resize();
    if (game.init) game.init();
    PP.showMain();
    requestAnimationFrame(t => { last = t; loop(t); });
  };

  // Per gli screenshot e le prove: porta il gioco a uno stato preciso
  PP.demo = (n) => {
    PP.clearFx();
    PP.hideMenu();
    PP.state = 'playing';
    PP.game.start();
    if (PP.game.demo) PP.game.demo(n);
  };
})();
