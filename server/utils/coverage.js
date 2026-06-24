// Aggregation for the Coverage page — "the shape of the data itself": which
// dioceses are recorded, in which years, and where geographically. Runs over
// the same in-memory fact array the overview uses (so counts stay consistent),
// producing a tiny payload.

const { childIds } = require('./overview');

const round2 = n => Math.round(n * 100) / 100;

// facts: the internal fact array ({ d, y, lat, lng, _c, ... }).
// Returns:
//   dioceses : [{ key, total, firstYear, lastYear, yearsCovered, lat, lng, years:{year:n} }]
//   years    : every almanac year (matrix columns)
//   maxCell  : largest diocese-year count (grid colour scale)
//   points   : [[lat, lng, year, n, dioceseIndex]] distinct institutions at a
//              ~1km location in one year and diocese (index into `dioceses`).
//              The client filters by year/diocese and lets map-vis bin them.
function buildCoverage(facts, allYears) {
  const byDio = new Map();
  const cellYear = new Map(); // "lat|lng|year|diocese" -> Set(childId)

  for (const f of facts) {
    const ids = f._c || childIds(f.i);

    // Diocese x year matrix (distinct institutions).
    let e = byDio.get(f.d);
    if (!e) { e = { years: new Map(), total: new Set(), latSum: 0, lngSum: 0, geo: 0 }; byDio.set(f.d, e); }
    let ys = e.years.get(f.y);
    if (!ys) { ys = new Set(); e.years.set(f.y, ys); }
    for (const c of ids) { ys.add(c); e.total.add(c); }

    // Distinct institutions per (location, year, diocese) for the map.
    // Exclude exact-zero coords — a "null island" geocoding failure, never real US data.
    if (f.lat != null && f.lng != null && f.lat !== 0 && f.lng !== 0 && Math.abs(f.lat) <= 90 && Math.abs(f.lng) <= 180) {
      e.latSum += f.lat; e.lngSum += f.lng; e.geo += 1;
      const ck = round2(f.lat) + '|' + round2(f.lng) + '|' + f.y + '|' + f.d;
      let cs = cellYear.get(ck);
      if (!cs) { cs = new Set(); cellYear.set(ck, cs); }
      for (const c of ids) cs.add(c);
    }
  }

  let maxCell = 1;
  const dioceses = [];
  for (const [key, e] of byDio) {
    const years = {};
    let first = Infinity, last = -Infinity, covered = 0;
    for (const [y, set] of e.years) {
      const n = set.size;
      years[y] = n;
      if (n > maxCell) maxCell = n;
      if (y < first) first = y;
      if (y > last) last = y;
      covered++;
    }
    dioceses.push({
      key,
      total: e.total.size,
      firstYear: first === Infinity ? null : first,
      lastYear: last === -Infinity ? null : last,
      yearsCovered: covered,
      lat: e.geo ? Math.round((e.latSum / e.geo) * 1000) / 1000 : null,
      lng: e.geo ? Math.round((e.lngSum / e.geo) * 1000) / 1000 : null,
      years
    });
  }
  // Most-covered dioceses first, so the grid reads top-down by richness.
  dioceses.sort((a, b) => (b.total - a.total) || a.key.localeCompare(b.key));
  const dioIndex = new Map();
  dioceses.forEach((d, i) => dioIndex.set(d.key, i));

  const points = [];
  for (const [ck, set] of cellYear) {
    // diocese is the last segment (diocese names contain no '|').
    const parts = ck.split('|');
    const diocese = parts[3];
    points.push([Number(parts[0]), Number(parts[1]), Number(parts[2]), set.size, dioIndex.get(diocese) ?? -1]);
  }

  return { dioceses, years: allYears, maxCell, points };
}

module.exports = { buildCoverage };
