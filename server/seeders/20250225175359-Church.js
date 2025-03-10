'use strict';

//const { create } = require("../controllers/church.controller");
//const importChurch = require('./import/church.json')

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Church } = require('../models');
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
    await queryInterface.bulkDelete('Churches', null, {});
  }
};

async function importData(data) {
  const churchKeys = ['instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'state_orig', 'city_reg', 'memberType', 'member', 'affiliated', 'diocese'];
  //const smallChurchKeys = ['instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'state_orig', 'city_reg', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency', 'diocese'];
  //const personKeys = ['persID', 'persYear', 'persTitle', 'persName', 'persSuffix', 'persNote'];
  //const churchPersonKeys = ['instID', 'persID', 'instYear', 'persYear', 'role', 'roleNote'];
  //const churchChurchKeys = ['instID', 'attendingInstID', 'instYear', 'attendingInstYear'];

  // extract church information
  const churchInfo = data
    .filter(row => churchKeys.every(key => key in row)) // Filter rows with all church keys (though might be redundant in this case)
    .map(row => {
      const filteredRow = {};
      churchKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  // remove duplicates
  const uniqueChurchInfo = Array.from(new Map(churchInfo.map(item => [item.instID, item])).values());
  // mapping the items in churchInfo to tuples of [instID, item]
  // creating a new Map object which automatically removes duplicates
  // converting the Map back to an array of values

  // create church objects
  for (const item of uniqueChurchInfo) {
    if (!item.attendingInstID) {
      try{
        await Church.create(item);
        //console.log(`Created church: ${item.instID}`);
      } catch (error) {
        console.log(`Error creating church: ${item.instID}`, error);
      }
    }
  };

  console.log(`Finished processing churches`);

};
