const express = require('express');
const cors = require('cors');
const compression = require('compression');

const app = express();

// gzip all responses — the aggregate/fact endpoints return large JSON
// (the overview facts payload is ~7MB raw, ~1MB gzipped).
app.use(compression());
app.use(cors({origin: '*'}));
app.use(express.json());

require('./routes')(app);

module.exports = app;