// A térkép: rétegek, kamera (zoom/pásztázás), feliratok és az eseményenkénti animációk.
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import * as topojson from 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm';

const BASE = { w: 1600, h: 1100 };
const WORLD = [4, 35.5, 46, 57];
const HU_CENTER = [19.4, 47.15];
const TERR_ORDER = ['ghost', 'lost2', 'lost', 'hu2', 'hu3', 'ott', 'hu', 'gain'];
const LABEL_PRIORITY = { hu: 100, gain: 95, ott: 92, hu3: 90, hu2: 88, lost: 80, lost2: 79, place: 70, nb: 50 };
const RIVER_LABELS = [
  { n: 'Duna', c: [18.93, 46.62], r: 84 },
  { n: 'Tisza', c: [20.2, 46.83], r: 70 },
  { n: 'Dráva', c: [17.55, 45.92], r: -22 },
  { n: 'Száva', c: [17.9, 45.13], r: -8 },
];

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class MapView {
  constructor(svgEl, topo, { onPlaceHover } = {}) {
    this.svg = d3.select(svgEl);
    this.onPlaceHover = onPlaceHover;
    this.layers = { neighbours: true, modern: true, places: true };
    this.t = d3.zoomIdentity;
    this.current = null;
    this.phase = 0;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const L = (k) => topojson.feature(topo, topo.objects[k]).features;
    this.data = { land: L('land'), modern: L('modern'), ev: L('ev'), rivers: L('rivers'), lakes: L('lakes'), curtain: L('curtain') };
    this.byEvent = d3.group(this.data.ev, (f) => f.properties.ev);

    this.proj = d3.geoConicConformal().parallels([44, 50]).rotate([-19.5, 0])
      .fitExtent([[0, 0], [BASE.w, BASE.h]], { type: 'MultiPoint', coordinates: [[WORLD[0], WORLD[1]], [WORLD[2], WORLD[3]], [WORLD[0], WORLD[3]], [WORLD[2], WORLD[1]]] });
    this.path = d3.geoPath(this.proj);
    this.build();
  }

  // ------------------------------------------------------------------ setup
  build() {
    const { svg, path } = this;
    const defs = svg.append('defs');
    const hatch = (id, cls, angle, gap, bg) => {
      const p = defs.append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse').attr('width', gap).attr('height', gap)
        .attr('patternTransform', `rotate(${angle})`).attr('class', 'hatch');
      if (bg) p.append('rect').attr('width', gap).attr('height', gap).attr('class', `${cls}-bg`);
      p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', gap).attr('class', cls);
      return p;
    };
    hatch('hatch-ott', 'h-ott', 45, 6, true);
    hatch('hatch-lost', 'h-lost', -45, 6, true);
    hatch('hatch-hu', 'h-hu', 45, 5, true);
    defs.append('style').text(`
      .h-ott { stroke: var(--ott); stroke-width: 2; } .h-ott-bg { fill: color-mix(in srgb, var(--ott) 32%, transparent); }
      .h-lost { stroke: var(--accent); stroke-width: 1.2; } .h-lost-bg { fill: color-mix(in srgb, var(--nb3) 70%, transparent); }
      .h-hu { stroke: var(--hu); stroke-width: 1.6; } .h-hu-bg { fill: color-mix(in srgb, var(--hu) 28%, transparent); }`);
    const ink = defs.append('filter').attr('id', 'ink').attr('x', '-5%').attr('y', '-5%').attr('width', '110%').attr('height', '110%');
    ink.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', 0.9).attr('numOctaves', 2).attr('result', 'n');
    ink.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'n').attr('scale', 2.2);
    const glow = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    glow.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'b');
    const m = glow.append('feMerge');
    m.append('feMergeNode').attr('in', 'b');
    m.append('feMergeNode').attr('in', 'SourceGraphic');

    this.world = svg.append('g').attr('class', 'world');
    this.world.append('rect').attr('class', 'sea').attr('x', -4000).attr('y', -4000).attr('width', BASE.w + 8000).attr('height', BASE.h + 8000);
    const landD = this.data.land.map(path).join('');
    const ripples = this.world.append('g').attr('class', 'sea-lines');
    [[22, 0.35], [15, 0], [10, 0.6], [5, 0]].forEach(([w, o]) => {
      ripples.append('path').attr('d', landD).style('stroke-width', `${w}px`)
        .style('stroke', o ? null : 'var(--sea)').style('opacity', o || 1);
    });
    this.world.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule().extent([[WORLD[0], WORLD[1]], [WORLD[2], WORLD[3]]]).step([2, 2])()));
    this.world.append('path').attr('class', 'land').attr('d', landD);
    this.gNb = this.world.append('g').attr('class', 'neighbours');
    this.gTerr = this.world.append('g').attr('class', 'territories');
    this.world.append('g').attr('class', 'rivers').selectAll('path').data(this.data.rivers).join('path')
      .attr('class', (f) => `w${f.properties.w}`).attr('d', path);
    this.world.append('g').attr('class', 'lakes').selectAll('path').data(this.data.lakes).join('path').attr('d', path);
    this.modernOutline = this.world.append('path').attr('class', 'modern-outline').attr('d', this.data.modern.map(path).join(''));
    this.gCurtain = this.world.append('g').attr('class', 'curtain').style('opacity', 0);

    this.overlay = svg.append('g').attr('class', 'overlay');
    this.gRiverLbl = this.overlay.append('g').attr('class', 'river-labels');
    this.gLabels = this.overlay.append('g').attr('class', 'labels');
    this.gPlaces = this.overlay.append('g').attr('class', 'places');
    this.gRing = this.overlay.append('g').attr('class', 'eu-ring').style('opacity', 0);

    this.riverLabels = this.gRiverLbl.selectAll('text').data(RIVER_LABELS).join('text').attr('class', 'lbl lbl--river').text((d) => d.n);
    this.resize();
  }

  // ------------------------------------------------------------------ camera
  resize() {
    const el = this.svg.node();
    this.W = el.clientWidth;
    this.H = el.clientHeight;
    this.svg.attr('viewBox', `0 0 ${this.W} ${this.H}`);
    if (this.current) this.setTransform(this.fitTransform(this.current.view));
  }

  // The part of the screen not covered by the header, the card and the timeline.
  viewport() {
    const css = getComputedStyle(document.documentElement);
    const top = parseFloat(css.getPropertyValue('--top')) || 70;
    const bottom = parseFloat(css.getPropertyValue('--bottom')) || 110;
    const mobile = this.W <= 760;
    const card = document.getElementById('card');
    const cardW = !mobile && card ? card.offsetWidth + 34 : 0;
    const cardH = mobile && card ? Math.min(card.offsetHeight, this.H * 0.3) : 0;
    return { x: 16, y: top, w: this.W - cardW - 32, h: this.H - top - bottom - cardH - 8 };
  }

  fitTransform(view) {
    const [w, s, e, n] = view;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const lon = w + ((e - w) * i) / 8;
      const lat = s + ((n - s) * i) / 8;
      pts.push(this.proj([lon, s]), this.proj([lon, n]), this.proj([w, lat]), this.proj([e, lat]));
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const vp = this.viewport();
    // on narrow portrait screens allow cropping the sides a little to zoom in
    const crop = vp.w < 520 ? 1.4 : 1;
    const k = Math.min((vp.w / (x1 - x0)) * crop, vp.h / (y1 - y0));
    const tx = vp.x + vp.w / 2 - (k * (x0 + x1)) / 2;
    const ty = vp.y + vp.h / 2 - (k * (y0 + y1)) / 2;
    return d3.zoomIdentity.translate(tx, ty).scale(k);
  }

  setTransform(t) {
    this.t = t;
    this.world.attr('transform', t).style('--k', t.k);
    this.svg.selectAll('pattern.hatch').attr('patternTransform', function () {
      const a = this.id === 'hatch-lost' ? -45 : 45;
      return `scale(${1 / t.k}) rotate(${a})`;
    });
    this.positionOverlay();
  }

  flyTo(view, duration = 1600) {
    const to = this.fitTransform(view);
    const from = this.t;
    if (this.reduceMotion || duration === 0 || !this.current) {
      this.setTransform(to);
      return Promise.resolve();
    }
    // interpolateZoom works on [cx, cy, width] in base coordinates
    const vp = this.viewport();
    const toView = (t) => [(vp.x + vp.w / 2 - t.x) / t.k, (vp.y + vp.h / 2 - t.y) / t.k, vp.w / t.k];
    const interp = d3.interpolateZoom(toView(from), toView(to));
    const dur = Math.max(duration, Math.min(interp.duration * 0.9, 2600));
    return new Promise((resolve) => {
      this.svg.interrupt('camera').transition('camera').duration(dur).ease(d3.easeCubicInOut)
        .tween('camera', () => (u) => {
          const [cx, cy, w] = interp(u);
          const k = vp.w / w;
          this.setTransform(d3.zoomIdentity.translate(vp.x + vp.w / 2 - cx * k, vp.y + vp.h / 2 - cy * k).scale(k));
        })
        .on('end interrupt', resolve);
    });
  }

  screen(lonlat) {
    const p = this.proj(lonlat);
    return this.t.apply(p);
  }

  positionOverlay() {
    this.gLabels.selectAll('text').attr('transform', (d) => { const [x, y] = this.screen(d.c); return `translate(${x + (d.dx || 0)},${y + (d.dy || 0)})`; });
    this.gPlaces.selectAll('g.mk').attr('transform', (d) => `translate(${this.screen(d.c)})`);
    this.riverLabels.attr('transform', (d) => `translate(${this.screen(d.c)}) rotate(${d.r})`);
    if (this.ringCenter) this.gRing.attr('transform', `translate(${this.screen(this.ringCenter)})`);
  }

  // ------------------------------------------------------------------ layers
  setLayer(name, on) {
    this.layers[name] = on;
    const body = document.body;
    body.classList.toggle('hide-neighbours', name === 'neighbours' ? !on : body.classList.contains('hide-neighbours'));
    body.classList.toggle('hide-modern', name === 'modern' ? !on : body.classList.contains('hide-modern'));
    body.classList.toggle('hide-places', name === 'places' ? !on : body.classList.contains('hide-places'));
    this.placeLabels();
  }

  // ------------------------------------------------------------------ events
  async show(ev, { instant = false } = {}) {
    const prev = this.current;
    this.current = ev;
    this.phase = 0;
    this.torn = false;
    const token = (this.token = Symbol('show'));
    const feats = this.byEvent.get(ev.id) || [];
    const dur = instant || this.reduceMotion ? 0 : 1;

    // fade out the previous event
    this.gNb.selectAll('g.ev').classed('ev--old', true).transition().duration(700 * dur).style('opacity', 0).remove();
    this.gTerr.selectAll('g.ev').classed('ev--old', true).transition().duration(700 * dur).style('opacity', 0).remove();
    // interrupt pending fade-ins first, otherwise transition.remove() would skip them
    this.gLabels.selectAll('text:not(.is-old)').classed('is-old', true).interrupt().interrupt('place')
      .transition('out').duration(400 * dur).style('opacity', 0).remove();
    this.gPlaces.selectAll('g.mk:not(.is-old)').classed('is-old', true).interrupt()
      .transition('out').duration(400 * dur).style('opacity', 0).remove();
    this.gRing.interrupt().transition().duration(500 * dur).style('opacity', 0);
    this.gCurtain.interrupt().transition().duration(600 * dur).style('opacity', 0);

    const camera = this.flyTo(ev.view, prev ? 1700 : 0);

    // neighbours
    const nbG = this.gNb.append('g').attr('class', 'ev').style('opacity', 0);
    nbG.selectAll('path').data(feats.filter((f) => f.properties.role === 'nb')).join('path')
      .attr('class', (f) => `nb c${hash(f.properties.name) % 6}${f.properties.bloc ? ' bloc' : ''}${f.properties.eu ? ' eu' : ''}`)
      .attr('d', this.path);
    nbG.transition().delay(300 * dur).duration(1100 * dur).style('opacity', 1);

    // territories
    const terr = feats.filter((f) => f.properties.role !== 'nb')
      .sort((a, b) => TERR_ORDER.indexOf(a.properties.role) - TERR_ORDER.indexOf(b.properties.role));
    const tG = this.gTerr.append('g').attr('class', 'ev');
    const groups = tG.selectAll('g.terr').data(terr).join('g')
      .attr('class', (f) => `terr r-${f.properties.role}${f.properties.name === 'Etelköz' ? ' r-etelkoz' : ''}`)
      .attr('data-phase', (f) => f.properties.phase || null);
    groups.append('path').attr('class', 'terr__fill').attr('d', this.path);
    groups.append('path').attr('class', 'terr__line').attr('d', this.path);
    this.territories = groups;

    if (ev.id === 'e1938') groups.filter((f) => f.properties.role === 'gain').style('display', 'none');
    if (ev.id === 'e1947') this.addFadingGains(tG);

    // draw-in animation: fill fades in, solid borders are inked along their length
    groups.filter((f) => f.properties.role !== 'gain').each((f, i, nodes) => this.inkIn(d3.select(nodes[i]), 500 * dur + i * 120 * dur, dur));

    if (ev.id === 'e1956' || ev.id === 'e1989') this.showCurtain(ev.id === 'e1989', dur);

    await camera;
    if (token !== this.token) return;
    this.renderLabels(ev, feats);
    this.renderPlaces(ev);
    this.positionOverlay();
    this.placeLabels();
    if (ev.id === 'e2004') this.showEuRing(dur);
  }

  inkIn(sel, delay, dur) {
    const fill = sel.select('.terr__fill');
    const line = sel.select('.terr__line');
    fill.style('fill-opacity', 0).transition().delay(delay + 300 * dur).duration(1200 * dur).style('fill-opacity', null);
    const role = sel.datum().properties.role;
    const solid = ['hu', 'ott', 'gain', 'lost', 'lost2'].includes(role);
    if (!solid || !dur) {
      line.style('opacity', 0).transition().delay(delay).duration(1000 * dur).style('opacity', null);
      return;
    }
    const node = line.node();
    const len = node.getTotalLength();
    line.style('stroke-dasharray', `${len} ${len}`).style('stroke-dashoffset', len)
      .transition().delay(delay).duration(Math.min(2600, 900 + len * 0.5) * dur).ease(d3.easeCubicInOut)
      .style('stroke-dashoffset', 0)
      .on('end', () => line.style('stroke-dasharray', null).style('stroke-dashoffset', null));
  }

  // 1947: the 1938–41 gains are shown briefly and then fade away
  addFadingGains(parent) {
    const gains = (this.byEvent.get('e1938') || []).filter((f) => f.properties.role === 'gain');
    const g = parent.insert('g', ':first-child').attr('class', 'terr r-gain');
    g.selectAll('path').data(gains).join('path').attr('class', 'terr__fill').attr('d', this.path);
    g.transition().delay(1400).duration(2200).style('opacity', 0).remove();
  }

  // Phases of the 1938–41 event (0 = none shown, 4 = all)
  setPhase(p, { animate = true } = {}) {
    if (!this.territories || this.current?.id !== 'e1938') return;
    const prev = this.phase;
    this.phase = p;
    this.territories.filter((f) => f.properties.role === 'gain').each((f, i, nodes) => {
      const sel = d3.select(nodes[i]);
      const on = f.properties.phase <= p;
      const wasOn = f.properties.phase <= prev;
      sel.style('display', on ? null : 'none');
      if (on && !wasOn && animate) this.inkIn(sel, 0, 1);
    });
    this.renderLabels(this.current, this.byEvent.get('e1938'));
    this.positionOverlay();
    this.placeLabels();
  }

  // 1920: the parts taken away are first shown as Hungarian, then torn off
  async tearTrianon() {
    if (!this.territories || this.current?.id !== 'e1920') return;
    const token = this.token;
    const c = this.proj(HU_CENTER);
    const lost = this.territories.filter((f) => f.properties.role === 'lost' || f.properties.role === 'lost2');
    this.torn = true;
    this.gLabels.selectAll('.lbl--pending').classed('lbl--pending', false);
    lost.classed('is-lost', true).attr('transform', (f) => {
      const [x, y] = this.path.centroid(f);
      const d = Math.hypot(x - c[0], y - c[1]) || 1;
      const off = 9 / this.t.k;
      return `translate(${((x - c[0]) / d) * off},${((y - c[1]) / d) * off})`;
    });
    this.territories.filter((f) => f.properties.role === 'hu').each((f, i, nodes) => this.inkIn(d3.select(nodes[i]), 200, 1));
    await sleep(2600);
    if (token !== this.token) return;
    lost.attr('transform', null);
  }

  showCurtain(opening, dur) {
    this.gCurtain.selectAll('*').remove();
    const segs = this.data.curtain;
    for (const cls of ['c-ticks', 'c-base']) {
      this.gCurtain.selectAll(`path.${cls}`).data(segs).join('path').attr('class', (f) => `${cls} part-${f.properties.part}`).attr('d', this.path);
    }
    this.gCurtain.transition().delay(600 * dur).duration(1200 * dur).style('opacity', 1);
    if (opening) {
      this.gCurtain.selectAll('.part-hu').transition().delay(3600 * (dur || 0)).duration(2400).style('opacity', 0);
    }
  }

  showEuRing(dur) {
    this.ringCenter = HU_CENTER;
    const R = Math.min(this.W, this.H) * 0.22;
    const star = d3.symbol(d3.symbolStar, Math.max(90, R * 0.9))();
    this.gRing.selectAll('*').remove();
    const g = this.gRing.append('g');
    g.selectAll('path').data(d3.range(12)).join('path').attr('d', star)
      .attr('transform', (i) => `rotate(${i * 30}) translate(0,${-R}) rotate(${-i * 30})`)
      .style('opacity', 0)
      .transition().delay((i) => 300 + i * 110 * (dur || 0)).duration(500).style('opacity', 1);
    g.attr('transform', 'rotate(-40) scale(.6)').transition().duration(2600 * (dur || 0)).ease(d3.easeCubicOut).attr('transform', 'rotate(0) scale(1)');
    this.gRing.transition().duration(400).style('opacity', 0.95);
    this.positionOverlay();
  }

  // ------------------------------------------------------------------ labels
  renderLabels(ev, feats) {
    const items = [];
    for (const f of feats) {
      const p = f.properties;
      if (p.lx == null || p.role === 'ghost') continue;
      if (p.role === 'gain' && ev.id === 'e1938' && p.phase > this.phase) continue;
      items.push({ c: [p.lx, p.ly], name: p.name, role: p.role, prio: LABEL_PRIORITY[p.role] ?? 40 });
    }
    const sel = this.gLabels.selectAll('text.lbl:not(.is-old)').data(items, (d) => d.role + d.name);
    sel.exit().remove();
    const enter = sel.enter().append('text').style('opacity', 0);
    enter.merge(sel)
      .attr('class', (d) => `lbl ${d.role === 'nb' ? 'lbl--nb' : d.role === 'lost' || d.role === 'lost2' ? 'lbl--lost' : d.role === 'hu' ? 'lbl--hu' : 'lbl--hu lbl--sub'}`)
      .classed('lbl--pending', (d) => ev.id === 'e1920' && d.role.startsWith('lost') && !this.torn)
      .each(function (d) {
        const t = d3.select(this);
        t.selectAll('tspan').remove();
        const lines = wrap(d.name, d.role === 'nb' ? 18 : 20);
        lines.forEach((ln, i) => t.append('tspan').attr('x', 0).attr('dy', i === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em').text(ln));
      });
  }

  renderPlaces(ev) {
    const g = this.gPlaces.selectAll('g.mk:not(.is-old)').data(ev.places, (d) => d.n).join((enter) => {
      const m = enter.append('g').attr('class', (d) => `mk mk--${d.t} is-new`).attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', (d) => `${d.n}: ${d.note}`).style('opacity', 0);
      m.append('circle').attr('class', 'mk__pulse').attr('r', 7);
      m.each(function (d) {
        const s = d3.select(this);
        if (d.t === 'battle') {
          s.append('circle').attr('class', 'mk__halo').attr('r', 7.5);
          s.append('path').attr('class', 'mk__dot').attr('d', 'M-4.5-4.5L4.5 4.5M4.5-4.5L-4.5 4.5');
        } else if (d.t === 'site') {
          s.append('path').attr('class', 'mk__dot').attr('d', 'M0-5.5L5.5 0 0 5.5-5.5 0Z');
        } else {
          s.append('circle').attr('class', 'mk__dot').attr('r', d.t === 'capital' ? 5.5 : 4);
          if (d.t === 'capital') s.append('circle').attr('r', 2).style('fill', 'var(--halo)');
        }
      });
      m.append('text').attr('class', 'lbl lbl--place').attr('x', 10).attr('dy', '0.05em').text((d) => d.n);
      m.transition().delay((d, i) => 200 + i * 140).duration(500).style('opacity', 1);
      return m;
    });
    g.on('mouseenter focus', (e, d) => this.onPlaceHover?.(d, e))
      .on('mouseleave blur', () => this.onPlaceHover?.(null))
      .on('click', (e, d) => { e.stopPropagation(); this.onPlaceHover?.(d, e, true); });
  }

  // Greedy label placement. Marker symbols are fixed obstacles; region labels may
  // shift a little to find room, place names may flip to the left of their marker.
  placeLabels() {
    const boxes = [];
    const hit = (b) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    const v = this.viewport();
    const vp = { x: 4, y: v.y - 8, w: Math.min(v.x + v.w + 24, this.W - 6), h: v.y + v.h + 16 };
    const inside = (b) => b.x > vp.x && b.y > vp.y && b.x + b.w < vp.w && b.y + b.h < vp.h;
    const ok = (b) => inside(b) && !hit(b);
    const hideNb = document.body.classList.contains('hide-neighbours');
    const showPlaces = this.layers.places;

    const markers = this.gPlaces.selectAll('g.mk:not(.is-old)');
    if (showPlaces) markers.each((d) => { const [x, y] = this.screen(d.c); boxes.push({ x: x - 8, y: y - 8, w: 16, h: 16 }); });

    const labels = [];
    this.gLabels.selectAll('text.lbl:not(.is-old)').each(function (d) { labels.push({ el: this, d, r: this.getBBox() }); });
    labels.sort((a, b) => b.d.prio - a.d.prio);
    const SHIFTS = [[0, 0], [0, -16], [0, 16], [-24, 0], [24, 0], [0, -30], [0, 30], [-40, -14], [40, 14], [-40, 14], [40, -14]];
    const placeRegion = ({ el, d, r }) => {
      d.dx = 0; d.dy = 0;
      let shown = false;
      if (!(d.role === 'nb' && hideNb)) {
        const [x, y] = this.screen(d.c);
        for (const [dx, dy] of d.role === 'nb' ? SHIFTS.slice(0, 5) : SHIFTS) {
          const b = { x: x + r.x + dx - 2, y: y + r.y + dy - 1, w: r.width + 4, h: r.height + 2 };
          if (ok(b)) { boxes.push(b); d.dx = dx; d.dy = dy; shown = true; break; }
        }
      }
      d3.select(el).attr('transform', `translate(${this.screen(d.c).map((n, i) => n + (i ? d.dy : d.dx))})`)
        .transition('place').duration(500).style('opacity', shown ? 1 : 0);
    };

    labels.filter((l) => l.d.prio >= 80).forEach(placeRegion);
    if (showPlaces) {
      markers.each((d, i, nodes) => {
        const t = d3.select(nodes[i]).select('.lbl--place');
        const [x, y] = this.screen(d.c);
        t.attr('x', 10).style('text-anchor', 'start');
        const r = t.node().getBBox();
        const right = { x: x + r.x - 1, y: y + r.y, w: r.width + 2, h: r.height };
        const left = { ...right, x: x - 10 - r.width - 1 };
        let side = ok(right) ? right : ok(left) ? left : null;
        if (side === left) t.attr('x', -10).style('text-anchor', 'end');
        if (side) boxes.push(side);
        t.style('opacity', side ? 1 : 0);
      });
    }
    labels.filter((l) => l.d.prio < 80).forEach(placeRegion);

    // river names only where they do not hit anything
    this.riverLabels.style('opacity', (d, i, nodes) => {
      const r = nodes[i].getBoundingClientRect();
      const b = { x: r.left, y: r.top, w: r.width, h: r.height };
      return ok(b) ? 0.85 : 0;
    });
  }
}

function wrap(text, max) {
  if (text.length <= max || !text.includes(' ')) return [text];
  const words = text.split(' ');
  let best = [text], bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) { bestDiff = diff; best = [a, b]; }
  }
  return best;
}
