// Grafikus effektek: generált papírtextúrák korszakonként és egy részecske-réteg
// (por, parázs, füst, hamu, kokárdaszirmok, csillagok…).

const rand = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ paper textures
const PAPER = {
  kronika: { base: '#e6d3a7', blot: [92, 58, 20], blotA: 0.16, grain: 18, fibers: 260, stains: 5, edge: 0.35 },
  rezmetszet: { base: '#efe5cc', blot: [110, 80, 40], blotA: 0.07, grain: 12, laid: true, foxing: 90, edge: 0.18 },
  konyomat: { base: '#f2ecdc', blot: [120, 100, 70], blotA: 0.05, grain: 9, edge: 0.1 },
  hadi: { base: '#d6caa9', blot: [80, 65, 30], blotA: 0.1, grain: 16, folds: true, stains: 2, edge: 0.25 },
  hideg: { base: '#151a20', blot: [0, 0, 0], blotA: 0.25, grain: 14, scan: true, edge: 0 },
  modern: { base: '#f2f5f8', blot: [140, 160, 180], blotA: 0.03, grain: 3, dots: true, edge: 0 },
};

function blotLayer(ctx, size, cells, [r, g, b], alpha) {
  const c = document.createElement('canvas');
  c.width = c.height = cells;
  const x = c.getContext('2d');
  const img = x.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) {
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.pow(Math.random(), 2.2) * 255 * alpha;
  }
  x.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, size, size);
}

