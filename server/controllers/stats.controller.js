// Aggregate/summary endpoints powering the exploration dashboards.
// All counts are per-almanac-year snapshots: each institution appears at most
// once per year, so COUNT(DISTINCT instID) per year is "institutions recorded
// in the almanac for that year" — never a true census. The data is two islands
// of years (roughly 1833-1840 and 1860-1870) with a gap between, so absolute
// counts across the gap conflate real growth with the source's growing reach.
// Composition (share) metrics are far more robust to that and are the default.

const db = require("../models");
const { parseIntParam, networkCache, cacheKey } = require("../utils/network");
const { childIds, buildOverview } = require("../utils/overview");
const { buildCoverage } = require("../utils/coverage");

// The five canonical institution functions (from functions.csv). instFunction
// can be a compound string like "consecrated life institutions and educational
// institutions"; we bucket each institution-year by its PRIMARY (first) function
// so the buckets are mutually exclusive and shares sum to 100%.
const FUNCTION_BUCKETS = [
    'religious institutions',
    'educational institutions',
    'consecrated life institutions',
    'charitable institutions',
    'healthcare institutions'
];
const OTHER_BUCKET = 'other';

function primaryFunction(raw) {
    if (!raw) return OTHER_BUCKET;
    const first = String(raw).split(/\s+and\s+/i)[0].trim().toLowerCase();
    return FUNCTION_BUCKETS.includes(first) ? first : OTHER_BUCKET;
}

// Clergy hierarchy ranks, from the (heavily skewed) `title` field. Ordered
// high-to-low so the stacked chart reads as a pyramid from the top down.
const TITLE_BUCKETS = [
    'archbishop',          // Most Rev.
    'bishop',              // Rt. Rev. / Right Rev.
    'vicar or superior',   // Very Rev.
    'priest',              // Rev. (and Rev. Father / Fr. / P.)
    'seminarian or lay'    // Rev. Mr. / Mr.
];

// Buckets a title string into a rank. Order matters: more specific prefixes
// (which all contain "Rev") are tested before the bare "Rev." priest catch-all.
function titleRank(raw) {
    if (!raw) return OTHER_BUCKET;
    const t = String(raw).toLowerCase();
    if (t.includes('most rev')) return 'archbishop';
    if (t.includes('rt. rev') || t.includes('rt rev') || t.includes('right rev')) return 'bishop';
    if (t.includes('very rev')) return 'vicar or superior';
    if (/\bmr\b/.test(t)) return 'seminarian or lay';   // "Rev. Mr." or "Mr."
    if (t.includes('rev')) return 'priest';
    return OTHER_BUCKET;
}

// Builds the shared almanacRecord WHERE clause (function present + optional
// diocese/state/year), with each column prefixed for the active table alias.
function buildCompositionWhere(prefix, { diocese, state, startYear, endYear }, requireFunction = true) {
    const where = requireFunction ? [`${prefix}instFunction IS NOT NULL`, `${prefix}instFunction <> ''`] : [];
    const replacements = {};
    if (diocese) { where.push(`${prefix}diocese_reg = :diocese`); replacements.diocese = diocese; }
    if (state) { where.push(`${prefix}stateOrig = :state`); replacements.state = state; }
    if (startYear != null) { where.push(`${prefix}year >= :startYear`); replacements.startYear = startYear; }
    if (endYear != null) { where.push(`${prefix}year <= :endYear`); replacements.endYear = endYear; }
    return { whereStr: where.length ? where.join(' AND ') : '1=1', replacements };
}

