'use strict';

// Append-only error log for the database seeders, for debugging failed imports.
//
// Each seeder funnels its caught per-record errors through logSeedError(), and
// marks its start with logSeedSection(). Entries are APPENDED (flag 'a', never
// truncated) to SEED_LOG_PATH, so errors from repeated `npm run migrate` runs
// accumulate instead of clobbering the previous run.
//
//   default path : server/logs/seed-errors.log   (the repo's .gitignore skips logs/)
//   override      : SEED_LOG_PATH=/some/mounted/path/seed-errors.log
//
// Reading it when seeders ran inside the container:
//   docker compose exec nodejs-prod cat /server/logs/seed-errors.log

const fs = require('fs');
const path = require('path');

const LOG_PATH = process.env.SEED_LOG_PATH
  ? path.resolve(process.env.SEED_LOG_PATH)
  : path.join(__dirname, '..', 'logs', 'seed-errors.log');

let _dirReady = false;
function ensureDir() {
  if (_dirReady) return;
  try { fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true }); } catch (e) { /* best effort */ }
  _dirReady = true;
}

const ts = () => new Date().toISOString();

const truncate = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };

// Turn an Error (or any thrown value) into a readable, multi-line string.
//
// The important part for DEBUGGING is that Sequelize's own `.message` is often
// empty/generic ("Error") — the real reason lives in the wrapped driver error
// (`.original`/`.parent`: DB error code + sqlMessage), the offending `.sql` and
// bind `.parameters`, and (for validation) the `.errors[]` array. We surface all
// of those, then a COMPACT stack (app frames only — node_modules noise dropped).
function format(err) {
  if (err == null) return String(err);
  if (typeof err === 'string') return err;
  if (!(err instanceof Error)) {
    try { return JSON.stringify(err); } catch (e) { return String(err); }
  }

  const lines = [];
  const name = err.name || 'Error';
  lines.push(err.message ? `${name}: ${err.message}` : name);

  // Sequelize wraps the underlying driver (mysql2) error here — this is where the
  // DB's actual complaint lives (e.g. ER_NO_REFERENCED_ROW_2, ER_DUP_ENTRY).
  const orig = err.original || err.parent;
  if (orig && orig !== err) {
    const bits = [];
    if (orig.code) bits.push(orig.code);
    if (orig.errno != null) bits.push(`errno ${orig.errno}`);
    if (orig.sqlState) bits.push(`sqlState ${orig.sqlState}`);
    if (bits.length) lines.push(`  db: ${bits.join(', ')}`);
    if (orig.sqlMessage) lines.push(`  reason: ${orig.sqlMessage}`);
  }

  // The offending SQL + bind values, so you can see exactly which row/columns.
  const sql = err.sql || (orig && orig.sql);
  if (sql) lines.push(`  sql: ${truncate(sql, 600)}`);
  if (Array.isArray(err.parameters) && err.parameters.length) {
    lines.push(`  params: ${truncate(JSON.stringify(err.parameters), 400)}`);
  }

  // Per-field detail for validation / unique-constraint errors.
  if (Array.isArray(err.errors) && err.errors.length) {
    for (const e of err.errors) {
      const v = e && e.value !== undefined ? ` (value: ${truncate(JSON.stringify(e.value), 120)})` : '';
      lines.push(`  field: ${e.path} — ${e.message}${v}`);
    }
  }

  // Compact stack: app frames (seeders/utils/etc.), not the node_modules chain.
  if (err.stack) {
    const frames = err.stack.split('\n').slice(1).map(s => s.trim().replace(/^at /, ''));
    const app = frames.filter(f => f.includes('/server/') && !f.includes('/node_modules/'));
    for (const f of (app.length ? app : frames.slice(0, 2)).slice(0, 4)) lines.push(`  at ${f}`);
  }

  return lines.join('\n');
}

// Append one line to the log; never throws (logging must not break a seed run).
function append(text) {
  try {
    ensureDir();
    fs.appendFileSync(LOG_PATH, text);
  } catch (e) {
    console.error('[seed-logger] could not write to', LOG_PATH, '-', e.message);
  }
}

// Append a timestamped error entry AND mirror it to stderr (so Docker/CLI output
// still shows it). `context` says where it happened (seeder + record); `err` is
// the thrown value.
function logSeedError(context, err) {
  append(`[${ts()}] ${context}\n${format(err)}\n\n`);
  console.error(context, err);
}

// Section header marking a seeder starting, so errors in the appended log are
// grouped by seeder and separate `npm run migrate` runs are easy to tell apart.
function logSeedSection(name) {
  append(`\n===== ${name} — ${ts()} =====\n`);
}

module.exports = { logSeedError, logSeedSection, LOG_PATH };
