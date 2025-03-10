'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Church_Church } = require('../models');
const{ preprocessCSV } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const csvFilePath = path.join(__dirname, 'import');
    const files = fs.readdirSync(csvFilePath).filter(file => file.endsWith('.csv'));

    for (const file of files) {
      const filePath = path.join(csvFilePath, file);
      const data = await preprocessCSV(filePath);
      await importData(data);
    };},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Churche_Churches', null, {});
  }
};

async function importData(data) {

  const churchChurchKeys = ['instID', 'attendingInstID', 'instYear', 'attendingInstYear'];

  console.log(data[0]);

  const churchChurchInfo = data
    .filter(row => churchChurchKeys.every(key => key in row))
    .map(row => {
      const filteredRow = {};
      churchChurchKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  console.log(churchChurchInfo[0]);

  const uniqueChurchChurchInfo = Array.from(new Map(churchChurchInfo.map(item => [`${item.instID}-${item.attendingInstID}`, item])).values());

  console.log(uniqueChurchChurchInfo[0]);
  
  for (const item of uniqueChurchChurchInfo) {
    if (item.instID && item.attendingInstID) {
      await Church_Church.create(item);
      console.log(`Created church_church:${item.instID}, ${item.attendingInstID}`);
    }
  };

  console.log(`Finished processing church_churches`);

};
