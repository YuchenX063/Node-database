// In-memory aggregation for the cross-filtering Overview dashboard. The full
// fact array is built once and cached by the controller; this module re-counts
// the panels for an arbitrary filter state without touching the database, so
// each request returns only the small panel payload — not the whole corpus the
// browser used to download.

const ID_SPLIT = /[&=]/;
const TOP_N = 12;

// Split a (possibly branching) institution id into its child identities, so a
// record like `A&B` counts as two distinct institutions.
function childIds(id) {
  return String(id).split(ID_SPLIT).map(s => s.trim()).filter(Boolean);
}

// The identities a fact contributes: distinct child institutions, or people.
function memberIds(f, entity) {
  return entity === 'people' ? (f.pp || []) : (f._c || childIds(f.i));
}

// Survives the filter, optionally ignoring ONE dimension (so a panel can be
// aggregated over everything-except-its-own selection — the dc.js rule).
function passes(f, s, except) {
  if (except !== 'years' && s.years.size && !s.years.has(f.y)) return false;
  if (except !== 'functions' && s.functions.size && !s.functions.has(f.f)) return false;
  if (except !== 'types' && s.types.size && !(f.t != null && s.types.has(f.t))) return false;
  if (except !== 'dioceses' && s.dioceses.size && !s.dioceses.has(f._dio)) return false;
  return true;
}

function applyFilters(facts, s, except) {
  return facts.filter(f => passes(f, s, except));
}

// Bucketed DISTINCT counts keyed by a field extractor (null/empty keys skipped).
function bucketCounts(facts, keyOf, entity) {
  const sets = new Map();
  for (const f of facts) {
    const k = keyOf(f);
    if (k == null || k === '') continue;
    let st = sets.get(k);
    if (!st) { st = new Set(); sets.set(k, st); }
    for (const id of memberIds(f, entity)) st.add(id);
  }
  const m = new Map();
  for (const [k, st] of sets) m.set(k, st.size);
  return m;
}

function distinctCount(facts, entity) {
  const s = new Set();
  for (const f of facts) for (const id of memberIds(f, entity)) s.add(id);
  return s.size;
}

function topN(counts, selected, n) {
  const keys = Array.from(counts.keys())
    .sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b))
    .slice(0, n);
  for (const k of selected) if (!keys.includes(k)) keys.push(k);
  return keys.map(k => ({ key: k, value: counts.get(k) || 0 }));
}

function dominant(m) {
  let best = '', val = -1;
  for (const [k, v] of m) if (v > val) { val = v; best = k; }
  return best;
}

// Grid-aggregate the filtered facts to ~0.1deg cells, each weighted by distinct
// institutions or people and tagged with its dominant function + diocese.
function gridMap(facts, entity) {
  const cells = new Map();
  for (const f of facts) {
    if (f.lat == null || f.lng == null) continue;
    if (Math.abs(f.lat) > 90 || Math.abs(f.lng) > 180) continue;
    const rlat = Math.round(f.lat * 10) / 10;
    const rlng = Math.round(f.lng * 10) / 10;
    const key = rlat + '|' + rlng;
    let c = cells.get(key);
    if (!c) { c = { lat: rlat, lng: rlng, insts: new Set(), people: new Set(), fn: new Map(), dio: new Map() }; cells.set(key, c); }
    for (const id of (f._c || childIds(f.i))) c.insts.add(id);
    for (const p of (f.pp || [])) c.people.add(p);
    c.fn.set(f.f, (c.fn.get(f.f) || 0) + 1);
    c.dio.set(f._dio, (c.dio.get(f._dio) || 0) + 1);
  }
  const out = [];
  for (const c of cells.values()) {
    const v = entity === 'people' ? c.people.size : c.insts.size;
    if (!v) continue;
    out.push({ lat: c.lat, lng: c.lng, v, f: dominant(c.fn) || 'other', d: dominant(c.dio) });
  }
  return out;
}

// Build the full panel payload for one filter state. `state` holds Sets; counts
// are distinct institutions (or people), deduped across years.
function buildOverview(facts, state, entity, allYears, functionOrder) {
  const fully = applyFilters(facts, state);

  const fnExcept = bucketCounts(applyFilters(facts, state, 'functions'), f => f.f, entity);
  const functions = functionOrder
    .filter(k => fnExcept.has(k) || state.functions.has(k))
    .map(k => ({ key: k, value: fnExcept.get(k) || 0 }));

  const types = topN(bucketCounts(applyFilters(facts, state, 'types'), f => f.t, entity), state.types, TOP_N);
  const dioceses = topN(bucketCounts(applyFilters(facts, state, 'dioceses'), f => f._dio, entity), state.dioceses, TOP_N);

  const yearExcept = bucketCounts(applyFilters(facts, state, 'years'), f => String(f.y), entity);
  const years = allYears.map(y => ({ year: y, value: yearExcept.get(String(y)) || 0 }));

  const dios = new Set(), states = new Set();
  let minY = Infinity, maxY = -Infinity;
  for (const f of fully) {
    dios.add(f._dio);
    if (f.s) states.add(f.s);
    if (f.y < minY) minY = f.y;
    if (f.y > maxY) maxY = f.y;
  }
  const fnFully = bucketCounts(fully, f => f.f, entity);
  let topFunction = null, topVal = -1;
  for (const [k, v] of fnFully) if (v > topVal) { topVal = v; topFunction = k; }

  const kpis = {
    institutions: distinctCount(fully, 'institutions'),
    people: distinctCount(fully, 'people'),
    dioceses: dios.size,
    states: states.size,
    yearMin: fully.length ? minY : null,
    yearMax: fully.length ? maxY : null,
    topFunction: fully.length ? topFunction : null
  };

  return { kpis, functions, types, dioceses, years, map: gridMap(fully, entity), count: fully.length };
}

module.exports = { childIds, buildOverview };
