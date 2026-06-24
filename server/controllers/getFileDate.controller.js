const fs = require('fs'); // Node.js's built-in file system module
const path = require('path');

// Returns the modified date of each processed import CSV, newest first.
// The seeders/import/processed directory only exists once a data import has
// actually been run, so a missing directory means "no imports yet" and we return
// an empty list (200) rather than a 500 — otherwise the home and export pages
// error out on any environment that hasn't imported data (e.g. a fresh deploy,
// or local dev without the processed CSVs).
exports.getFileDate = (req, res) => {
    const dirPath = path.join(__dirname, '../seeders/import/processed');
    fs.readdir(dirPath, (err, files) => {
        if (err) {
            if (err.code === 'ENOENT') return res.json([]); // no imports yet
            return res.status(500).json({ error: 'Failed to read directory' });
        }

        const pad = n => n < 10 ? '0' + n : n;
        const fileInfos = files
            .filter(file => file.endsWith('.csv'))
            .map(file => {
                try {
                    const stats = fs.statSync(path.join(dirPath, file));
                    const m = stats.mtime;
                    const formattedDate = `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())} ${pad(m.getHours())}:${pad(m.getMinutes())}:${pad(m.getSeconds())}.${m.getMilliseconds()}`;
                    return { file, mtime: stats.mtime, formattedDate };
                } catch {
                    return null; // file vanished between readdir and stat — skip it
                }
            })
            .filter(Boolean);

        fileInfos.sort((a, b) => b.mtime - a.mtime);

        const fileDates = fileInfos.map(info => ({
            fileName: info.file.replace(/\.csv$/i, ''),
            date: info.formattedDate
        }));

        res.json(fileDates);
    });
}
