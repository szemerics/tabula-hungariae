// Draws the logo (assets/img/logo.svg) and the favicon from the map data:
// a seal with a compass rose and the outline of the Kingdom of Hungary (1867–1918)
// with the Danube and the Tisza.
// Usage: cd tools && node make-logo.mjs

import mapshaper from 'mapshaper';
import fs from 'node:fs/promises';

const topo = await fs.readFile(new URL('../data/map.topo.json', import.meta.url), 'utf8');
const PROJ = '+proj=lcc +lat_1=44 +lat_2=50 +lat_0=47 +lon_0=19.5 +datum=WGS84';

async function run(cmd, files) {
  const out = await mapshaper.applyCommands(cmd + ' -o out.json format=geojson', files);
  return JSON.parse(String(out['out.json']));
}

const shapeLL = await run(`-i m.json -target ev -filter "ev==='e1867' && role==='hu'" -dissolve`, { 'm.json': topo });
const riversLL = await run(`-i m.json -target rivers -filter "n==='Duna' || n==='Tisza'"`, { 'm.json': topo });
const clipped = await run('-i r.json -clip s.json', { 'r.json': riversLL, 's.json': shapeLL });
const shape = await run(`-i s.json -proj ${PROJ} -simplify 18% keep-shapes`, { 's.json': shapeLL });
const rivers = await run(`-i r.json -proj ${PROJ} -simplify 25%`, { 'r.json': clipped });

const geoms = (fc) => (fc.features || fc.geometries || []).map((f) => f.geometry || f);
const rings = (g) => (g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.type === 'LineString' ? [g.coordinates] : g.coordinates);

// fit the outline into a box centred in the seal (y axis flipped)
const pts = geoms(shape).flatMap((g) => rings(g).flat());
const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const W = 168;
const k = W / (x1 - x0);
const cx = 128, cy = 134;
const tx = (x) => (cx + (x - (x0 + x1) / 2) * k).toFixed(1);
const ty = (y) => (cy - (y - (y0 + y1) / 2) * k).toFixed(1);
const toPath = (fc, close) => geoms(fc).flatMap((g) => rings(g).filter((r) => r.length > (close ? 8 : 2)).map((r) => 'M' + r.map(([x, y]) => `${tx(x)} ${ty(y)}`).join('L') + (close ? 'Z' : ''))).join('');
const huD = toPath(shape, true);
const riverD = toPath(rivers, false);

// 8-point compass rose
const star = (R, r, rot) => {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 ? r : R;
    p.push(`${(128 + Math.sin(a) * rr).toFixed(1)} ${(128 - Math.cos(a) * rr).toFixed(1)}`);
  }
  return `M${p.join('L')}Z`;
};

// degree ticks on the rim, longer every 30°
const ticks = Array.from({ length: 72 }, (_, i) => {
  const a = (i * Math.PI) / 36;
  const r0 = i % 6 ? 114.5 : 112;
  return `M${(128 + Math.sin(a) * r0).toFixed(1)} ${(128 - Math.cos(a) * r0).toFixed(1)}L${(128 + Math.sin(a) * 118).toFixed(1)} ${(128 - Math.cos(a) * 118).toFixed(1)}`;
}).join('');

function svg({ rivers: withRivers = true, stroke = 1 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Tabula Hungariae">
  <defs>
    <radialGradient id="parchment" cx="45%" cy="40%" r="70%">
      <stop offset="0" stop-color="#f5ead0"/><stop offset=".75" stop-color="#e8d5a8"/><stop offset="1" stop-color="#d4bb86"/>
    </radialGradient>
    <clipPath id="disc"><circle cx="128" cy="128" r="111"/></clipPath>
  </defs>
  <circle cx="128" cy="128" r="126" fill="#9e2b25"/>
  <circle cx="128" cy="128" r="119" fill="url(#parchment)"/>
  <circle cx="128" cy="128" r="111" fill="none" stroke="#9e2b25" stroke-width="${+(1.6 * stroke).toFixed(2)}"/>
  <path d="${ticks}" stroke="#9e2b25" stroke-width="${+(1.2 * stroke).toFixed(2)}"/>
  <g clip-path="url(#disc)" fill="none" stroke="#9e7b4a" stroke-width="${+(0.9 * stroke).toFixed(2)}" opacity=".55">
    <circle cx="128" cy="128" r="84"/><circle cx="128" cy="128" r="56"/>
    <path d="M128 17V239M17 128H239"/>
  </g>
  <path d="${star(108, 30, 0)}" fill="#b08d3c"/>
  <path d="${star(108, 30, 0)}" fill="none" stroke="#6d4a1f" stroke-width="${+(1.2 * stroke).toFixed(2)}" stroke-linejoin="round"/>
  <path d="${star(84, 16, Math.PI / 4)}" fill="#6d4a1f" opacity=".9"/>
  <path d="${huD}" fill="#3a2615" opacity=".28" transform="translate(3 4)"/>
  <path d="${huD}" fill="#a3332a" stroke="#5e1610" stroke-width="${+(3 * stroke).toFixed(2)}" stroke-linejoin="round"/>
  ${withRivers ? `<path d="${riverD}" fill="none" stroke="#f3e4c0" stroke-width="${+(2.4 * stroke).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
  <path d="M128 4l7 12h-14z" fill="#f3e4c0"/>
</svg>
`;
}

await fs.writeFile(new URL('../assets/img/logo.svg', import.meta.url), svg());
await fs.writeFile(new URL('../assets/img/favicon.svg', import.meta.url), svg({ stroke: 1.8 }));
console.log('Wrote assets/img/logo.svg and assets/img/favicon.svg');
