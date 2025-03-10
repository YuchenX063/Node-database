'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Church_Person } = require('../models');
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
    await queryInterface.bulkDelete('Churche_People', null, {});
  }
};

async function importData(data) {

  const churchPersonKeys = ['instID', 'instName', 'instYear', 'persID', 'persName', 'persYear'];

  //console.log(data[0]);

  const churchPersonInfo = data
    .filter(row => churchPersonKeys.every(key => key in row))
    .map(row => {
      const filteredRow = {};
      churchPersonKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  //console.log(churchPersonInfo[0]);

  const uniqueChurchPersonInfo = Array.from(new Map(churchPersonInfo.map(item => [`${item.instID}-${item.persID}`, item])).values());

  console.log(uniqueChurchPersonInfo[0]);
  
  for (const item of uniqueChurchPersonInfo) {
    if (item.instID && item.persID) {
      await Church_Person.create(item);
      //console.log(`Created church_person:${item.instID}, ${item.persID}`);
    }
  };

  console.log(`Finished processing church_persons`);

};
