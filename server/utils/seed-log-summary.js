#!/usr/bin/env node
'use strict';

// Triage tool for the seed error log. Groups errors by seeder + DB error code +
// a normalized reason (specific ids/numbers blanked out), so thousands of lines
// collapse into a ranked punch list with counts and one concrete example each.
//
//   node utils/seed-log-summary.js [logPath]
//   npm run seed:errors                       (from server/)
//
// Defaults to SEED_LOG_PATH or server/logs/seed-errors.log.

const fs = require('fs');
const { LOG_PATH } = require('./seed-logger');

const file = process.argv[2] || process.env.SEED_LOG_PATH || LOG_PATH;
let text;
try {
  text = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.error(`Cannot read log: ${file}\n  ${e.message}`);
  process.exit(1);
}

// An entry starts at a header line: "[ISO-timestamp] [Seeder] context…", and
// runs until the next header (its body holds the enriched db/reason/sql lines).
const HEAD = /^\[\d{4}-\d\d-\d\dT[^\]]+\]\s+(.*)$/;
const entries = [];
let cur = null;
for (const line of text.split('\n')) {
  if (line.startsWith('=====')) continue;            // section header
  const m = HEAD.exec(line);
  if (m) {
    if (cur) entries.push(cur);
    cur = { context: m[1], body: [] };
  } else if (cur) {
    cur.body.push(line);
  }
}
if (cur) entries.push(cur);

const seederOf = ctx => (ctx.match(/^\[([^\]]+)\]/) || [, 'unknown'])[1];

// Classify an entry by DB code + normalized reason (so distinct ids group together).
function classify(e) {
  const body = e.body.join('\n');
  const code = (body.match(/db:\s*([A-Z0-9_]+)/) || [])[1];
  const name = ((e.body[0] || '').match(/^([A-Za-z]+Error)\b/) || [])[1];
  let reason = (body.match(/reason:\s*(.*)/) || [])[1] || e.body[0] || '(no detail — re-run with the enriched logger)';
  reason = reason.replace(/'[^']*'/g, "'…'").replace(/\b\d+\b/g, 'N').trim();
  return { label: code || name || 'unknown', reason };
}

const groups = new Map();
for (const e of entries) {
  const seeder = seederOf(e.context);
  const { label, reason } = classify(e);
  const key = `${seeder}\t${label}\t${reason}`;
  let g = groups.get(key);
  if (!g) { g = { seeder, label, reason, count: 0, example: e.context }; groups.set(key, g); }
  g.count++;
}

const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
const bySeeder = {};
for (const e of entries) bySeeder[seederOf(e.context)] = (bySeeder[seederOf(e.context)] || 0) + 1;

console.log(`\nSeed error summary`);
console.log(`  log:     ${file}`);
console.log(`  errors:  ${entries.length}   groups: ${groups.size}`);
console.log(`  by seeder: ${Object.entries(bySeeder).map(([s, n]) => `${s}=${n}`).join('  ') || '(none)'}\n`);
for (const g of sorted) {
  console.log(`${String(g.count).padStart(6)}  [${g.seeder}]  ${g.label}`);
  console.log(`        ${g.reason}`);
  console.log(`        e.g. ${g.example}\n`);
}
if (!entries.length) console.log('No errors logged. 🎉\n');
