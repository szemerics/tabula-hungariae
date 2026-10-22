// Az oldal vezérlése: idővonal, eseménykártya, lejátszás, rétegek, hang.
import { EVENTS, ERAS } from './events.js';
import { MapView } from './map.js';
import { Soundscape } from './audio.js';
import { Particles, applyPapers } from './fx.js';

const THEMES = {
  kronika: { num: 'I.', name: 'Középkori krónika', range: 'a 9. századtól 1526-ig', cue: 'page' },
  rezmetszet: { num: 'II.', name: 'Rézmetszetes térkép', range: 'a 16–18. század', cue: 'page' },
  konyomat: { num: 'III.', name: 'Kőnyomatos atlasz', range: 'a 19. század', cue: 'page' },
  hadi: { num: 'IV.', name: 'Hadi térkép', range: '1914–1947', cue: 'type' },
  hideg: { num: 'V.', name: 'Hidegháború', range: '1947–1989', cue: 'radio' },
  modern: { num: 'V.', name: 'A mai Európa', range: '1990-től', cue: 'sparkle' },
};
const ROLE_LABEL = { ghost: '1914-es határ', lost: 'Elcsatolt területek', lost2: 'Horvát–Szlavónország (elcsatolva)' };
const FLASH_MOODS = new Set(['mongol', 'battle', 'war', 'ww2', 'uprising']);

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const state = { i: -1, started: false, playing: false, playTimer: null, token: 0 };
const sound = new Soundscape();
const fx = new Particles($('#fx'));
applyPapers();

// ------------------------------------------------------------------ data + map
const topo = await fetch('data/map.topo.json').then((r) => r.json());
const map = new MapView($('#map'), topo, { onPlaceHover: showTooltip });

// ------------------------------------------------------------------ timeline
function buildTimeline() {
  const ol = $('#events');
  let idx = 0;
  ol.innerHTML = ERAS.map((era) => {
    const evs = EVENTS.filter((e) => e.era === era.id);
    const items = evs.map((e) => {
      const i = idx++;
      return `<li><button type="button" class="tl-ev" data-i="${i}" aria-label="${esc(e.year)}: ${esc(e.title)}">
        <span class="tl-ev__tip">${esc(e.title)}</span><span class="tl-ev__dot"></span><span class="tl-ev__year">${esc(e.year)}</span></button></li>`;
    }).join('');
    return `<li class="tl-era" data-era="${era.id}" style="flex:${evs.length}"><span class="tl-era__label">${esc(era.label)}</span><ol>${items}</ol></li>`;
  }).join('');
  ol.addEventListener('click', (e) => {
    const b = e.target.closest('.tl-ev');
    if (b) { stopPlay(); go(+b.dataset.i); }
  });
  ol.addEventListener('mouseover', (e) => { if (e.target.closest('.tl-ev')) sound.cue('tick'); });
}

function updateTimeline() {
  const ev = EVENTS[state.i];
  document.querySelectorAll('.tl-ev').forEach((b) => {
    const i = +b.dataset.i;
    b.classList.toggle('is-active', i === state.i);
    b.classList.toggle('is-past', i < state.i);
    b.setAttribute('aria-current', i === state.i ? 'step' : 'false');
  });
  document.querySelectorAll('.tl-era').forEach((li) => li.classList.toggle('is-current', li.dataset.era === ev.era));
  const track = $('#track');
  const dot = document.querySelector('.tl-ev.is-active .tl-ev__dot');
  if (!dot) return;
  const tr = track.getBoundingClientRect();
  const dr = dot.getBoundingClientRect();
  const x = dr.left + dr.width / 2 - tr.left + track.scrollLeft;
  $('#progress').style.width = `${x}px`;
  if (track.scrollWidth > track.clientWidth) track.scrollTo({ left: x - track.clientWidth / 2, behavior: 'smooth' });
}

