const fs = require('fs');
const csv = require('csv-parser');

async function preprocessCSV(filePath) {
    const data = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            data.push(row);
        })
        .on('end', () => {
        resolve();
        })
        .on('error', (error) => {
        reject(error);
        });
    });
    
    for (const row of data) {
        for (const key in row) {
          const originalKey = key;
          const cleanedKey = key.replace(/^\ufeff/, '');
          if (cleanedKey !== originalKey) {
            row[cleanedKey] = row[key];
            delete row[key];
          }
          row[cleanedKey] = row[cleanedKey].replace(/^\ufeff/, '');
        }
    
        if(row['year']) {
          row['instYear'] = row['year'];
          row['persYear'] = row['year'];
          row['attendingInstYear'] = row['year'];
          delete row['year'];
        }
      };
    return data;
}

module.exports = {
  preprocessCSV
};