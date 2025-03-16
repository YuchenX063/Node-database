'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ Person } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    if (process.env.NODE_ENV != 'test') {
      const data = await loadData(__dirname);
      for (const file of data) {
        await importData(file);
      }
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('People', null, {});
  }
};

async function importData(data) {

  const personKeys = ['persID', 'persYear', 'persTitle', 'persName', 'persSuffix', 'persNote'];

  const personInfo = data
    .filter(row => personKeys.every(key => key in row))
    .map(row => {
      const filteredRow = {};
      personKeys.forEach(key => {
        filteredRow[key] = row[key];
      });
      return filteredRow;
    });
  
  //console.log(personInfo[0]);

  const uniquePersonInfo = Array.from(new Map(personInfo.map(item => [item.persID, item])).values());

  //console.log(uniquePersonInfo[0]);
  
  for (const item of uniquePersonInfo) {
    if (item.persID) {
      await Person.create(item);
      //console.log(`Created person: ${item.persID}`);
    }
  };

  console.log(`Finished processing people`);

};
