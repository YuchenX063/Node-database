'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ person, personInAlmanacRecord } = require('../models');
const{ loadData } = require('../utils/data-preprocess');
const{ logSeedError, logSeedSection } = require('../utils/seed-logger');

function extractLastName(fullName) {
  if (!fullName) return null;
  const lastNamePrefixes = [
    'van der', 'von der', 'de la', 'du von', 'van den', 'van de',
    'von', 'de', 'la', 'der', 'van', 'du', 'da', 'di', 'le'
  ];
  const wordsInName = fullName.trim().split(/\s+/);
  if (wordsInName.length === 1) {
    return wordsInName[0];
  }

  for (let prefixLen = Math.min(3, wordsInName.length - 1); prefixLen > 0; prefixLen--) {
    const prefixStart = wordsInName.length - (prefixLen + 1);
    if (prefixStart < 0) continue;
    const prefix = wordsInName.slice(prefixStart, prefixStart + prefixLen).join(' ').toLowerCase();
    if (lastNamePrefixes.includes(prefix)) {
      return wordsInName.slice(prefixStart).join(' ');
    }
  }

  return wordsInName[wordsInName.length - 1];
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    logSeedSection('PersonInAlmanacRecord');
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('persons', null, {});
    await queryInterface.bulkDelete('personInAlmanacRecords', null, {});
  }
};

async function importData(data) {

  const personInAlmanacRecordKeys = ['uniqueInstID', 'attendingChurch', 'persID', 'persName', 'persTitle', 'persSuffix', 'persRole', 'persNote', 'attendingInstID'];

  const keyMapping = {
    uniqueInstID: 'almanacRecordID',
    attendingChurch: 'attendingChurch',
    persID: 'persID',
    persName: 'name',
    persTitle: 'title',
    persSuffix: 'suffix',
    persRole: 'role',
    persNote: 'note',
    attendingInstID: 'attendingInstID'
  };

  const personInAlmanacRecordInfo = data
    .map(row => {
      const filteredRow = {};
      personInAlmanacRecordKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      filteredRow.isAttending = !!filteredRow.attendingChurch && filteredRow.attendingChurch.trim() !== '';
      return filteredRow;
    });
  

  const uniquePersonInAlmanacRecordInfo = Array.from(new Map(personInAlmanacRecordInfo.map(item => [`${item.almanacRecordID}-${item.persID}`, item])).values());
  
  for (const item of uniquePersonInAlmanacRecordInfo) {
    if (item.persID) {
      try {
        await person.findOrCreate({
          where: { ID: item.persID },
        });
        //console.log(`Created person: ${item.persID}`);
      } catch (error) {
        logSeedError(`[PersonInAlmanacRecord] Error creating person: ${JSON.stringify(item)}`, error);
      }
    };
    
    if (item.almanacRecordID && item.persID && item.name) {
      //console.log(item);
      const lastName = extractLastName(item.name);
      try {
        await personInAlmanacRecord.findOrCreate({
          where: { almanacRecordID: item.almanacRecordID, persID: item.persID },
          defaults: {
            almanacRecordID: item.almanacRecordID,
            persID: item.persID,
            name: item.name,
            lastName: lastName,
            title: item.title,
            suffix: item.suffix,
            role: item.role,
            note: item.note,
            isAttending: item.isAttending,
            attendingInstID: item.attendingInstID
          }
        });
      //console.log(`Created personInAlmanacRecord:${item.instID}, ${item.uniquePersID}`);
      } catch (error) {
        logSeedError(`[PersonInAlmanacRecord] Error creating personInAlmanacRecord: ${JSON.stringify(item)}`, error);
      }
    }

  };

  console.log(`Finished processing personInAlmanacRecords`);

};
