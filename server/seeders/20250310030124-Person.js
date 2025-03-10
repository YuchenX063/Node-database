'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Person } = require('../models');
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
    await queryInterface.bulkDelete('People', null, {});
  }
};

async function importData(data) {

  //const smallChurchKeys = ['instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'state_orig', 'city_reg', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency', 'diocese'];
  const personKeys = ['persID', 'persYear', 'persTitle', 'persName', 'persSuffix', 'persNote'];
  //const churchPersonKeys = ['instID', 'persID', 'instYear', 'persYear', 'role', 'roleNote'];
  //const churchChurchKeys = ['instID', 'attendingInstID', 'instYear', 'attendingInstYear'];

  const personInfo = data
    .filter(row => personKeys.every(key => key in row))
    .map(row => {
      const filteredRow = {};
      personKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  console.log(personInfo[0]);

  const uniquePersonInfo = Array.from(new Map(personInfo.map(item => [item.persID, item])).values());

  console.log(uniquePersonInfo[0]);
  
  for (const item of uniquePersonInfo) {
    if (item.persID) {
      await Person.create(item);
      //console.log(`Created person: ${item.persID}`);
    }
  };

  console.log(`Finished processing people`);

};
