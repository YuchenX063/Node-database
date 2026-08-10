'use strict';

//const { create } = require("../controllers/institution.controller");
//const importChurch = require('./import/institution.json')

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ almanacRecord, institution } = require('../models');
const{ loadData } = require('../utils/data-preprocess');
const{ logSeedError, logSeedSection } = require('../utils/seed-logger');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    logSeedSection('AlmanacRecord');
    const typeMap = {};
    const filePath = path.join(__dirname, 'stable', 'others', 'types.csv');
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
        .pipe(csv({headers: false}))
        .on('data', (row) => {
            const values = Object.values(row).map(v => v && v.trim()).filter(Boolean);
            if (values.length > 1) {
              const canonical = values[0];
              for (let i = 1; i < values.length; i++) {
                typeMap[values[i]] = canonical;
              }
            }
        })
        .on('end', () => {
        resolve();
        })
        .on('error', (error) => {
        reject(error);
        });
    });
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file, typeMap);
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('institutions', null, {});
    await queryInterface.bulkDelete('almanacRecords', null, {});
  }
};

async function importData(data, typeMap) {

  const instKeys = ['uniqueInstID', 'instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'placeName', 'region', 'county_orig', 'county_reg', 'city_orig', 'city_reg', 'state_orig', 'state_reg', 'latitude', 'longitude', 'memberType', 'member', 'affiliated', 'diocese', 'diocese_reg'];

  const keyMapping = {
    uniqueInstID: 'ID',
    instID: 'instID',
    instYear: 'year',
    church_type: 'instType',
    instName: 'instName',
    language: 'language',
    instNote: 'instNote',
    placeName: 'placeName',
    region: 'region',
    county_orig: 'countyOrig',
    county_reg: 'countyReg',
    city_orig: 'cityOrig',
    city_reg: 'cityReg',
    state_orig: 'stateOrig',
    state_reg: 'stateReg',
    latitude: 'latitude',
    longitude: 'longitude',
    memberType: 'memberType',
    member: 'member',
    affiliated: 'affiliated',
    diocese: 'diocese',
    diocese_reg: 'diocese_reg'
  };

  // extract institution information
  const instInfo = data
    .map(row => {
      const filteredRow = {};
      instKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      return filteredRow;
    });
  
  const instInfoMap = new Map();

  instInfo.forEach(item => {
    if (!item.ID) return;
    if (!instInfoMap.has(item.ID)) {
      instInfoMap.set(item.ID, { ...item });
    } else {
      const existing = instInfoMap.get(item.ID);

      // Aggregate memberType
      if (item.memberType) {
        const types = new Set(
          (existing.memberType ? existing.memberType.split(',') : [])
          .concat(item.memberType.split(','))
          .map(s => s.trim())
          .filter(Boolean)
        );
        existing.memberType = Array.from(types).join(', ');
      }

      // Aggregate member
      if (item.member) {
        const members = new Set(
          (existing.member ? existing.member.split(',') : [])
          .concat(item.member.split(','))
          .map(s => s.trim())
          .filter(Boolean)
        );
        existing.member = Array.from(members).join(', ');
      }
    }
  });

  const uniqueInstInfo = Array.from(instInfoMap.values());

  // remove duplicates
  // const uniqueInstInfo = Array.from(new Map(instInfo.map(item => [item.ID, item])).values());
  // mapping the items in instInfo to tuples of [instID, item]
  // creating a new Map object which automatically removes duplicates
  // converting the Map back to an array of values

  // create institution objects
  for (const item of uniqueInstInfo) {
    // Add the field of instFunction (type mapping)
    if (item.instType) {
      if (item.instType.includes(', ')) {
        const subTypes = item.instType.split(',').map(s => s.trim());
        const mappedSubTypes = subTypes.map(subType => typeMap[subType] || 'other');
        const uniqueMappedSubTypes = Array.from(new Set(mappedSubTypes));
        if (uniqueMappedSubTypes.length === 1) {
          item.instFunction = uniqueMappedSubTypes[0];
        } else {
          item.instFunction = uniqueMappedSubTypes.join(' and ');
        }
      }
      else {
        item.instFunction = typeMap[item.instType] || 'other';
      }
    } else {
      item.instFunction = 'other';
    }

    if (item.ID) {
      try{
        await almanacRecord.findOrCreate({
          where: { ID: item.ID },
          defaults: item
        });
        //console.log(`Created institution: ${item.instID}`);
      } catch (error) {
        logSeedError(`[AlmanacRecord] Error creating almanacRecord: ${item.ID}`, error);
      }
    }
    if (item.instID) {
      try {
        await institution.findOrCreate({
          where: { ID: item.instID }
        });
      } catch (error) {
        logSeedError(`[AlmanacRecord] Error creating institution: ${item.instID}`, error);
      }
    }
  };

  console.log(`Finished processing institutions`);

};
