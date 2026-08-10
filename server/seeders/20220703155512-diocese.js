'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { diocese } = require('../models');
const { dioceseInfo } = require('../models');
const { logSeedError, logSeedSection } = require('../utils/seed-logger');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    logSeedSection('diocese');
    const dioceses = [];
    const filePath = path.join(__dirname, 'stable', 'others', 'diocese.csv');
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            dioceses.push(row);
        })
        .on('end', () => {
        resolve();
        })
        .on('error', (error) => {
        reject(error);
        });
    });

    if (dioceses.length > 0) {
      for (const row of dioceses) {
        const value = row[Object.keys(row)[0]];
        //console.log(`Processing diocese: ${value}`);
        try {
          await diocese.findOrCreate({
            where: { diocese: value },
          })
        } catch (error) {
          logSeedError(`[diocese] Error creating diocese: ${value}`, error);
        }
    }
  }
    console.log(`Inserted ${dioceses.length} dioceses into the database.`);

    const dioceseInfoData = [];
    const dioceseFilePath = path.join(__dirname, 'stable', 'others', 'diocese_info.csv');
    await new Promise((resolve, reject) => {
        fs.createReadStream(dioceseFilePath)
        .pipe(csv())
        .on('data', (row) => {
            dioceseInfoData.push(row);
        })
        .on('end', () => {
        resolve();
        })
        .on('error', (error) => {
        reject(error);
        });
    });

    if (dioceseInfoData.length > 0) {
      for (const row of dioceseInfoData) {
        const dioceseName = row['diocese'];
        const year = parseInt(row['year']);
        const info = row['dioceseInfo'];

        try {
          await dioceseInfo.findOrCreate({
            where: { diocese: dioceseName, year: year },
            defaults: {
              diocese: dioceseName,
              year: year,
              dioceseInfo: info
            }
          });
        } catch (error) {
          logSeedError(`[diocese] Error creating dioceseInfo: ${dioceseName} ${year}`, error);
        }
        //console.log(`Processed diocese info for ${dioceseName} in year ${year}`);
      }
    };
    console.log(`Inserted ${dioceseInfoData.length} diocese info records into the database.`);
},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('dioceseInfos', null, {});
    await queryInterface.bulkDelete('dioceses', null, {});
  }
};
