// Diocese timeline: which see existed in which year and what it was called.
// Source of truth is a wide CSV (server/data/dioceses-by-year.csv) — one row per
// canonical diocese (col 1 = its stable id, e.g. `nyc.ny`), one column per year,
// each cell the name as printed that year (blank = the see didn't exist then).
//
// The institution ids in the almanac data are prefixed with this same diocese id
// (`nyc.ny.0041` -> `nyc.ny`), so we merge every name variant ("New York" /
// "New York City") onto one canonical diocese WITHOUT fuzzy name matching.

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'dioceses-by-year.csv');

// Minimal quote-aware CSV parse (some cells are quoted with internal commas).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') { inQ = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Strip the trailing source/page ref ("(54)", "(87, 429)", the unclosed "(1980",
// bare trailing numbers "Natchez 131", stray "Detroit??") down to just the name.
function cleanName(raw) {
  return String(raw)
    .replace(/\(.*$/, '')          // "(…" and everything after
    .replace(/[?]+/g, '')          // "Detroit??"
    .replace(/\s+\d[\d\s,]*$/, '') // trailing bare numbers
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalise a name to an alias key: lowercase, no diacritics, letters+digits only.
// "New York City" -> "newyorkcity", "Santa Fé" -> "santafe", "St. Louis" -> "stlouis".
function normalizeName(name) {
  return cleanName(name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// The canonical diocese id embedded in an institution id: first two dotted
// segments (`mob.al.0037&mob.al.0037_02` -> `mob.al`).
function canonicalDioceseId(instID) {
  if (instID == null) return null;
  const parts = String(instID).split('.');
  if (parts.length < 2) return null;
  const id = (parts[0] + '.' + parts[1]).trim();
  return /^[a-z]+\.[a-z]{2}$/i.test(id) ? id.toLowerCase() : null;
}

let _cache = null;

function load() {
  if (_cache) return _cache;

  let rows;
  try {
    rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  } catch (e) {
    // No file (or unreadable): degrade gracefully — callers fall back to raw names.
    _cache = { byId: new Map(), aliasToId: new Map(), years: [], ambiguousAliases: [] };
    return _cache;
  }

  const header = rows[0] || [];
  // Column index -> year, for headers that are a 4-digit year (skip `a`, TIME GAP…).
  const yearCols = [];
  header.forEach((h, i) => {
    const m = /^\s*(\d{4})\s*$/.exec(h);
    if (i >= 2 && m) yearCols.push({ i, year: Number(m[1]) });
  });
  const years = yearCols.map(c => c.year).sort((a, b) => a - b);

  const byId = new Map();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const id = (row[0] || '').trim().toLowerCase();
    if (!id) continue;
    const rootNo = parseInt((row[1] || '').trim(), 10);
    const namesByYear = {};
    const existsYears = new Set();
    for (const { i, year } of yearCols) {
      const raw = (row[i] || '').trim();
      if (!raw) continue;
      existsYears.add(year);
      namesByYear[year] = cleanName(raw);
    }
    if (!existsYears.size) continue;
    const latest = Math.max(...existsYears);
    byId.set(id, {
      id,
      rootNo: Number.isFinite(rootNo) ? rootNo : 9999,
      displayName: namesByYear[latest] || id,   // latest/modern name
      namesByYear,
      existsYears,
      firstYear: Math.min(...existsYears),
      lastYear: latest
    });
  }

  // Alias map (fallback for records we can't key by instID prefix).
  const aliasToId = new Map();
  const ambiguousAliases = [];
  for (const d of byId.values()) {
    for (const y of Object.keys(d.namesByYear)) {
      const key = normalizeName(d.namesByYear[y]);
      if (!key) continue;
      const existing = aliasToId.get(key);
      if (existing && existing !== d.id) ambiguousAliases.push({ key, ids: [existing, d.id] });
      else if (!existing) aliasToId.set(key, d.id);
    }
  }

  _cache = { byId, aliasToId, years, ambiguousAliases };
  return _cache;
}

/** Canonical diocese id for a record: instID prefix, then a name-alias fallback. */
function resolveDioceseId(instID, dioceseName) {
  const { byId, aliasToId } = load();
  const fromId = canonicalDioceseId(instID);
  if (fromId && byId.has(fromId)) return fromId;
  if (dioceseName) {
    const viaAlias = aliasToId.get(normalizeName(dioceseName));
    if (viaAlias) return viaAlias;
  }
  return fromId || null;   // keep the prefix even if unknown, else null
}

function meta(id) { return load().byId.get(id) || null; }
function exists(id, year) { const d = load().byId.get(id); return !!d && d.existsYears.has(year); }
function allYears() { return load().years.slice(); }

module.exports = {
  load, resolveDioceseId, canonicalDioceseId, meta, exists, allYears,
  cleanName, normalizeName
};