// ------------------------------------------------------------------ card
function renderCard(ev, i) {
  const theme = THEMES[ev.theme];
  const era = ERAS.find((e) => e.id === ev.era);
  const feats = map.byEvent.get(ev.id) || [];
  const legend = [];
  const seen = new Set();
  for (const f of feats) {
    const { role, name } = f.properties;
    if (role === 'nb') continue;
    const label = role === 'lost' ? ROLE_LABEL.lost : ROLE_LABEL[role] || name;
    if (seen.has(label)) continue;
    seen.add(label);
    legend.push([role, label]);
  }
  if (ev.id === 'e1956' || ev.id === 'e1989') legend.push(['curtain', 'Vasfüggöny']);
  if (ev.id === 'e2004') legend.push(['eu', 'EU-tagállamok (2004)']);
  legend.push(['modern', 'Mai határ']);

  const words = ev.text.split(' ').map((w, k) => `<span class="w" style="transition-delay:${(k * 0.022).toFixed(3)}s">${esc(w)}</span>`).join(' ');
  const max = ev.breakdown ? Math.max(...ev.breakdown.map((b) => b[1])) : 1;
  const flag = ev.id === 'e1956' ? `<svg class="flag56" viewBox="0 0 60 40" role="img" aria-label="A lyukas zászló, 1956 jelképe">
      <defs><mask id="flag-hole"><rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="8.5" fill="#000"/></mask></defs>
      <g mask="url(#flag-hole)"><rect width="60" height="13.4" fill="#ce2939"/><rect y="13.3" width="60" height="13.4" fill="#f4f4f4"/><rect y="26.6" width="60" height="13.4" fill="#477050"/></g></svg>` : '';

  $('#card-body').innerHTML = `
    <div class="card__meta"><span>${esc(era.label)}</span><span>${i + 1} / ${EVENTS.length}</span></div>
    <p class="card__year">${esc(ev.year)}</p>
    <h2 class="card__title">${esc(ev.title)}</h2>
    <p class="card__subtitle">${esc(ev.subtitle)}</p>
    <p class="card__text">${flag}${words}</p>
    ${ev.phases ? `<ol class="phases">${ev.phases.map((p, k) => `<li><button type="button" class="phase" data-p="${k + 1}"><b>${esc(p.label)}</b><span>${esc(p.text)}</span></button></li>`).join('')}</ol>` : ''}
    ${ev.breakdown ? `<div class="breakdown"><h3>Kinek jutott? (km², Horvátország nélkül)</h3>${ev.breakdown.map(([n, v]) => `
      <div class="bar"><span>${esc(n)}</span><span class="bar__track"><span class="bar__fill" data-w="${((v / max) * 100).toFixed(1)}"></span></span><span class="bar__val">${v.toLocaleString('hu-HU')}</span></div>`).join('')}</div>` : ''}
    <dl class="card__facts">${ev.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <h3 class="card__section-title">Jelmagyarázat</h3>
    <ul class="card__legend">${legend.map(([r, l]) => `<li><span class="sw sw--${r}"></span>${esc(l)}</li>`).join('')}</ul>
    <p class="card__note">${esc(theme.name)} · A határok közelítőek, nyílt adatok alapján.</p>`;
  $('#card-body').scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $('.card__text')?.classList.add('is-in');
    document.querySelectorAll('.bar__fill').forEach((b) => { b.style.width = `${b.dataset.w}%`; });
  }));
  document.querySelectorAll('.phase').forEach((b) => b.addEventListener('click', () => {
    state.phaseToken = Symbol('manual');
    setPhase(+b.dataset.p);
  }));
}

async function swapCard(ev, i) {
  const card = $('#card');
  card.classList.remove('is-entering');
  card.classList.add('is-leaving');
  await sleep(state.started ? 280 : 0);
  renderCard(ev, i);
  card.classList.remove('is-leaving');
  void card.offsetWidth;
  card.classList.add('is-entering');
}

function setPhase(p) {
  map.setPhase(p);
  sound.cue('stamp');
  document.querySelectorAll('.phase').forEach((b) => {
    const k = +b.dataset.p;
    b.classList.toggle('is-active', k === p);
    b.classList.toggle('is-done', k < p);
  });
}

// ------------------------------------------------------------------ era banner
function showBanner(theme) {
  const t = THEMES[theme];
  const el = $('#era-banner');
  el.querySelector('.era-banner__num').textContent = `${t.num} korszak`;
  el.querySelector('.era-banner__name').textContent = t.name;
  el.querySelector('.era-banner__range').textContent = t.range;
  el.classList.remove('is-on');
  void el.offsetWidth;
  el.classList.add('is-on');
}

