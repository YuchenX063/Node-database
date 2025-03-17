'use strict';

//const { create } = require("../controllers/church.controller");
//const importChurch = require('./import/church.json')

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Church } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Churches', null, {});
  }
};

async function importData(data) {

  const churchKeys = ['uniqueInstID', 'instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'state_orig', 'city_reg', 'memberType', 'member', 'affiliated', 'diocese', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency', 'uniqueAttendingInstID'];

  // extract church information
  const churchInfo = data
    .map(row => {
      const filteredRow = {};
      churchKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  // remove duplicates
  const uniqueChurchInfo = Array.from(new Map(churchInfo.map(item => [item.uniqueInstID, item])).values());
  // mapping the items in churchInfo to tuples of [instID, item]
  // creating a new Map object which automatically removes duplicates
  // converting the Map back to an array of values

  // create church objects
  for (const item of uniqueChurchInfo) {
    if (item.uniqueInstID) {
      try{
        await Church.create(item);
        //console.log(`Created church: ${item.instID}`);
      } catch (error) {
        console.log(`Error creating church: ${item.uniqueInstID}`, error);
      }
    }
  };

  console.log(`Finished processing churches`);

};
