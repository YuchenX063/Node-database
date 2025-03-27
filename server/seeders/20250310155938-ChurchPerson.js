'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ churchPerson } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('churchPeople', null, {});
  }
};

async function importData(data) {

  const churchPersonKeys = ['uniqueInstID','uniquePersID'];

  //console.log(data[0]);

  const churchPersonInfo = data
    .map(row => {
      const filteredRow = {};
      churchPersonKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  //console.log(churchPersonInfo[0]);

  const uniqueChurchPersonInfo = Array.from(new Map(churchPersonInfo.map(item => [`${item.uniqueInstID}-${item.uniquePersID}`, item])).values());

  //console.log(uniqueChurchPersonInfo[0]);
  
  for (const item of uniqueChurchPersonInfo) {
    if (item.uniqueInstID && item.uniquePersID) {
      try {
        await churchPerson.findOrCreate({
          where: { uniqueInstID: item.uniqueInstID, uniquePersID: item.uniquePersID },
          defaults: item,
        });
      //console.log(`Created churchPerson:${item.instID}, ${item.uniquePersID}`);
      } catch (error) {
        console.error(`Error creating churchPerson: ${JSON.stringify(item)}`, error);
      }
    }
  };

  console.log(`Finished processing churchPersons`);

};