// ------------------------------------------------------------------ navigation
async function go(i, { instant = false } = {}) {
  i = Math.max(0, Math.min(EVENTS.length - 1, i));
  if (i === state.i) return;
  const prev = EVENTS[state.i];
  const ev = EVENTS[i];
  state.i = i;
  const token = ++state.token;
  const themeChange = !prev || prev.theme !== ev.theme;

  updateTimeline();
  history.replaceState(null, '', `#${ev.id.slice(1)}`);
  document.title = `${ev.year} – ${ev.title} · Tabula Hungariae`;

  if (themeChange && state.started) {
    showBanner(ev.theme);
    setTimeout(() => applyTheme(ev), 450);
  } else applyTheme(ev);

  document.body.dataset.mood = ev.mood;
  sound.setMood(ev.mood);
  fx.setMood(ev.mood);
  if (state.started && !instant) {
    sound.cue('whoosh');
    setTimeout(() => sound.cue(THEMES[ev.theme].cue), 350);
  }

  swapCard(ev, i);
  await map.show(ev, { instant });
  if (token !== state.token || !state.started) return;
  await eventExtras(ev, token);
  if (state.playing && token === state.token) schedulePlay(ev);
}

function applyTheme(ev) {
  document.body.dataset.theme = ev.theme;
  $('#era-name').textContent = THEMES[ev.theme].name;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue('--paper').trim() || '#3a2615';
}

async function eventExtras(ev, token) {
  const alive = () => token === state.token;
  switch (ev.id) {
    case 'e1241':
    case 'e1526':
      sound.cue('boom');
      pulse('flash', 900);
      break;
    case 'e1920':
      await sleep(1600);
      if (!alive()) return;
      sound.cue('tear');
      pulse('shake', 600);
      await map.tearTrianon();
      break;
    case 'e1938': {
      const pt = (state.phaseToken = Symbol('auto'));
      for (let p = 1; p <= 4; p++) {
        await sleep(p === 1 ? 600 : 2600);
        if (!alive() || state.phaseToken !== pt) return;
        setPhase(p);
      }
      break;
    }
    case 'e1989':
      await sleep(3700);
      if (!alive()) return;
      sound.cue('sparkle');
      { const [x, y] = map.screen([16.65, 47.74]); fx.burst(x, y, 60); }
      break;
    case 'e2004':
      sound.cue('sparkle');
      break;
    default:
  }
}

function pulse(cls, ms) {
  if (map.reduceMotion) return;
  document.body.classList.remove(cls);
  void document.body.offsetWidth;
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), ms);
}

// ------------------------------------------------------------------ playback
function schedulePlay(ev) {
  clearTimeout(state.playTimer);
  const dwell = Math.max(10000, ev.text.length * 32) + (ev.phases ? 4000 : 0) + (ev.id === 'e1920' ? 3000 : 0);
  state.playTimer = setTimeout(() => {
    if (!state.playing) return;
    if (state.i >= EVENTS.length - 1) { stopPlay(); return; }
    go(state.i + 1);
  }, dwell);
}

function startPlay() {
  state.playing = true;
  $('#play').setAttribute('aria-pressed', 'true');
  $('#play').setAttribute('aria-label', 'Szünet');
  if (state.i >= EVENTS.length - 1) go(0);
  else schedulePlay(EVENTS[state.i]);
}

function stopPlay() {
  state.playing = false;
  clearTimeout(state.playTimer);
  $('#play').setAttribute('aria-pressed', 'false');
  $('#play').setAttribute('aria-label', 'Lejátszás');
}

