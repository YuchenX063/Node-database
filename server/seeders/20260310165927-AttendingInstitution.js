'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ attendingInstitution } = require('../models');
const{ loadData } = require('../utils/data-preprocess');
const{ logSeedError, logSeedSection } = require('../utils/seed-logger');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    logSeedSection('AttendingInstitution');
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('attendingInstitutions', null, {});
  }
};

async function importData(data) {
  //console.log('Data input:', data[0]);

  const attendingInstitutionKeys = ['uniqueInstID', 'uniqueAttendingInstID', 'attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote'];

  const keyMapping = {
    uniqueInstID: 'attendedInstRecordID',
    uniqueAttendingInstID: 'attendingInstRecordID',
    attendingChurch: 'attendingInstName',
    attendingChurchFrequency: 'attendingFrequency',
    attendingChurchNote: 'note'
  };

  const attendingInstitutionInfo = data
    .map(row => {
      const filteredRow = {};
      attendingInstitutionKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      return filteredRow;
    });
  
  //console.log(attendingInstitutionInfo[0]);

  const uniqueAttendingInstitutionInfo = Array.from(new Map(attendingInstitutionInfo.map(item => [`${item.attendedInstRecordID}-${item.attendingInstRecordID}`, item])).values());
  
  for (const item of uniqueAttendingInstitutionInfo) {
    if (item.attendedInstRecordID && item.attendingInstRecordID) {
      try {
        await attendingInstitution.findOrCreate({
          where: { attendedInstRecordID: item.attendedInstRecordID, attendingInstRecordID: item.attendingInstRecordID },
          defaults: item
        });
      //console.log(`Created attendingInstitution:${item.instID}, ${item.attendingInstID}`);
      } catch (error) {
        logSeedError(`[AttendingInstitution] Error creating attendingInstitution: ${JSON.stringify(item)}`, error);
      }
    }
  };

  console.log(`Finished processing attendingInstitutions`);

};
