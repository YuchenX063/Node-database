'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ churchChurch } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('churchChurches', null, {});
  }
};

async function importData(data) {

  const churchChurchKeys = ['uniqueInstID', 'uniqueAttendingInstID', 'attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote'];

  //console.log(data[0]);

  const churchChurchInfo = data
    .map(row => {
      const filteredRow = {};
      churchChurchKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  //console.log(churchChurchInfo[0]);

  const uniqueChurchChurchInfo = Array.from(new Map(churchChurchInfo.map(item => [`${item.uniqueInstID}-${item.uniqueAttendingInstID}`, item])).values());

  //console.log(uniqueChurchChurchInfo[0]);
  
  for (const item of uniqueChurchChurchInfo) {
    if (item.uniqueInstID && item.uniqueAttendingInstID) {
      try {
        await churchChurch.findOrCreate({
          where: { uniqueInstID: item.uniqueInstID, uniqueAttendingInstID: item.uniqueAttendingInstID },
          defaults: item
        });
      //console.log(`Created churchChurch:${item.instID}, ${item.attendingInstID}`);
      } catch (error) {
        console.error(`Error creating churchChurch: ${JSON.stringify(item)}`, error);
      }
    }
  };

  console.log(`Finished processing churchChurches`);

};