// Returns the composition by institution function for each almanac year, for
// either institutions (entity=institutions, the default) or the people who
// served them (entity=people). Optionally scoped to one diocese and/or state.
// Response is tidy long-format rows the client feeds straight into a chart.
exports.getComposition = async (req, res) => {
    const { diocese, state } = req.query;
    const entity = req.query.entity === 'people' ? 'people' : 'institutions';
    const dimension = req.query.dimension === 'title' ? 'title' : 'function';
    if (dimension === 'title' && entity !== 'people') {
        return res.status(400).json({ message: "dimension 'title' is only available for entity 'people'." });
    }

    const startParam = parseIntParam(req.query.startYear, 'startYear');
    if (startParam.error) return res.status(400).json({ message: startParam.error });
    const endParam = parseIntParam(req.query.endYear, 'endYear');
    if (endParam.error) return res.status(400).json({ message: endParam.error });
    const startYear = startParam.value;
    const endYear = endParam.value;
    if (startYear != null && endYear != null && startYear > endYear) {
        return res.status(400).json({ message: `startYear (${startYear}) must not be greater than endYear (${endYear}).` });
    }

    const key = cacheKey('stats/composition', req.query);
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    const filters = { diocese, state, startYear, endYear };
    const isTitle = dimension === 'title';
    const bucketer = isTitle ? titleRank : primaryFunction;
    const ALL_BUCKETS = isTitle ? TITLE_BUCKETS : FUNCTION_BUCKETS;

    try {
        // Every branch returns rows of { year, bucketRaw, count }; the folding
        // and response below are identical from there.
        let rows;
        if (entity === 'people') {
            // People have no native geography/function/rank — they inherit it from
            // the institution-year they served. A person at several institutions in
            // one year is counted ONCE, attributed to a single representative record
            // (the lowest matching almanacRecordID), so the stack stays a clean 100%.
            // Function comes from that record's institution; rank from its person row.
            const { whereStr, replacements } = buildCompositionWhere('ar.', filters, !isTitle);
            const innerPri =
                `SELECT piar.persID AS persID, ar.year AS year, MIN(piar.almanacRecordID) AS repID
                 FROM personInAlmanacRecords piar
                 JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID
                 WHERE ${whereStr}
                 GROUP BY piar.persID, ar.year`;
            const sql = isTitle
                ? `SELECT pri.year AS year, rep.title AS bucketRaw, COUNT(*) AS count
                   FROM (${innerPri}) pri
                   JOIN personInAlmanacRecords rep ON rep.persID = pri.persID AND rep.almanacRecordID = pri.repID
                   GROUP BY pri.year, rep.title
                   ORDER BY pri.year`
                : `SELECT pri.year AS year, rep.instFunction AS bucketRaw, COUNT(*) AS count
                   FROM (${innerPri}) pri
                   JOIN almanacRecords rep ON rep.ID = pri.repID
                   GROUP BY pri.year, rep.instFunction
                   ORDER BY pri.year`;
            rows = await db.sequelize.query(sql, { replacements, type: db.Sequelize.QueryTypes.SELECT });
        } else {
            // One row per (year, raw instFunction). Each institution-year has
            // exactly one instFunction string, so summing by primary bucket is exact.
            const { whereStr, replacements } = buildCompositionWhere('', filters);
            rows = await db.sequelize.query(
                `SELECT year, instFunction AS bucketRaw, COUNT(DISTINCT instID) AS count
                 FROM almanacRecords
                 WHERE ${whereStr}
                 GROUP BY year, instFunction
                 ORDER BY year`,
                { replacements, type: db.Sequelize.QueryTypes.SELECT }
            );
        }

        // Fold raw values into canonical buckets, keyed by year
        const byYear = new Map(); // year -> { bucket -> count }
        for (const row of rows) {
            const bucket = bucketer(row.bucketRaw);
            if (!byYear.has(row.year)) byYear.set(row.year, {});
            const buckets = byYear.get(row.year);
            buckets[bucket] = (buckets[bucket] || 0) + Number(row.count);
        }

        const years = Array.from(byYear.keys()).sort((a, b) => a - b);
        const usedBuckets = [...ALL_BUCKETS, OTHER_BUCKET]
            .filter(b => years.some(y => byYear.get(y)[b]));

        const tidy = [];
        for (const year of years) {
            const buckets = byYear.get(year);
            const total = Object.values(buckets).reduce((a, b) => a + b, 0);
            for (const group of usedBuckets) {
                const count = buckets[group] || 0;
                tidy.push({
                    year,
                    group,
                    count,
                    total,
                    share: total > 0 ? count / total : 0
                });
            }
        }

        const baseNote = 'Years not shown were not published or collected; across long gaps, absolute counts reflect the source\'s growing coverage rather than only real growth, so share is the more comparable measure.';
        let note;
        if (isTitle) {
            note = 'Counts are people as recorded in the almanac each year, grouped by the rank implied by their title. Most clergy are listed simply as "Rev.", so the lay/seminarian and higher ranks are small by comparison. Someone listed several times in a year is counted once, by a representative record. ' + baseNote;
        } else if (entity === 'people') {
            note = 'Counts are people as recorded in the almanac each year, grouped by the function of the institution they served. Someone serving several institutions in a year is counted once, by a representative affiliation. ' + baseNote;
        } else {
            note = 'Counts are institutions as recorded in the almanac for each year. ' + baseNote;
        }

        const result = {
            meta: {
                entity,
                dimension,
                diocese: diocese || null,
                state: state || null,
                buckets: usedBuckets,
                years,
                note
            },
            rows: tidy
        };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Compares a SUBSET of institutions against the WHOLE, year by year, so a
// researcher can ask "all Catholic hospitals grew X%, but did this subset
// grow faster?" The "whole" is every institution matching a category (a type
// like 'hospital' or a function like 'healthcare institutions'); the "subset"
// is that same set narrowed by one dimension (religious order, diocese, or
// state). Both are returned as raw per-year counts; the client indexes them.
const SUBSET_KINDS = {
    order: { join: 'JOIN orderInAlmanacRecords oiar ON oiar.almanacRecordID = ar.ID', clause: 'oiar.`order` = :subsetValue' },
    diocese: { join: '', clause: 'ar.diocese_reg = :subsetValue' },
    state: { join: '', clause: 'ar.stateOrig = :subsetValue' }
};

exports.getSubsetVsWhole = async (req, res) => {
    const { categoryKind, category, subsetKind, subsetValue } = req.query;

    if (categoryKind !== 'type' && categoryKind !== 'function') {
        return res.status(400).json({ message: "categoryKind must be 'type' or 'function'." });
    }
    if (!category) {
        return res.status(400).json({ message: 'category is required.' });
    }
    if (!SUBSET_KINDS[subsetKind]) {
        return res.status(400).json({ message: "subsetKind must be 'order', 'diocese', or 'state'." });
    }
    if (!subsetValue) {
        return res.status(400).json({ message: 'subsetValue is required.' });
    }
    const entity = req.query.entity === 'people' ? 'people' : 'institutions';

    const key = cacheKey('stats/subset-vs-whole', req.query);
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    // Category is matched with LIKE so compound entries count too — e.g. an
    // instType of "hospital, asylum" is included when category is "hospital".
    const categoryColumn = categoryKind === 'type' ? 'ar.instType' : 'ar.instFunction';
    const categoryClause = `${categoryColumn} LIKE :category`;
    const replacements = { category: `%${category}%`, subsetValue };
    const subset = SUBSET_KINDS[subsetKind];

    // For people we count distinct persons serving institutions of the category,
    // by joining the person records to those institution-years. For institutions
    // we count the institutions themselves.
    const countExpr = entity === 'people' ? 'COUNT(DISTINCT piar.persID)' : 'COUNT(DISTINCT ar.instID)';
    const baseFrom = entity === 'people'
        ? 'personInAlmanacRecords piar JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID'
        : 'almanacRecords ar';

    try {
        const wholeRows = await db.sequelize.query(
            `SELECT ar.year AS year, ${countExpr} AS count
             FROM ${baseFrom}
             WHERE ${categoryClause}
             GROUP BY ar.year
             ORDER BY ar.year`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        const subsetRows = await db.sequelize.query(
            `SELECT ar.year AS year, ${countExpr} AS count
             FROM ${baseFrom}
             ${subset.join}
             WHERE ${categoryClause} AND ${subset.clause}
             GROUP BY ar.year
             ORDER BY ar.year`,
            { replacements, type: db.Sequelize.QueryTypes.SELECT }
        );

        const noun = entity === 'people' ? 'people serving institutions' : 'institutions';
        const toSeries = rows => rows.map(r => ({ year: r.year, count: Number(r.count) }));
        const result = {
            meta: {
                entity,
                categoryKind,
                category,
                subsetKind,
                subsetValue,
                years: wholeRows.map(r => r.year),
                note: `Counts are ${noun} recorded in the almanac each year. Religious-order tagging currently covers a small share of institutions and a limited range of years, so order subsets rest on small numbers — read indexed growth alongside the raw counts.`
            },
            whole: toSeries(wholeRows),
            subset: toSeries(subsetRows)
        };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Geo points for the "Spread of the Church" map dashboard. Returns every
// almanac-year location aggregated to a ~0.1 degree grid (so the payload stays
// small and the heatmap weights are meaningful), tagged with its primary
// function, plus a per-year timeline of total count and the geographic
// centre-of-gravity (mean lng/lat). The client animates a single year at a time
// and reads the centroid marching west as the headline "spread" signal.
//
// entity=institutions (default): weight = institution-years at that cell.
// entity=people: weight = people-years serving institutions at that cell.
//
// by=function (default): each point is tagged with its primary function (`fn`).
// by=diocese: each point is tagged with its registered diocese (`diocese`), and
//   meta.categories lists every diocese with its total weight (biggest first) so
//   the "Diocese by Diocese" tracker can build a selector + legend.
exports.getGeo = async (req, res) => {
    const entity = req.query.entity === 'people' ? 'people' : 'institutions';
    const by = req.query.by === 'diocese' ? 'diocese' : 'function';
    const catField = by === 'diocese' ? 'diocese' : 'fn';

    const key = cacheKey('stats/geo', { entity, by });
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    try {
        let rows;
        if (entity === 'people') {
            rows = await db.sequelize.query(
                `SELECT ar.latitude AS lat, ar.longitude AS lng, ar.year AS year,
                        ar.instFunction AS fn, ar.diocese_reg AS diocese, COUNT(piar.persID) AS weight
                 FROM personInAlmanacRecords piar
                 JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID
                 WHERE ar.latitude IS NOT NULL AND ar.longitude IS NOT NULL AND ar.year IS NOT NULL
                 GROUP BY ar.ID, ar.latitude, ar.longitude, ar.year, ar.instFunction, ar.diocese_reg`,
                { type: db.Sequelize.QueryTypes.SELECT }
            );
        } else {
            rows = await db.sequelize.query(
                `SELECT latitude AS lat, longitude AS lng, year AS year,
                        instFunction AS fn, diocese_reg AS diocese, 1 AS weight
                 FROM almanacRecords
                 WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND year IS NOT NULL`,
                { type: db.Sequelize.QueryTypes.SELECT }
            );
        }

        // Category for each row: a function bucket, or the diocese (raw value).
        const categoryOf = r => by === 'diocese'
            ? (r.diocese && String(r.diocese).trim() ? String(r.diocese).trim() : 'Unknown')
            : primaryFunction(r.fn);

        const pointMap = new Map();    // "year|lat|lng|cat" -> summed weight
        const yearStats = new Map();   // year -> { total, sumLng, sumLat }
        const catTotals = new Map();   // category -> total weight (all years)
        for (const r of rows) {
            const w = Number(r.weight) || 0;
            if (!w) continue;
            const lat = Number(r.lat);
            const lng = Number(r.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const cat = categoryOf(r);
            const rlat = Math.round(lat * 10) / 10;
            const rlng = Math.round(lng * 10) / 10;
            const pkey = `${r.year}|${rlat}|${rlng}|${cat}`;
            pointMap.set(pkey, (pointMap.get(pkey) || 0) + w);
            catTotals.set(cat, (catTotals.get(cat) || 0) + w);
            let ys = yearStats.get(r.year);
            if (!ys) { ys = { total: 0, sumLng: 0, sumLat: 0 }; yearStats.set(r.year, ys); }
            ys.total += w;
            ys.sumLng += lng * w;
            ys.sumLat += lat * w;
        }

        const points = [];
        for (const [pkey, weight] of pointMap) {
            // Split off the trailing category (diocese names contain no '|').
            const idx = pkey.indexOf('|');
            const idx2 = pkey.indexOf('|', idx + 1);
            const idx3 = pkey.indexOf('|', idx2 + 1);
            const year = Number(pkey.slice(0, idx));
            const lat = Number(pkey.slice(idx + 1, idx2));
            const lng = Number(pkey.slice(idx2 + 1, idx3));
            const cat = pkey.slice(idx3 + 1);
            points.push({ year, lat, lng, [catField]: cat, weight });
        }
        const years = Array.from(yearStats.entries())
            .map(([year, s]) => ({
                year,
                total: s.total,
                centroidLng: s.sumLng / s.total,
                centroidLat: s.sumLat / s.total
            }))
            .sort((a, b) => a.year - b.year);

        const categories = Array.from(catTotals.entries())
            .map(([key, total]) => ({ key, total }))
            .sort((a, b) => b.total - a.total);

        const result = {
            meta: {
                entity,
                by,
                categories,
                note: `Each point is an almanac-year location snapped to a ~0.1° grid; weight is the number of ${entity === 'people' ? 'people-years serving institutions' : 'institution-years'} there. Coverage grows across the two year-islands, so absolute spread partly reflects the source's widening reach.`
            },
            years,
            points
        };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// ---- Overview dashboard ("god view"): server-side cross-filtering ----
//
// The browser holds NO data. It posts the current filter state to /overview and
// gets back only the panel results. We aggregate in-memory over a fact array
// built once per process (the corpus is static), so each request is cheap and
// the payload is a few KB instead of the whole ~700 KB corpus.

const OVERVIEW_NOTE = 'Counts are distinct institutions (or distinct people), deduplicated across years; branching identities are counted as separate houses. Coverage grows across the two year-islands (c. 1834-1840 and 1860-1870), so totals reflect the source\'s widening reach as much as real growth.';

// Internal fact array, built once. Each fact:
//   { i,y,f,t,d,s,lat,lng, pp:[personIds], o:[orders], _c:[childInstitutionIds] }
let _factsPromise = null;
let _factYears = [];

function loadFacts() {
    if (!_factsPromise) _factsPromise = buildFactArray();
    return _factsPromise;
}

async function buildFactArray() {
    // GROUP BY ar.ID (the PK) lets MySQL treat the other ar.* columns as
    // functionally dependent. orders fan-out is collapsed by GROUP_CONCAT.
    const rows = await db.sequelize.query(
        `SELECT ar.ID AS recID, ar.instID AS instID, ar.year AS year,
                ar.instFunction AS fn, ar.instType AS type,
                ar.diocese_reg AS diocese, ar.stateOrig AS state,
                ar.latitude AS lat, ar.longitude AS lng,
                GROUP_CONCAT(DISTINCT oiar.\`order\`) AS orders
         FROM almanacRecords ar
         LEFT JOIN orderInAlmanacRecords oiar ON oiar.almanacRecordID = ar.ID
         WHERE ar.year IS NOT NULL
         GROUP BY ar.ID`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );

    // Person ids per record (separate query, not GROUP_CONCAT, to avoid
    // truncation on big institutions). recID -> [persID, ...].
    const personRows = await db.sequelize.query(
        `SELECT piar.almanacRecordID AS recID, piar.persID AS persID
         FROM personInAlmanacRecords piar
         JOIN almanacRecords ar ON ar.ID = piar.almanacRecordID
         WHERE ar.year IS NOT NULL AND piar.persID IS NOT NULL
         GROUP BY piar.almanacRecordID, piar.persID`,
        { type: db.Sequelize.QueryTypes.SELECT }
    );
    const personsByRec = new Map();
    for (const pr of personRows) {
        let arr = personsByRec.get(pr.recID);
        if (!arr) { arr = []; personsByRec.set(pr.recID, arr); }
        arr.push(pr.persID);
    }

    const clean = v => (v && String(v).trim() ? String(v).trim() : null);
    const round = n => {
        const x = Number(n);
        return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null;
    };

    const facts = rows.map(r => {
        const i = r.instID;
        return {
            i,
            y: Number(r.year),
            f: primaryFunction(r.fn),
            t: clean(r.type),
            d: clean(r.diocese) || 'Unknown',
            s: clean(r.state),
            lat: round(r.lat),
            lng: round(r.lng),
            pp: personsByRec.get(r.recID) || [],
            o: r.orders ? String(r.orders).split(',').map(s => s.trim()).filter(Boolean) : [],
            _c: childIds(i)
        };
    });
    _factYears = Array.from(new Set(facts.map(f => f.y))).sort((a, b) => a - b);
    return facts;
}

// POST /api/stats/overview  body: { entity, years[], functions[], types[], dioceses[] }
// Returns { kpis, functions, types, dioceses, years, map, meta } — just the panels.
exports.getOverview = async (req, res) => {
    const body = req.body || {};
    const entity = body.entity === 'people' ? 'people' : 'institutions';
    const arr = v => (Array.isArray(v) ? v : []);
    const yearsArr = arr(body.years).map(Number).filter(Number.isFinite);
    const fnArr = arr(body.functions).map(String);
    const typeArr = arr(body.types).map(String);
    const dioArr = arr(body.dioceses).map(String);

    // Stable cache key (data is static, so identical filter states are free).
    const j = a => a.slice().sort().join(',');
    const key = `stats/overview?e=${entity}&y=${j(yearsArr.map(String))}&f=${j(fnArr)}&t=${j(typeArr)}&d=${j(dioArr)}`;
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    try {
        const facts = await loadFacts();
        const state = {
            years: new Set(yearsArr),
            functions: new Set(fnArr),
            types: new Set(typeArr),
            dioceses: new Set(dioArr)
        };
        const result = buildOverview(facts, state, entity, _factYears, [...FUNCTION_BUCKETS, OTHER_BUCKET]);
        result.meta = { entity, years: _factYears, note: OVERVIEW_NOTE };
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// GET /api/stats/coverage — "shape of the data": diocese x year matrix plus a
// spatial 0.5deg binned heatmap. Aggregated over the same cached fact array.
exports.getCoverage = async (req, res) => {
    const key = cacheKey('stats/coverage', {});
    const cached = networkCache.get(key);
    if (cached) return res.send(cached);

    try {
        const facts = await loadFacts();
        const result = buildCoverage(facts, _factYears);
        result.note = 'Coverage = distinct institutions recorded for a diocese in a year. It reflects how thoroughly the almanacs documented each see over time, not the true size of the church — empty cells are years a diocese was not published or collected.';
        networkCache.set(key, result);
        res.send(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