export function makePaper(theme, size = 1024) {
  const o = PAPER[theme];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = o.base;
  ctx.fillRect(0, 0, size, size);
  blotLayer(ctx, size, 6, o.blot, o.blotA * 1.2);
  blotLayer(ctx, size, 18, o.blot, o.blotA);
  blotLayer(ctx, size, 70, o.blot, o.blotA * 0.6);

  if (o.laid) {
    ctx.strokeStyle = 'rgba(90,70,40,0.05)';
    for (let x = 0; x < size; x += 28) { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, size); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(90,70,40,0.025)';
    for (let y = 0; y < size; y += 3) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(size, y + 0.5); ctx.stroke(); }
  }
  if (o.fibers) {
    for (let i = 0; i < o.fibers; i++) {
      ctx.strokeStyle = `rgba(110,75,35,${rand(0.03, 0.09)})`;
      ctx.lineWidth = rand(0.4, 1);
      const x = rand(0, size), y = rand(0, size), l = rand(6, 26), a = rand(0, Math.PI);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rand(-4, 4), y + Math.sin(a) * l * 0.5 + rand(-4, 4), x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  if (o.foxing) {
    for (let i = 0; i < o.foxing; i++) {
      const r = rand(1, 5);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(140,90,40,0.18)');
      g.addColorStop(1, 'rgba(140,90,40,0)');
      ctx.save(); ctx.translate(rand(0, size), rand(0, size)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();
    }
  }
  for (let i = 0; i < (o.stains || 0); i++) {
    const x = rand(80, size - 80), y = rand(80, size - 80), r = rand(30, 90);
    ctx.strokeStyle = `rgba(${o.blot.join(',')},0.1)`;
    ctx.lineWidth = rand(2, 5);
    ctx.beginPath(); ctx.arc(x, y, r, rand(0, 1), rand(4.5, 6.3)); ctx.stroke();
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, `rgba(${o.blot.join(',')},0.0)`);
    g.addColorStop(1, `rgba(${o.blot.join(',')},0.06)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  if (o.folds) {
    const cols = 4, rows = 3;
    for (let i = 1; i < cols; i++) {
      const x = (size * i) / cols;
      const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.48, 'rgba(60,45,20,0.13)'); g.addColorStop(0.52, 'rgba(255,250,235,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 10, 0, 20, size);
    }
    for (let j = 1; j < rows; j++) {
      const y = (size * j) / rows;
      const g = ctx.createLinearGradient(0, y - 10, 0, y + 10);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.48, 'rgba(60,45,20,0.12)'); g.addColorStop(0.52, 'rgba(255,250,235,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y - 10, size, 20);
    }
  }
  if (o.scan) {
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 1);
  }
  if (o.dots) {
    ctx.fillStyle = 'rgba(80,100,130,0.07)';
    for (let x = 12; x < size; x += 24) for (let y = 12; y < size; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); }
  }
  // fine grain
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * o.grain;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  if (o.edge) {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, 'rgba(60,35,10,0)');
    g.addColorStop(1, `rgba(60,35,10,${o.edge})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return c;
}

export function applyPapers() {
  for (const layer of document.querySelectorAll('.paper__layer')) {
    const theme = layer.dataset.for;
    const make = () => makePaper(theme).toBlob((b) => {
      if (!b) return;
      layer.style.backgroundImage = `url(${URL.createObjectURL(b)})`;
      layer.style.backgroundSize = 'cover';
    });
    if (theme === document.body.dataset.theme) make();
    else if (window.requestIdleCallback) requestIdleCallback(make, { timeout: 1500 });
    else setTimeout(make, 400);
  }
}

// ------------------------------------------------------------------ particles
// Particle kinds: how they move and look
const KINDS = {
  mote: { size: [1, 2.6], vx: [-0.08, 0.08], vy: [-0.12, 0.02], life: [5, 11], glow: true },
  rise: { size: [1, 2.4], vx: [-0.05, 0.05], vy: [-0.45, -0.2], life: [5, 10], glow: true },
  streak: { size: [40, 120], vx: [-2.2, -1.2], vy: [-0.05, 0.05], life: [2, 4], line: true },
  dust: { size: [1, 3], vx: [-1.6, -0.6], vy: [-0.1, 0.12], life: [4, 8] },
  ember: { size: [1.2, 3], vx: [-0.25, 0.25], vy: [-1.3, -0.5], life: [2.5, 6], glow: true, from: 'bottom', flicker: true },
  smoke: { size: [60, 150], vx: [-0.2, 0.25], vy: [-0.45, -0.15], life: [8, 16], from: 'bottom', smoke: true },
  ash: { size: [1.2, 3.2], vx: [-0.25, 0.25], vy: [0.25, 0.7], life: [8, 16], from: 'top', spin: true },
  petal: { size: [4, 7], vx: [-0.35, 0.35], vy: [0.5, 1.1], life: [7, 13], from: 'top', spin: true, rect: true },
  leaf: { size: [5, 9], vx: [-0.5, 0.2], vy: [0.4, 0.9], life: [8, 14], from: 'top', spin: true, rect: true },
  star: { size: [3, 6], vx: [-0.06, 0.06], vy: [-0.15, -0.02], life: [3, 7], star: true, glow: true },
  spark: { size: [1.2, 2.6], vx: [-2.5, 2.5], vy: [-2.5, 1.5], life: [0.8, 1.8], glow: true, gravity: 0.03 },
};

// Which particles each mood emits: [kind, count, colours]
const MOODS = {
  steppe: [['streak', 10, ['rgba(120,90,50,0.10)']], ['mote', 34, ['#c9a45a', '#e3c98a']]],
  horde: [['dust', 70, ['rgba(120,90,50,0.35)', 'rgba(150,115,70,0.3)']], ['streak', 14, ['rgba(120,90,50,0.12)']]],
  coronation: [['rise', 46, ['#e8c36a', '#f5dc95', '#c99a3a']]],
  mongol: [['ember', 70, ['#ff8a3d', '#ffb347', '#e0452b']], ['smoke', 12, ['rgba(70,50,35,0.10)']]],
  battle: [['ember', 55, ['#ff8a3d', '#ffb347', '#e0452b']], ['smoke', 14, ['rgba(60,45,30,0.11)']]],
  ottoman: [['mote', 30, ['#b98a2e', '#d8b56b']]],
  baroque: [['mote', 30, ['#a08050', '#c8a878']]],
  revolution: [['petal', 46, ['#ce2939', '#ffffff', '#477050']]],
  waltz: [['mote', 34, ['#c9b48a', '#e8d6a8']]],
  war: [['ash', 55, ['rgba(70,65,55,0.55)', 'rgba(110,100,85,0.5)']], ['smoke', 9, ['rgba(60,55,45,0.09)']]],
  requiem: [['ash', 70, ['rgba(80,75,65,0.5)', 'rgba(130,120,105,0.45)']]],
  ww2: [['smoke', 14, ['rgba(50,45,40,0.12)']], ['ash', 45, ['rgba(60,55,50,0.55)']], ['ember', 22, ['#ff8a3d', '#e0452b']]],
  postwar: [['ash', 26, ['rgba(90,85,75,0.4)']]],
  uprising: [['smoke', 12, ['rgba(160,165,175,0.07)']], ['ember', 26, ['#ff7a5c', '#ffb347']], ['leaf', 16, ['#9a5b2c', '#b5762f', '#7d4a22']]],
  freedom: [['rise', 50, ['#ffe7a3', '#ffffff', '#ffd0c4']]],
  europe: [['star', 40, ['#f2b705', '#ffd84d']]],
};

export class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.spec = [];
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.smokeSprite = this.makeSmoke();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  makeSmoke() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return c;
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setMood(mood) {
    const scale = this.reduce ? 0.15 : this.w < 760 ? 0.55 : 1;
    this.spec = (MOODS[mood] || []).map(([kind, n, colors]) => ({ kind, n: Math.round(n * scale), colors }));
    // let existing particles die out naturally; shorten their lives
    for (const p of this.items) p.life = Math.min(p.life, p.age + rand(0.5, 1.5));
  }

  spawn(kind, colors, init = false, at = null) {
    const k = KINDS[kind];
    const p = {
      kind, k,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: rand(...k.size),
      vx: rand(...k.vx), vy: rand(...k.vy),
      life: rand(...k.life), age: init ? rand(0, 4) : 0,
      rot: rand(0, Math.PI * 2), vr: rand(-0.04, 0.04),
      phase: rand(0, Math.PI * 2),
    };
    if (at) { p.x = at[0]; p.y = at[1]; }
    else if (k.from === 'bottom') { p.x = rand(0, this.w); p.y = init ? rand(0, this.h) : this.h + rand(0, 40); }
    else if (k.from === 'top') { p.x = rand(-40, this.w); p.y = init ? rand(0, this.h) : rand(-40, -5); }
    else if (kind === 'dust' || kind === 'streak') { p.x = init ? rand(0, this.w) : this.w + rand(0, 100); p.y = rand(0, this.h); }
    else { p.x = rand(0, this.w); p.y = rand(0, this.h); }
    this.items.push(p);
  }

  burst(x, y, n = 40, colors = ['#ffd84d', '#ffffff', '#f2b705']) {
    for (let i = 0; i < n; i++) this.spawn('spark', colors, false, [x, y]);
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);

    // keep populations up
    for (const s of this.spec) {
      const have = this.items.reduce((a, p) => a + (p.kind === s.kind && p.age < p.life ? 1 : 0), 0);
      for (let i = have; i < s.n; i++) if (Math.random() < 0.08 || this.items.length < 4) this.spawn(s.kind, s.colors, this.items.length < 4);
    }

    const f = dt * 60;
    this.items = this.items.filter((p) => p.age < p.life + 0.6 && p.x > -200 && p.x < this.w + 200 && p.y > -200 && p.y < this.h + 200);
    for (const p of this.items) {
      p.age += dt;
      p.x += (p.vx + Math.sin(now / 1300 + p.phase) * 0.15) * f;
      p.y += p.vy * f;
      if (p.k.gravity) p.vy += p.k.gravity * f;
      p.rot += p.vr * f;
      const fadeIn = Math.min(1, p.age / 1.2);
      const fadeOut = p.age > p.life ? Math.max(0, 1 - (p.age - p.life) / 0.6) : 1;
      let a = fadeIn * fadeOut;
      if (p.k.flicker) a *= 0.6 + 0.4 * Math.sin(now / 90 + p.phase);
      if (p.k.star) a *= 0.5 + 0.5 * Math.sin(now / 400 + p.phase);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      if (p.k.smoke) {
        ctx.globalAlpha = a * 0.9;
        const s = p.size * (1 + p.age / p.life);
        ctx.filter = 'none';
        ctx.drawImage(this.tint(p.color), p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.k.line) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.size, p.y + Math.sin(p.phase) * 3);
        ctx.stroke();
      } else if (p.k.rect) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.sin(now / 300 + p.phase));
        ctx.fillStyle = p.color;
        if (p.color === '#ffffff') { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.5; ctx.strokeRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.k.star) {
        ctx.fillStyle = p.color;
        drawStar(ctx, p.x, p.y, p.size, p.rot);
      } else {
        ctx.fillStyle = p.color;
        if (p.k.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.size * 4;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame((t) => this.frame(t));
  }

  tint(color) {
    this.tints ||= new Map();
    if (!this.tints.has(color)) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      x.drawImage(this.smokeSprite, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color.replace(/[\d.]+\)$/, '1)');
      x.fillRect(0, 0, 128, 128);
      const alpha = parseFloat(color.match(/([\d.]+)\)$/)?.[1] ?? '0.1');
      const out = document.createElement('canvas');
      out.width = out.height = 128;
      const o = out.getContext('2d');
      o.globalAlpha = alpha;
      o.drawImage(c, 0, 0);
      this.tints.set(color, out);
    }
    return this.tints.get(color);
  }
}

function drawStar(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.42 : r;
    const a = rot + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
