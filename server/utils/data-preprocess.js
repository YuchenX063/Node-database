const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function preprocessCSV(filePath) {
    const data = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            data.push(row); // like append() in Python
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
          row['instYear'] = parseInt(row['year']);
          row['persYear'] = parseInt(row['year']);
          row['attendingInstYear'] = parseInt(row['year']);
          delete row['year'];
        }

        if(row['instID'] && row['instYear']) {
          row['uniqueInstID'] = `${row['instYear']}_${row['instID']}`;
        } else {
          row['uniqueInstID'] = '';
        }

        if(row['attendingInstID'] && row['attendingInstYear']) {
          row['uniqueAttendingInstID'] = `${row['attendingInstYear']}_${row['attendingInstID']}`;
        } else {
          row['uniqueAttendingInstID'] = '';
        }

        if (row['persID'] && row['persID'].startsWith('‒')) {
          row['persID'] = row['persID'].substring(1);
        }

        if (row['persName'] && row['persName'].startsWith('‒ ')) {
          row['persName'] = row['persName'].substring(2);
        }

        if (row['persID'] && row['persYear']) {
          row['uniquePersID'] = `${row['persYear']}_${row['persID']}`;
        }
      };
    return data;
}

async function loadData(directoryPath) {
  let csvFilePath;
  if (process.env.NODE_ENV === 'test') {
    csvFilePath = path.join(directoryPath, 'import', 'test-data');
  }
  else {
    csvFilePath = path.join(directoryPath, 'import', 'data');
  }
  const files = fs.readdirSync(csvFilePath).filter(file => file.endsWith('.csv'));
  let data = [];
  for (const file of files) {
    const filePath = path.join(csvFilePath, file);
    data.push(await preprocessCSV(filePath));
  }
  return data;
}

module.exports = {
  preprocessCSV,
  loadData
};