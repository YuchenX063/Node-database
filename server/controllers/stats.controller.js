// Aggregate/summary endpoints powering the exploration dashboards.
// All counts are per-almanac-year snapshots: each institution appears at most
// once per year, so COUNT(DISTINCT instID) per year is "institutions recorded
// in the almanac for that year" — never a true census. The data is two islands
// of years (roughly 3-1840 and 1860-1870) with a gap between, so absolute
// counts across the gap conflate real growth with the source's growing reach.
// Composition (share) metrics are far more robust to that and are the default.

const db = require("../models");
const { parseIntParam, networkCache, cacheKey } = require("../utils/network");

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
