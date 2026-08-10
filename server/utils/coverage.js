// Aggregation for the Coverage page — "the shape of the data itself": which
// dioceses are recorded, in which years, and where geographically. Runs over
// the same in-memory fact array the overview uses (so counts stay consistent),
// producing a tiny payload.
//
// Dioceses are keyed by their CANONICAL id (the institution-id prefix, e.g.
// `nyc.ny`), which merges name variants ("New York" / "New York City") onto one
// row. The diocese timeline (server/utils/dioceses.js) then supplies the display
// name and, per year, whether the see EXISTED — so the grid can distinguish
// "existed but no data yet" from "did not exist that year".

const { childIds } = require('./overview');
const dioceses = require('./dioceses');

const round2 = n => Math.round(n * 100) / 100;

// facts: the internal fact array ({ i, d, y, lat, lng, _c, ... }).
// Returns:
//   dioceses : [{ key, name, rootNo, total, firstYear, lastYear, yearsCovered,
//                 lat, lng, years:{year:n}, existYears:[…], namesByYear:{…} }]
//   years    : every almanac year (matrix columns)
//   maxCell  : largest diocese-year count (grid colour scale)
//   points   : [[lat, lng, year, n, dioceseIndex]] for the binned map
function buildCoverage(facts, allYears) {
  const tl = dioceses.load();
  const byDio = new Map();      // canonicalId -> aggregate
  const cellYear = new Map();   // "lat|lng|year|canonId" -> Set(childId)
  const unmatched = new Set();  // instID prefixes with data but not in the CSV

  const ensure = (id) => {
    let e = byDio.get(id);
    if (!e) { e = { years: new Map(), total: new Set(), latSum: 0, lngSum: 0, geo: 0 }; byDio.set(id, e); }
    return e;
  };

  for (const f of facts) {
    const ids = f._c || childIds(f.i);
    const id = f._dio || dioceses.resolveDioceseId(f.i, f.d) || 'unknown';
    if (id !== 'unknown' && !tl.byId.has(id)) unmatched.add(id);

    const e = ensure(id);
    let ys = e.years.get(f.y);
    if (!ys) { ys = new Set(); e.years.set(f.y, ys); }
    for (const c of ids) { ys.add(c); e.total.add(c); }

    // Distinct institutions per (location, year, diocese) for the map.
    // Exclude exact-zero coords — a "null island" geocoding failure.
    if (f.lat != null && f.lng != null && f.lat !== 0 && f.lng !== 0 && Math.abs(f.lat) <= 90 && Math.abs(f.lng) <= 180) {
      e.latSum += f.lat; e.lngSum += f.lng; e.geo += 1;
      const ck = round2(f.lat) + '|' + round2(f.lng) + '|' + f.y + '|' + id;
      let cs = cellYear.get(ck);
      if (!cs) { cs = new Set(); cellYear.set(ck, cs); }
      for (const c of ids) cs.add(c);
    }
  }

  // Seed rows for every see that EXISTED in at least one shown year but has no
  // data — so the grid shows the full picture (hatched where absent, light where
  // it existed but nothing is encoded yet).
  let seededEmpty = 0;
  for (const [id, m] of tl.byId) {
    if (byDio.has(id)) continue;
    if (allYears.some(y => m.existsYears.has(y))) { ensure(id); seededEmpty++; }
  }

  let maxCell = 1;
  const out = [];
  for (const [id, e] of byDio) {
    const m = tl.byId.get(id) || null;
    const years = {};
    const existYears = [];
    let first = Infinity, last = -Infinity, covered = 0;
    for (const y of allYears) {
      const set = e.years.get(y);
      const n = set ? set.size : 0;
      years[y] = n;
      if (n > maxCell) maxCell = n;
      // Unknown/unmatched dioceses have no timeline — treat every year as existing.
      if (!m || m.existsYears.has(y)) existYears.push(y);
      if (n > 0) { covered++; if (y < first) first = y; if (y > last) last = y; }
    }
    // Only trim in-range names + error reasons, for tooltips.
    const namesByYear = {};
    const errorYears = {};
    if (m) for (const y of allYears) {
      if (m.namesByYear[y]) namesByYear[y] = m.namesByYear[y];
      if (m.errorsByYear[y]) errorYears[y] = m.errorsByYear[y];
    }

    out.push({
      key: id,
      name: m ? m.displayName : (id === 'unknown' ? 'Unknown' : id),
      rootNo: m ? m.rootNo : 9999,
      total: e.total.size,
      firstYear: first === Infinity ? null : first,
      lastYear: last === -Infinity ? null : last,
      yearsCovered: covered,
      lat: e.geo ? Math.round((e.latSum / e.geo) * 1000) / 1000 : null,
      lng: e.geo ? Math.round((e.lngSum / e.geo) * 1000) / 1000 : null,
      years,
      existYears,
      namesByYear,
      errorYears
    });
  }

  // Data-rich dioceses first; the seeded (0-data) sees sink to the bottom.
  out.sort((a, b) => (b.total - a.total) || (a.rootNo - b.rootNo) || a.key.localeCompare(b.key));
  const dioIndex = new Map();
  out.forEach((d, i) => dioIndex.set(d.key, i));

  const points = [];
  for (const [ck, set] of cellYear) {
    const parts = ck.split('|');
    const id = parts[3];   // canonical id contains no '|'
    points.push([Number(parts[0]), Number(parts[1]), Number(parts[2]), set.size, dioIndex.get(id) ?? -1]);
  }

  return {
    dioceses: out,
    years: allYears,
    maxCell,
    points,
    report: {
      seededEmptyDioceses: seededEmpty,
      unmatchedPrefixes: Array.from(unmatched).sort()
    }
  };
}

module.exports = { buildCoverage };
