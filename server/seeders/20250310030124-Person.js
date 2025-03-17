'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Person } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('People', null, {});
  }
};

async function importData(data) {

  const personKeys = ['uniquePersID', 'persID', 'persYear', 'persTitle', 'persName', 'persSuffix', 'persNote'];

  const personInfo = data
    .map(row => {
      const filteredRow = {};
      personKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  //console.log(personInfo[0]);

  const uniquePersonInfo = Array.from(new Map(personInfo.map(item => [item.uniquePersID, item])).values());

  //console.log(uniquePersonInfo[0]);
  
  for (const item of uniquePersonInfo) {
    if (item.uniquePersID) {
      try {
        await Person.create(item);
        //console.log(`Created person: ${item.persID}`);
      } catch (error) {
        console.error(`Error creating person: ${JSON.stringify(item)}`, error);
      }
    }
  };

  console.log(`Finished processing people`);

};
