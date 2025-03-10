'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Small_Church } = require('../models');
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
    await queryInterface.bulkDelete('Small_Churches', null, {});
  }
};

async function importData(data) {

  const smallChurchKeys = ['instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'state_orig', 'city_reg', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency', 'diocese'];
  //const churchPersonKeys = ['instID', 'persID', 'instYear', 'persYear', 'role', 'roleNote'];
  //const churchChurchKeys = ['instID', 'attendingInstID', 'instYear', 'attendingInstYear'];

  const smallChurchInfo = data
    .filter(row => smallChurchKeys.every(key => key in row))
    .map(row => {
      const filteredRow = {};
      smallChurchKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  console.log(smallChurchInfo[0]);

  const uniqueSmallChurchInfo = Array.from(new Map(smallChurchInfo.map(item => [item.instID, item])).values());

  console.log(uniqueSmallChurchInfo[0]);
  
  for (const item of uniqueSmallChurchInfo) {
    if (item.instID && item.attendingInstID) {
      await Small_Church.create(item);
      //console.log(`Created small church: ${item.instID}`);
    }
  };

  console.log(`Finished processing small churches`);

};
