// Builds data/map.topo.json from open datasets:
//  - Natural Earth 1:10m (public domain): admin-1 regions, rivers, lakes
//  - aourednik/historical-basemaps (GPL-3.0): neighbouring powers before 1920
// Historical Hungarian borders are assembled from modern admin-1 units plus
// hand-drawn dividing lines (see HAND below), so they are approximations.
//
// Usage: cd tools && npm install && npm run build
// Source files are downloaded into tools/.cache on the first run.

import mapshaper from 'mapshaper';
import fs from 'node:fs/promises';
import { EVENTS } from '../assets/js/events.js';

const CACHE = new URL('./.cache/', import.meta.url);
const OUT = new URL('../data/map.topo.json', import.meta.url);
const BBOX = [4, 35.5, 46, 57];

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const HBM = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/';
const SOURCES = [
  ...['ne_10m_admin_1_states_provinces', 'ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe', 'ne_10m_lakes', 'ne_10m_lakes_europe'].map((n) => NE + n + '.geojson'),
  ...[800, 900, 1000, 1200, 1279, 1500, 1600, 1700, 1815, 1880, 1914].map((y) => `${HBM}world_${y}.geojson`),
];

// Download the source files into tools/.cache if they are not there yet
await fs.mkdir(CACHE, { recursive: true });
for (const url of SOURCES) {
  const file = new URL(url.split('/').pop(), CACHE);
  try { await fs.access(file); continue; } catch { /* not cached yet */ }
  console.log('Downloading', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
}

const readJSON = async (name) => JSON.parse(await fs.readFile(new URL(name, CACHE), 'utf8'));
const fc = (features) => ({ type: 'FeatureCollection', features });
const feat = (geometry, properties = {}) => ({ type: 'Feature', properties, geometry });

function toFC(text) {
  const g = JSON.parse(text);
  if (g.type === 'FeatureCollection') return g;
  if (g.type === 'GeometryCollection') return fc(g.geometries.map((geom) => feat(geom)));
  return fc([g.type === 'Feature' ? g : feat(g)]);
}

async function run(cmd, files) {
  const out = await mapshaper.applyCommands(cmd + ' -o out.json', files);
  return out['out.json'] ? toFC(String(out['out.json'])) : fc([]);
}

const isEmpty = (a) => !a || !a.features.some((f) => f.geometry);

async function union(...parts) {
  parts = parts.filter((p) => !isEmpty(p));
  if (!parts.length) return fc([]);
  const files = Object.fromEntries(parts.map((p, i) => [`u${i}.json`, stripProps(p)]));
  return run(`-i ${Object.keys(files).join(' ')} combine-files -merge-layers force -dissolve2`, files);
}
const intersect = async (a, b) => (isEmpty(a) || isEmpty(b) ? fc([]) : run('-i a.json -clip b.json -dissolve2', { 'a.json': stripProps(a), 'b.json': stripProps(b) }));
const minus = async (a, b) => (isEmpty(a) ? fc([]) : isEmpty(b) ? a : run('-i a.json -erase b.json -dissolve2', { 'a.json': stripProps(a), 'b.json': stripProps(b) }));
const stripProps = (a) => fc(a.features.filter((f) => f.geometry).map((f) => feat(f.geometry)));
const poly = (ring) => fc([feat({ type: 'Polygon', coordinates: [[...ring, ring[0]]] })]);

// ---------------------------------------------------------------- hand-drawn lines
// Approximate dividing lines, drawn town by town from the standard historical maps.
const HAND = {
  // Ottoman-held area ("hódoltság"), state of the second half of the 16th century
  ottoman1541: [[15.2,44.55],[15.45,45.0],[15.85,45.2],[16.45,45.4],[16.85,45.68],[17.2,45.95],[17.1,46.2],[17.15,46.45],[17.45,46.7],[17.9,46.9],[18.1,47.08],[18.15,47.28],[18.3,47.5],[18.55,47.7],[18.65,47.8],[18.85,47.98],[19.1,48.15],[19.6,48.32],[19.95,48.35],[20.2,48.15],[20.25,47.85],[20.6,47.72],[21.0,47.68],[21.3,47.7],[21.4,47.4],[21.5,47.1],[21.45,46.8],[21.65,46.5],[21.75,46.2],[21.85,45.95],[21.75,45.75],[21.7,45.4],[22.1,45.15],[22.5,45.0],[22.7,44.6],[22.7,43.0],[14.5,43.0]],
  // Eastern Hungarian Kingdom / Principality of Transylvania with the Partium
  east1541: [[21.3,47.7],[21.6,47.85],[22.3,47.72],[22.9,47.62],[23.0,47.75],[23.05,48.1],[23.3,48.45],[24.0,49.0],[28.0,49.0],[28.0,43.5],[21.0,43.5],[21.0,46.0],[21.2,47.0]],
  // Temesköz (Banat), Ottoman until 1718
  banat1699: [[20.15,46.27],[20.5,46.17],[20.9,46.13],[21.3,46.16],[21.7,46.08],[22.05,45.95],[22.9,46.0],[23.0,44.5],[20.2,44.5],[20.3,45.15],[20.1,45.55],[20.1,46.0]],
  // First Vienna Award (2 Nov 1938): everything south of this line
  award1938: [[17.0,48.05],[17.15,48.12],[17.3,48.27],[17.5,48.3],[17.65,48.24],[17.8,48.24],[17.95,48.2],[18.1,48.24],[18.35,48.3],[18.55,48.28],[18.8,48.18],[19.0,48.16],[19.3,48.25],[19.55,48.33],[19.7,48.38],[19.9,48.43],[20.15,48.5],[20.4,48.56],[20.5,48.72],[20.75,48.74],[21.0,48.72],[21.2,48.79],[21.45,48.76],[21.65,48.76],[21.85,48.68],[22.05,48.66],[22.2,48.7],[22.4,48.64],[22.65,48.52],[22.8,48.42],[22.95,48.25],[23.1,48.05],[23.1,47.5],[17.0,47.5]],
  // Strip of eastern Slovakia taken in March 1939
  strip1939: [[22.1,48.68],[22.15,48.85],[22.2,49.02],[22.35,49.12],[22.6,49.1],[22.6,48.6]],
  // Second Vienna Award (30 Aug 1940): everything north of this line
  award1940: [[21.3,46.6],[21.75,46.72],[22.05,46.88],[22.6,46.8],[22.9,46.75],[23.3,46.7],[23.6,46.68],[23.85,46.62],[24.1,46.6],[24.35,46.48],[24.65,46.38],[24.95,46.3],[25.15,46.2],[25.35,46.08],[25.55,45.92],[25.75,45.8],[26.0,45.72],[26.4,45.55],[27.0,45.55],[27.0,48.6],[21.3,48.6]],
  // April 1941: Bácska (between the Danube and the Tisza) and the Baranya triangle
  backa1941: [[18.85,46.25],[20.15,46.25],[20.06,46.07],[20.09,45.93],[20.13,45.8],[20.03,45.62],[20.15,45.4],[20.3,45.2],[19.85,45.22],[19.39,45.22],[19.1,45.45],[18.95,45.65],[18.85,45.9]],
  baranja1941: [[18.3,46.0],[18.95,46.0],[18.95,45.55],[18.7,45.57],[18.55,45.65],[18.3,45.78]],
};

// ---------------------------------------------------------------- admin-1 unit sets
const HU_PROPER = {
  adm0: ['HUN', 'SVK'],
  adm1: ['UKR-293', 'ROU-301', 'ROU-298', 'ROU-277', 'ROU-300', 'ROU-296', 'ROU-295', 'ROU-299', 'ROU-307', 'ROU-306', 'ROU-305', 'ROU-303', 'ROU-294', 'ROU-297', 'ROU-276', 'ROU-280', 'ROU-278',
    'SRB-274', 'SRB-273', 'SRB-275', 'SRB-1059', 'SRB-1061', 'SRB-1060', 'AUT-2322', 'HRV-1609'],
  names: { SVN: ['Moravske Toplice', 'Šalovci', 'Hodoš', 'Gornji Petrovci', 'Kuzma', 'Lendava', 'Dobrovnik', 'Kobilje', 'Rogašovci', 'Cankova', 'Puconci', 'Grad', 'Murska Sobota', 'Turnišče', 'Črenšovci', 'Velika Polana', 'Beltinci', 'Odranci'] },
};
const PREKMURJE = { names: { SVN: HU_PROPER.names.SVN } };
const TRANSYLVANIA = { adm1: ['ROU-294', 'ROU-295', 'ROU-305', 'ROU-296', 'ROU-306', 'ROU-307', 'ROU-297', 'ROU-299', 'ROU-303', 'ROU-300'] };
const BANAT = { adm1: ['ROU-280', 'ROU-278', 'SRB-275', 'SRB-1061', 'SRB-1060'] };
const DALMATIA = { adm1: ['HRV-1493', 'HRV-1491', 'HRV-1492', 'HRV-1490'] };
const CRO_EXCLUDE = new Set(['HRV-1592', 'HRV-1609', ...DALMATIA.adm1]);
const TRANSCARPATHIA = { adm1: ['UKR-293'] };
const MEDJIMURJE = { adm1: ['HRV-1609'] };

// ---------------------------------------------------------------- neighbour names
// Translations for historical-basemaps NAME values, per event. null = drop.
const HB = {
  e850:  { file: 'world_900', extra: { file: 'world_800', names: ['Byzantine Empire'] }, names: { 'East Francia': 'Keleti Frank Királyság', 'Great Moravia': 'Morva Fejedelemség', 'Bulgars': 'Bolgár Kánság', 'Croatian kingdom': 'Horvát Fejedelemség', 'Serbia': 'Szerb Fejedelemség', 'Khazars': 'Kazár Kaganátus', 'Byzantine Empire': 'Bizánci Birodalom', 'Carolingian Empire': 'Frank birodalmak', 'Slavic tribes': 'Szláv törzsek', 'Kyivan Rus': 'Keleti szláv törzsek', 'Polyanians': 'Keleti szláv törzsek', 'Avars': 'Avar–szláv maradványnépek', 'Chelmia': null, 'Magyars': null } },
  e895:  { file: 'world_900', extra: { file: 'world_800', names: ['Byzantine Empire'] }, names: { 'East Francia': 'Keleti Frank Királyság', 'Great Moravia': 'Nagymorva Fejedelemség', 'Bulgars': 'Bolgár Kánság', 'Croatian kingdom': 'Horvát Fejedelemség', 'Serbia': 'Szerb Fejedelemség', 'Khazars': 'Kazár Kaganátus', 'Byzantine Empire': 'Bizánci Birodalom', 'Carolingian Empire': 'Frank birodalmak', 'Slavic tribes': 'Szláv törzsek', 'Kyivan Rus': 'Kijevi Rusz', 'Polyanians': 'Kijevi Rusz', 'Magyars': 'Besenyők', 'Avars': null, 'Chelmia': null } },
  e1000: { file: 'world_1000', names: { 'Holy Roman Empire': 'Német-római Birodalom', 'Poland': 'Lengyel Fejedelemség', 'Kyivan Rus': 'Kijevi Rusz', 'Byzantine Empire': 'Bizánci Birodalom', 'Bulgar Khanate': 'Bolgár Cárság', 'Croatia': 'Horvát Királyság', 'Venice': 'Velence', 'Serbia': 'Szerb fejedelemségek', 'Peshemegs': 'Besenyők', 'Alans': null, 'Magyars': null } },
  e1241: { file: 'world_1279', extra: { file: 'world_1200', names: ['Principality of Galicia-Volhynia', 'Cuman Khanates'] }, names: { 'Holy Roman Empire': 'Német-római Birodalom', 'Poland': 'Lengyel fejedelemségek', 'Khanate of the Golden Horde': 'Mongol Birodalom', 'Ryazan': 'Orosz fejedelemségek', 'Bulgar Khanate': 'Bolgár Cárság', 'Serbia': 'Szerb Királyság', 'Venice': 'Velence', 'Byzantine Empire': 'Bizánci államok', 'Papal States': 'Pápai Állam', 'Principality of Galicia-Volhynia': 'Halicsi Fejedelemség', 'Cuman Khanates': 'Kunok', 'Hungary': null } },
  e1526: { file: 'world_1500', names: { 'Ottoman Empire': 'Oszmán Birodalom', 'Poland-Lithuania': 'Lengyel–Litván Unió', 'Holy Roman Empire': 'Német-római Birodalom', 'Venice': 'Velence', 'Papal States': 'Pápai Állam', 'Imperial Hungary': null } },
  e1541: { file: 'world_1600', names: { 'Ottoman Empire': 'Oszmán Birodalom', 'Holy Roman Empire': 'Német-római Birodalom', 'Poland-Lithuania': 'Lengyel–Litván Unió', 'Tsardom of Muscovy': 'Moszkvai Nagyfejedelemség', 'Venice': 'Velence', 'Papal States': 'Pápai Állam' } },
  e1699: { file: 'world_1700', names: { 'Austrian Empire': null, 'Holy Roman Empire': 'Német-római Birodalom', 'Ottoman Empire': 'Oszmán Birodalom', 'Polish–Lithuanian Commonwealth': 'Lengyel–Litván Unió', 'Tsardom of Muscovy': 'Orosz Cárság', 'Venice': 'Velence', 'Papal States': 'Pápai Állam' } },
  e1848: { file: 'world_1815', names: { 'Austrian Empire': 'Osztrák Császárság', 'Ottoman Empire': 'Oszmán Birodalom', 'Russian Empire': 'Orosz Birodalom', 'Prussia': 'Porosz Királyság', 'Saxony': 'Szász Királyság', 'Republic of Kraków': 'Krakkói Köztársaság' } },
  e1867: { file: 'world_1880', names: { 'Austria Hungary': 'Ausztria (Lajtántúl)', 'Romania': 'Román Fejedelemség', 'Serbia': 'Szerb Fejedelemség', 'Bosnia-Herzegovina': 'Oszmán Birodalom', 'Bulgaria': 'Oszmán Birodalom', 'Ottoman Empire': 'Oszmán Birodalom', 'Montenegro': 'Montenegró', 'Germany': 'Északnémet Szövetség', 'Russian Empire': 'Orosz Birodalom', 'Italy': 'Olasz Királyság' } },
  e1914: { file: 'world_1914', names: { 'Austro-Hungarian Empire': 'Ausztria (Lajtántúl)', 'Serbia': 'Szerb Királyság', 'Romania': 'Román Királyság', 'Russian Empire': 'Orosz Birodalom', 'German Empire': 'Német Császárság', 'Kingdom of Italy': 'Olasz Királyság', 'Montenegro': 'Montenegró', 'Bulgaria': 'Bolgár Királyság', 'Ottoman Empire': 'Oszmán Birodalom' } },
};

// Modern-era neighbours composed from Natural Earth countries (exact shared borders).
const YUGO = ['SRB', 'HRV', 'SVN', 'BIH', 'MNE', 'MKD', 'KOS'];
const SOVIET = ['UKR', 'BLR', 'RUS', 'MDA', 'LTU', 'LVA', 'EST'];
const EAST_DE = ['DEU-3487', 'DEU-3488', 'DEU-1601', 'DEU-1600', 'DEU-1577', 'DEU-1599'];
const POL_1920 = ['UKR-291', 'UKR-289', 'UKR-292', 'UKR-318', 'UKR-286'];
const COMMON = [['Olaszország', ['ITA']], ['Bulgária', ['BGR']], ['Albánia', ['ALB']], ['Görögország', ['GRC']], ['Törökország', ['TUR']]];
const MODERN = {
  e1920: [['Ausztria', ['AUT']], ['Csehszlovákia', ['CZE', 'SVK'], ['UKR-293']], ['Románia', ['ROU', 'MDA'], ['UKR-288']], ['Szerb–Horvát–Szlovén Királyság', YUGO], ['Lengyelország', ['POL'], POL_1920], ['Németország', ['DEU']], ['Szovjet-Oroszország', SOVIET, null, { minus: [...POL_1920, 'UKR-293', 'UKR-288'], minus0: ['MDA'] }], ...COMMON],
  e1938: [['Német Birodalom', ['DEU', 'AUT', 'CZE', 'POL']], ['Szlovák Állam', ['SVK']], ['Románia', ['ROU']], ['Független Horvát Állam', ['HRV', 'BIH']], ['Szerbia (német megszállás)', ['SRB', 'KOS']], ['Szlovénia (felosztva)', ['SVN']], ['Szovjetunió', SOVIET, null, { minus: ['UKR-293'] }], ['Olaszország', ['ITA', 'ALB']], ['Bulgária', ['BGR', 'MKD']], ['Görögország', ['GRC']], ['Montenegró (olasz megszállás)', ['MNE']], ['Törökország', ['TUR']]],
  e1947: [['Ausztria (szövetséges megszállás)', ['AUT']], ['Csehszlovákia', ['CZE', 'SVK']], ['Szovjetunió', SOVIET], ['Románia', ['ROU']], ['Jugoszlávia', YUGO], ['Lengyelország', ['POL']], ['Németország (megszállt)', ['DEU']], ...COMMON],
  e1956: [['Ausztria', ['AUT']], ['Csehszlovákia', ['CZE', 'SVK']], ['Szovjetunió', SOVIET], ['Románia', ['ROU']], ['Jugoszlávia', YUGO], ['Lengyelország', ['POL']], ['NDK', null, EAST_DE], ['NSZK', ['DEU'], null, { minus: EAST_DE }], ...COMMON],
  e2004: [['Ausztria', ['AUT']], ['Szlovákia', ['SVK']], ['Csehország', ['CZE']], ['Ukrajna', ['UKR']], ['Románia', ['ROU']], ['Szerbia és Montenegró', ['SRB', 'MNE', 'KOS']], ['Horvátország', ['HRV']], ['Szlovénia', ['SVN']], ['Lengyelország', ['POL']], ['Németország', ['DEU']], ['Bosznia-Hercegovina', ['BIH']], ['Moldova', ['MDA']], ['Fehéroroszország', ['BLR']], ['Oroszország', ['RUS']], ['Észak-Macedónia', ['MKD']], ...COMMON],
};
MODERN.e1989 = MODERN.e1956;
const EU2004 = new Set(['Ausztria', 'Szlovákia', 'Csehország', 'Szlovénia', 'Lengyelország', 'Németország', 'Olaszország', 'Görögország']);
const EASTERN_BLOC = new Set(['Csehszlovákia', 'Szovjetunió', 'Románia', 'Lengyelország', 'NDK', 'Bulgária']);

// ---------------------------------------------------------------- build
console.log('Reading Natural Earth admin-1…');
let a1 = await readJSON('ne_10m_admin_1_states_provinces.geojson');
a1 = await run(`-i a1.json -clip bbox=${BBOX.join(',')} -filter-fields adm0_a3,adm1_code,name -simplify interval=250 keep-shapes`, { 'a1.json': a1 });
console.log('  admin-1 features in bbox:', a1.features.length);

function pick(set) {
  const adm0 = new Set(set.adm0 || []);
  const adm1 = new Set(set.adm1 || []);
  const names = set.names || {};
  const filter = set.filter || (() => true);
  return fc(a1.features.filter((f) => {
    const p = f.properties;
    if (!filter(p)) return false;
    return adm0.has(p.adm0_a3) || adm1.has(p.adm1_code) || (names[p.adm0_a3] || []).includes(p.name);
  }));
}
const region = async (set) => union(pick(set));

console.log('Composing historical regions…');
const land = await union(a1);
const country = {};
for (const code of new Set(a1.features.map((f) => f.properties.adm0_a3))) country[code] = await union(pick({ adm0: [code] }));
const huProper = await region(HU_PROPER);
const transylvania = await region(TRANSYLVANIA);
const banatRegion = await intersect(await region(BANAT), huProper);
const croatiaSlavonia = await union(pick({ filter: (p) => p.adm0_a3 === 'HRV' && !CRO_EXCLUDE.has(p.adm1_code), adm0: ['HRV'] }), pick({ adm1: ['SRB-281'] }));
const dalmatia = await region(DALMATIA);
const crownLands = await union(huProper, croatiaSlavonia);
const hun = country.HUN;
const svk = country.SVK;
const transcarpathia = await region(TRANSCARPATHIA);

const ottoman1541 = await intersect(crownLands, poly(HAND.ottoman1541));
const east1541 = await minus(await intersect(huProper, poly(HAND.east1541)), ottoman1541);
const royal1541 = await minus(await minus(crownLands, ottoman1541), east1541);

const banat1699 = await minus(await intersect(huProper, poly(HAND.banat1699)), transylvania);
const hungary1699 = await minus(await minus(huProper, transylvania), banat1699);

const g1938 = await intersect(poly(HAND.award1938), await union(svk, transcarpathia));
const g1939 = await union(await minus(transcarpathia, g1938), await minus(await intersect(poly(HAND.strip1939), svk), g1938));
const g1940 = await minus(await intersect(poly(HAND.award1940), huProper), hun);
const g1941 = await union(
  await intersect(poly(HAND.backa1941), country.SRB),
  await intersect(poly(HAND.baranja1941), country.HRV),
  await region(MEDJIMURJE),
  await region(PREKMURJE),
);

const lostTo = [
  ['Csehszlovákiához', 'Csehszlovákia', await union(country.CZE, svk, transcarpathia)],
  ['Romániához', 'Románia', country.ROU],
  ['A Szerb–Horvát–Szlovén Királysághoz', 'Szerb–Horvát–Szlovén Királyság', await union(country.SRB, country.SVN, country.HRV)],
  ['Ausztriához', 'Ausztria', country.AUT],
];

// Feature helpers -----------------------------------------------------------
const out = [];
const labelGeo = new Map(); // feature -> geometry used for its label anchor
function add(ev, role, name, geo, extra = {}, labelOn = null) {
  for (const f of geo.features) {
    if (!f.geometry) continue;
    const o = feat(f.geometry, { ev, role, name, ...extra });
    out.push(o);
    if (labelOn) labelGeo.set(o, labelOn);
  }
}

async function historicalNeighbours(ev, hu) {
  const cfg = HB[ev];
  const base = await readJSON(cfg.file + '.geojson');
  let feats = base.features.filter((f) => f.geometry);
  if (cfg.extra) {
    const ex = await readJSON(cfg.extra.file + '.geojson');
    feats = feats.concat(ex.features.filter((f) => f.geometry && cfg.extra.names.includes(f.properties.NAME)));
  }
  const groups = new Map();
  for (const f of feats) {
    const name = cfg.names[f.properties.NAME];
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(feat(f.geometry));
  }
  for (const [name, parts] of groups) {
    let g = await run(`-i n.json -clip bbox=${BBOX.join(',')} -dissolve2`, { 'n.json': fc(parts) });
    g = await intersect(g, land);
    g = await minus(g, hu);
    add(ev, 'nb', name, g);
  }
}

// `labelMinus`: area to keep labels out of (e.g. territories that change hands)
async function modernNeighbours(ev, hu, flags = () => ({}), labelMinus = null) {
  for (const [name, adm0, adm1, opts] of MODERN[ev]) {
    let g = await union(...(adm0 || []).map((c) => country[c]).filter(Boolean), adm1 ? pick({ adm1 }) : fc([]));
    if (opts?.minus) g = await minus(g, pick({ adm1: opts.minus }));
    if (opts?.minus0) g = await minus(g, await union(...opts.minus0.map((c) => country[c])));
    g = await minus(g, hu);
    add(ev, 'nb', name, g, flags(name), labelMinus ? await minus(g, labelMinus) : null);
  }
}

console.log('Building events…');
// ~850 Etelköz
{
  const w800 = await readJSON('world_800.geojson');
  const etelkoz = await intersect(fc(w800.features.filter((f) => f.properties.NAME === 'Magyars')), land);
  add('e850', 'hu', 'Etelköz', etelkoz);
  await historicalNeighbours('e850', etelkoz);
}
// 895 Honfoglalás
add('e895', 'hu', 'A magyar törzsek szállásterülete', huProper);
await historicalNeighbours('e895', huProper);
// 1000 Államalapítás
{
  const core = await minus(await minus(huProper, transylvania), banatRegion);
  add('e1000', 'hu', 'Magyar Királyság', core);
  add('e1000', 'hu3', 'Gyula országa (1003-ig)', transylvania);
  add('e1000', 'hu3', 'Ajtony országa (11. sz. eleje)', banatRegion);
  await historicalNeighbours('e1000', huProper);
}
// 1241 Tatárjárás
{
  const kingdom = await union(crownLands, dalmatia);
  add('e1241', 'hu', 'Magyar Királyság', huProper);
  add('e1241', 'hu2', 'Horvát–Dalmát Királyság', await union(croatiaSlavonia, dalmatia));
  await historicalNeighbours('e1241', kingdom);
}
// 1526 Mohács
add('e1526', 'hu', 'Magyar Királyság', huProper);
add('e1526', 'hu2', 'Horvát–Szlavón Királyság', croatiaSlavonia);
await historicalNeighbours('e1526', crownLands);
// 1541 Három részre szakadás
add('e1541', 'hu', 'Királyi Magyarország', royal1541);
add('e1541', 'ott', 'Hódoltság', ottoman1541);
add('e1541', 'hu3', 'Erdélyi Fejedelemség', east1541);
await historicalNeighbours('e1541', crownLands);
// 1699 Karlóca
add('e1699', 'hu', 'Magyar Királyság', hungary1699);
add('e1699', 'hu3', 'Erdélyi Fejedelemség', transylvania);
add('e1699', 'hu2', 'Horvát–Szlavón Királyság', croatiaSlavonia);
add('e1699', 'ott', 'Temesköz (oszmán, 1718-ig)', banat1699);
await historicalNeighbours('e1699', crownLands);
// 1848
add('e1848', 'hu', 'Magyar Királyság', await minus(huProper, transylvania));
add('e1848', 'hu3', 'Erdély', transylvania);
add('e1848', 'hu2', 'Horvát–Szlavón Királyság', croatiaSlavonia);
await historicalNeighbours('e1848', crownLands);
// 1867, 1914
for (const ev of ['e1867', 'e1914']) {
  add(ev, 'hu', 'Magyar Királyság', huProper);
  add(ev, 'hu2', 'Horvát–Szlavón Királyság', croatiaSlavonia);
  await historicalNeighbours(ev, crownLands);
}
// 1920 Trianon
add('e1920', 'hu', 'Magyar Királyság', hun);
add('e1920', 'ghost', '1914-es határ', crownLands);
for (const [name, to, succ] of lostTo) {
  add('e1920', 'lost', name, await minus(await intersect(huProper, succ), hun), { to });
}
add('e1920', 'lost2', 'Horvát–Szlavónország', croatiaSlavonia, { to: 'Szerb–Horvát–Szlovén Királyság' });
await modernNeighbours('e1920', hun, () => ({}), crownLands);
// 1938–41
{
  add('e1938', 'hu', 'Magyar Királyság', hun);
  add('e1938', 'ghost', '1914-es határ', crownLands);
  add('e1938', 'gain', 'Felvidék déli része', g1938, { phase: 1 });
  add('e1938', 'gain', 'Kárpátalja', g1939, { phase: 2 });
  add('e1938', 'gain', 'Észak-Erdély', g1940, { phase: 3 });
  add('e1938', 'gain', 'Délvidék', g1941, { phase: 4 });
  const max = await union(hun, g1938, g1939, g1940, g1941);
  await modernNeighbours('e1938', hun, () => ({}), max);
}
// 1947, 1956, 1989, 2004
add('e1947', 'hu', 'Magyar Köztársaság', hun);
await modernNeighbours('e1947', hun);
add('e1956', 'hu', 'Magyar Népköztársaság', hun);
await modernNeighbours('e1956', hun, (n) => ({ bloc: EASTERN_BLOC.has(n) ? 1 : 0 }));
add('e1989', 'hu', 'Magyar Köztársaság', hun);
await modernNeighbours('e1989', hun, (n) => ({ bloc: EASTERN_BLOC.has(n) ? 1 : 0 }));
add('e2004', 'hu', 'Magyar Köztársaság', hun);
await modernNeighbours('e2004', hun, (n) => ({ eu: EU2004.has(n) ? 1 : 0 }));

// Label anchor points: pole of inaccessibility of the part inside the event's view
console.log('Computing label anchors…');
const views = Object.fromEntries(EVENTS.map((e) => [e.id, e.view]));
for (const f of out) {
  const v = views[f.properties.ev];
  if (!v || f.properties.role === 'ghost') continue;
  const padX = (v[2] - v[0]) * 0.07, padY = (v[3] - v[1]) * 0.07;
  const box = [v[0] + padX, v[1] + padY * 1.6, v[2] - padX * 3.2, v[3] - padY];
  const geom = labelGeo.get(f) ?? fc([f]);
  if (isEmpty(geom)) continue;
  const r = await run(`-i f.json -clip bbox=${box.join(',')} -explode -each "a=this.area" -sort a descending -each "lx=+this.innerX.toFixed(3), ly=+this.innerY.toFixed(3)"`, { 'f.json': fc(geom.features.map((g) => feat(g.geometry, { a: 0 }))) }).catch(() => fc([]));
  const p = r.features[0]?.properties;
  if (p?.lx != null) { f.properties.lx = p.lx; f.properties.ly = p.ly; }
}

// Iron curtain: border between the eastern bloc and the west in 1956/1989
const BLOC0 = new Set(['HUN', 'CZE', 'SVK', 'POL', 'ROU', 'BGR', ...SOVIET]);
const WEST0 = new Set(['AUT', 'ITA', 'DEU']);
const sides = fc(a1.features.flatMap((f) => {
  const { adm0_a3: c, adm1_code: code } = f.properties;
  const s = BLOC0.has(c) || EAST_DE.includes(code) ? 'b' : WEST0.has(c) ? 'w' : null;
  return s ? [feat(f.geometry, { s, c })] : [];
}));
// The Hungarian–Austrian section is kept apart: it is the part opened in 1989.
const HU_AT = "(A.c=='HUN'&&B.c=='AUT')||(A.c=='AUT'&&B.c=='HUN')";
const curtainOf = (where, part) => run(`-i s.json -dissolve c copy-fields=s -innerlines where="${where}"`, { 's.json': sides })
  .then((r) => fc(r.features.map((f) => feat(f.geometry, { part }))));
const curtain = fc([
  ...(await curtainOf(`A.s!=B.s && !(${HU_AT})`, 'rest')).features,
  ...(await curtainOf(HU_AT, 'hu')).features,
]);

// Rivers and lakes ------------------------------------------------------------
const RIVERS = {
  Danube: ['Duna', 1], Donau: ['Duna', 1], 'Bratul Chillia': ['Duna', 1], 'Bratul Sulina': ['Duna', 1], 'Bratul Sfintu Gheorghe': ['Duna', 1],
  Tisa: ['Tisza', 1], Sava: ['Száva', 1], Drau: ['Dráva', 1], Mures: ['Maros', 1], Dnipro: ['Dnyeper', 1], Dniester: ['Dnyeszter', 1],
  Prut: ['Prut', 2], Olt: ['Olt', 2], 'Southern Bug': ['Déli-Bug', 2], Vistula: ['Visztula', 2], Mur: ['Mura', 2], Morava: ['Morva', 2],
  Sio: ['Sió', 3], 'Váh': ['Vág', 2], Hron: ['Garam', 3], Ipel: ['Ipoly', 3], 'Hornád': ['Hernád', 3], Zagyva: ['Zagyva', 3], Raab: ['Rába', 3],
  'Sebes Koros': ['Sebes-Körös', 3], 'Crisul Alb': ['Fehér-Körös', 3], 'Someșul Mare': ['Szamos', 3], 'Someşul Cald': ['Szamos', 3], 'Timiş': ['Temes', 3],
  Kupa: ['Kulpa', 3], Una: ['Una', 3], Vrbas: ['Vrbas', 3], Bosna: ['Boszna', 3], Drina: ['Drina', 2], Siret: ['Szeret', 2], Latorytsya: ['Latorca', 3],
  Uzh: ['Ung', 3], Zala: ['Zala', 3], Slana: ['Sajó', 3], Dunajec: ['Dunajec', 3], San: ['San', 3], Jiu: ['Zsil', 3], 'Argeș': ['Argeș', 3],
  'Buzău': ['Bodza', 3], 'Trotuș': ['Tatros', 3], Moldova: ['Moldva', 3], 'Bistrița': ['Beszterce', 3], Inn: ['Inn', 2], Pripyat: ['Pripjaty', 2],
  'Soroksari Duna': ['Ráckevei-Duna', 3], 'Mosoni-Duna': ['Mosoni-Duna', 3], Bug: ['Bug', 2], 'Zakhidnyy Buh': ['Bug', 2], Desna: ['Gyeszna', 3],
};
// In Natural Earth only the lowest stretch of the Tisza is named; the unnamed segments
// running past these towns are the rest of it.
const TISZA_TOWNS = [[24.21, 48.05], [22.31, 48.13], [21.41, 48.12], [20.77, 47.62], [20.19, 47.18], [20.14, 46.71]];
const nearTisza = (g) => (g.type === 'LineString' ? [g.coordinates] : g.coordinates)
  .some((line) => line.some(([x, y]) => TISZA_TOWNS.some(([tx, ty]) => Math.abs(x - tx) < 0.06 && Math.abs(y - ty) < 0.06)));
const riverFeats = [];
for (const file of ['ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers_europe.geojson']) {
  const d = await readJSON(file);
  for (const f of d.features) {
    const unnamedTisza = !f.properties.name && f.properties.scalerank <= 6 && f.geometry && nearTisza(f.geometry);
    const r = unnamedTisza ? ['Tisza', 1] : RIVERS[f.properties.name];
    if (r && f.geometry) riverFeats.push(feat(f.geometry, { n: r[0], w: r[1] }));
  }
}
const rivers = await run(`-i r.json -clip bbox=${BBOX.join(',')} -dissolve n,w`, { 'r.json': fc(riverFeats) });
const LAKES = { 'Lake Balaton': 'Balaton', Neusiedlersee: 'Fertő', 'Lake Skadar': 'Shkodrai-tó' };
const lakeFeats = [];
for (const file of ['ne_10m_lakes.geojson', 'ne_10m_lakes_europe.geojson']) {
  const d = await readJSON(file);
  for (const f of d.features) if (LAKES[f.properties.name] && f.geometry) lakeFeats.push(feat(f.geometry, { n: LAKES[f.properties.name] }));
}

// Write one TopoJSON ------------------------------------------------------------
console.log('Writing TopoJSON…');
const files = {
  'land.json': fc(land.features.map((f) => feat(f.geometry, {}))),
  'modern.json': fc(hun.features.map((f) => feat(f.geometry, {}))),
  'ev.json': fc(out),
  'rivers.json': rivers,
  'lakes.json': fc(lakeFeats),
  'curtain.json': curtain,
};
const res = await mapshaper.applyCommands(
  `-i ${Object.keys(files).join(' ')} combine-files snap -simplify interval=900 keep-shapes -o out.json format=topojson quantization=60000 bbox`,
  files,
);
await fs.writeFile(OUT, res['out.json']);
const size = (await fs.stat(OUT)).size;
console.log(`Done: data/map.topo.json (${(size / 1024).toFixed(0)} KB, ${out.length} event features)`);