// ------------------------------------------------------------------ tooltip
let tipTimer;
function showTooltip(place, e, sticky) {
  const tip = $('#tooltip');
  clearTimeout(tipTimer);
  if (!place) { if (!tip.dataset.sticky) tip.hidden = true; return; }
  tip.innerHTML = `<strong>${esc(place.n)}</strong>${esc(place.note)}`;
  tip.hidden = false;
  const [x, y] = map.screen(place.c);
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(innerWidth - r.width - 10, Math.max(10, x + 14))}px`;
  tip.style.top = `${Math.max(10, y - r.height - 12)}px`;
  if (sticky) {
    tip.dataset.sticky = '1';
    tipTimer = setTimeout(() => { tip.hidden = true; delete tip.dataset.sticky; }, 3500);
  } else delete tip.dataset.sticky;
}
document.addEventListener('click', () => { const t = $('#tooltip'); t.hidden = true; delete t.dataset.sticky; });

// ------------------------------------------------------------------ controls
function initControls() {
  $('#prev').addEventListener('click', () => { stopPlay(); go(state.i - 1); });
  $('#next').addEventListener('click', () => { stopPlay(); go(state.i + 1); });
  $('#play').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));

  const layers = store.get('hm-layers', { neighbours: true, modern: true, places: true });
  document.querySelectorAll('[data-layer]').forEach((b) => {
    const name = b.dataset.layer;
    const apply = (on) => { b.setAttribute('aria-pressed', String(on)); map.setLayer(name, on); };
    apply(layers[name] !== false);
    b.addEventListener('click', () => {
      layers[name] = b.getAttribute('aria-pressed') !== 'true';
      apply(layers[name]);
      store.set('hm-layers', layers);
      sound.cue('tick');
    });
  });

  const snd = store.get('hm-sound', { on: true, volume: 0.7 });
  sound.enabled = snd.on;
  sound.volume = snd.volume;
  $('#volume').value = snd.volume;
  $('#sound-toggle').setAttribute('aria-pressed', String(snd.on));
  $('#sound-toggle').addEventListener('click', async () => {
    snd.on = !snd.on;
    $('#sound-toggle').setAttribute('aria-pressed', String(snd.on));
    if (snd.on) { await sound.start(); sound.setMood(EVENTS[state.i].mood); }
    sound.setEnabled(snd.on);
    store.set('hm-sound', snd);
  });
  $('#volume').addEventListener('input', (e) => {
    snd.volume = +e.target.value;
    sound.setVolume(snd.volume);
    store.set('hm-sound', snd);
  });
  sound.onBoom = (lvl) => {
    const mood = EVENTS[state.i]?.mood;
    if (FLASH_MOODS.has(mood) && lvl > 0.3 && Date.now() - (state.lastFlash || 0) > 7000) {
      state.lastFlash = Date.now();
      pulse('flash', 900);
    }
  };

  // On phones the card starts collapsed so the map gets the room; tap to open.
  const card = $('#card');
  const toggleCard = (collapsed) => {
    card.classList.toggle('is-collapsed', collapsed);
    $('#card-handle').setAttribute('aria-expanded', String(!collapsed));
    if (state.i >= 0) setTimeout(() => map.flyTo(EVENTS[state.i].view, 600), 50);
  };
  if (matchMedia('(max-width: 760px)').matches) toggleCard(true);
  $('#card-handle').addEventListener('click', (e) => { e.stopPropagation(); toggleCard(!card.classList.contains('is-collapsed')); });
  card.addEventListener('click', () => { if (card.classList.contains('is-collapsed')) toggleCard(false); });

  // Swipe on the map to step between events
  let touch = null;
  $('#stage').addEventListener('touchstart', (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, at: Date.now() }; }, { passive: true });
  $('#stage').addEventListener('touchend', (e) => {
    if (!touch || !state.started) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50 && Date.now() - touch.at < 700) { stopPlay(); go(state.i + (dx < 0 ? 1 : -1)); }
    touch = null;
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (!state.started || e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight') { stopPlay(); go(state.i + 1); }
    else if (e.key === 'ArrowLeft') { stopPlay(); go(state.i - 1); }
    else if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); state.playing ? stopPlay() : startPlay(); }
    else if (e.key === 'Home') { stopPlay(); go(0); }
    else if (e.key === 'End') { stopPlay(); go(EVENTS.length - 1); }
  });

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { map.resize(); map.placeLabels(); updateTimeline(); }, 120);
  });

  addEventListener('hashchange', () => {
    const i = indexFromHash();
    if (i !== -1 && i !== state.i && state.started) go(i);
  });
}

function indexFromHash() {
  const h = location.hash.replace('#', '');
  return EVENTS.findIndex((e) => e.id === `e${h}`);
}

// ------------------------------------------------------------------ start
buildTimeline();
initControls();
$('#start').addEventListener('click', async () => {
  state.started = true;
  $('#intro').classList.add('is-gone');
  document.body.classList.remove('is-intro');
  if (sound.enabled) {
    await sound.start();
    sound.setMood(EVENTS[state.i].mood);
    sound.cue('whoosh');
  }
  updateTimeline();
  setTimeout(() => $('#intro').remove(), 1200);
  // replay the opening so the first map draws itself in front of the viewer
  const i = state.i;
  state.i = -1;
  map.current = null;
  go(i);
});

// the first map is drawn behind the intro
go(Math.max(0, indexFromHash()), { instant: true });
