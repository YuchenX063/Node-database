// Shared helpers for the network graph endpoints.

const DEFAULT_NODE_LIMIT = 500;
const MAX_NODE_LIMIT = 2000;

/* Parses an optional integer query param.
   Returns { value: number|null } or { error: string }. */
function parseIntParam(raw, name) {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    const value = Number(raw);
    if (!Number.isInteger(value)) {
        return { error: `Query parameter '${name}' must be an integer, got '${raw}'.` };
    }
    return { value };
}

/* Validates startYear/endYear/limit from a query object.
   Returns { startYear, endYear, limit } or { error }. */
function parseNetworkParams(query) {
    const start = parseIntParam(query.startYear, 'startYear');
    if (start.error) return { error: start.error };
    const end = parseIntParam(query.endYear, 'endYear');
    if (end.error) return { error: end.error };
    if (start.value != null && end.value != null && start.value > end.value) {
        return { error: `startYear (${start.value}) must not be greater than endYear (${end.value}).` };
    }
    const limit = parseIntParam(query.limit, 'limit');
    if (limit.error) return { error: limit.error };
    if (limit.value != null && limit.value < 1) {
        return { error: `Query parameter 'limit' must be a positive integer.` };
    }
    return {
        startYear: start.value,
        endYear: end.value,
        limit: Math.min(limit.value || DEFAULT_NODE_LIMIT, MAX_NODE_LIMIT)
    };
}

/* Weighted PageRank over an undirected edge list ({from, to, weight}).
   Returns a map of nodeID -> score normalized to [0, 1]. */
function computePageRank(nodeIDs, edgeList, { damping = 0.85, iterations = 50 } = {}) {
    const N = nodeIDs.length;
    if (N === 0) return {};

    const neighbors = {};
    const weightedDegree = {};
    for (const id of nodeIDs) { neighbors[id] = []; weightedDegree[id] = 0; }
    for (const e of edgeList) {
        const w = e.weight;
        neighbors[e.from].push({ id: e.to, weight: w });
        neighbors[e.to].push({ id: e.from, weight: w });
        weightedDegree[e.from] += w;
        weightedDegree[e.to] += w;
    }

    let pr = {};
    for (const id of nodeIDs) pr[id] = 1 / N;

    for (let i = 0; i < iterations; i++) {
        const newPr = {};
        for (const id of nodeIDs) {
            let rank = (1 - damping) / N;
            for (const { id: neighborID, weight } of neighbors[id]) {
                if (weightedDegree[neighborID] > 0) {
                    rank += damping * pr[neighborID] * (weight / weightedDegree[neighborID]);
                }
            }
            newPr[id] = rank;
        }
        pr = newPr;
    }

    const prValues = Object.values(pr);
    const prMin = Math.min(...prValues);
    const prRange = (Math.max(...prValues) - prMin) || 1;
    for (const id of nodeIDs) {
        pr[id] = (pr[id] - prMin) / prRange;
    }
    return pr;
}

/* Keeps only the top `limit` nodes by pageRank (ties broken by id for
   determinism) and drops edges touching removed nodes. Nodes whose every
   edge was cut are dropped too, so the truncated graph contains no orphans. */
function truncateToTopNodes(nodes, edges, limit) {
    if (nodes.length <= limit) {
        return { nodes, edges, truncated: false, totalNodes: nodes.length };
    }
    const kept = [...nodes]
        .sort((a, b) => (b.pageRank - a.pageRank) || String(a.id).localeCompare(String(b.id)))
        .slice(0, limit);
    const keptIDs = new Set(kept.map(n => n.id));
    const keptEdges = edges.filter(e => keptIDs.has(e.from) && keptIDs.has(e.to));

    const connectedIDs = new Set();
    for (const e of keptEdges) {
        connectedIDs.add(e.from);
        connectedIDs.add(e.to);
    }
    const connectedNodes = kept.filter(n => connectedIDs.has(n.id));

    return {
        // Safety valve: if no edges survived at all, fall back to the top nodes
        nodes: connectedNodes.length ? connectedNodes : kept,
        edges: keptEdges,
        truncated: true,
        totalNodes: nodes.length
    };
}

/* Small in-memory TTL cache for expensive network responses. The almanac
   data is effectively read-only, so a short TTL is only a safety valve. */
class TtlCache {
    constructor({ maxEntries = 100, ttlMs = 10 * 60 * 1000 } = {}) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        this.map = new Map();
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expires) {
            this.map.delete(key);
            return undefined;
        }
        // refresh recency for LRU eviction
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        if (this.map.size >= this.maxEntries) {
            this.map.delete(this.map.keys().next().value);
        }
        this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    }
}

const networkCache = new TtlCache();

/* Stable cache key from a route name and the query params that affect it. */
function cacheKey(route, query) {
    const parts = Object.keys(query).sort().map(k => `${k}=${query[k]}`);
    return `${route}?${parts.join('&')}`;
}

module.exports = {
    parseNetworkParams,
    parseIntParam,
    computePageRank,
    truncateToTopNodes,
    networkCache,
    cacheKey,
    DEFAULT_NODE_LIMIT,
    MAX_NODE_LIMIT
};
