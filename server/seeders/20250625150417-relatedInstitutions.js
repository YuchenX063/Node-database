'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ almanacRecord, institution, relatedInstitutions } = require('../models');
const{ loadData } = require('../utils/data-preprocess');
const{ logSeedError, logSeedSection } = require('../utils/seed-logger');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    logSeedSection('relatedInstitutions');
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('relatedInstitutions', null, {});
  }
};

async function importData(data) {
  const instKeys = ['uniqueInstID', 'instID']

  const keyMapping = {
    uniqueInstID: 'almanacRecordID',
    instID: 'instID'
  };

  const relatedInstInfo = data
    .map(row => {
      const filteredRow = {};
      instKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key];
        }
      });
      return filteredRow;
    });

  const uniqueRelatedInst= new Map();
  relatedInstInfo.forEach(item => {
    const key = `${item.almanacRecordID}-${item.instID}`;
    uniqueRelatedInst.set(key, item);
  });
  const uniqueRelatedInstInfo = Array.from(uniqueRelatedInst.values());

  const createdRelationships = new Set();

  for (const currentItem of uniqueRelatedInstInfo) {
    const currentInstID = currentItem.instID;

    if (!currentInstID.includes('_')) {
      const matches = uniqueRelatedInstInfo.filter(item => 
        item.instID.startsWith(currentInstID + '_')
      );
      for (const match of matches) {
        // Create relationship key based only on institution IDs (sorted to avoid duplicates)
        const ids = [currentItem.instID, match.instID].sort();
        const relationshipKey = `${ids[0]}-${ids[1]}`;
        
        if (!createdRelationships.has(relationshipKey)) {
          try {
            await relatedInstitutions.findOrCreate({
              where: {
                almanacRecordID: currentItem.almanacRecordID,
                firstID: currentItem.instID,
                secondID: match.instID
              },
              defaults: { isSibling: false }
            });
            createdRelationships.add(relationshipKey);
          } catch (error) {
            logSeedError(`[relatedInstitutions] Error creating relationship ${relationshipKey}:`, error);
          };
          createdRelationships.add(relationshipKey);
        }
      }
    }
  }

  for (const currentItem of uniqueRelatedInstInfo) {
    const currentInstID = currentItem.instID;

    if (currentInstID.includes('_')) {
        const baseID = currentInstID.split('_')[0];
        const matches = uniqueRelatedInstInfo.filter(item => 
        item.instID.startsWith(baseID) && 
        item.instID !== currentInstID &&
        item.instID !== baseID
      );

    for (const match of matches) {
        // Create relationship key based only on institution IDs (sorted to avoid duplicates)
        const ids = [currentItem.instID, match.instID].sort();
        const relationshipKey = `${ids[0]}-${ids[1]}`;
        
        if (!createdRelationships.has(relationshipKey)) {
          try {
            await relatedInstitutions.findOrCreate({
              where: {
                almanacRecordID: currentItem.almanacRecordID,
                firstID: currentItem.instID,
                secondID: match.instID
              },
              defaults: { isSibling: true }
            });
            createdRelationships.add(relationshipKey);
          } catch (error) {
            logSeedError(`[relatedInstitutions] Error creating relationship ${relationshipKey}:`, error);
          };
          createdRelationships.add(relationshipKey);
        }
      }
  }}


    /**if (currentInstID.includes('_')) {
      const baseID = currentInstID.split('_')[0];
      const matches = uniqueRelatedInstInfo.filter(item => 
        item.instID.startsWith(baseID) && 
        item.instID !== currentInstID
      );
      
      for (const match of matches) {
        // Create relationship key based only on institution IDs (sorted to avoid duplicates)
        const ids = [currentItem.instID, match.instID].sort();
        const relationshipKey = `${ids[0]}-${ids[1]}`;
        
        if (!createdRelationships.has(relationshipKey)) {
          try {
            await relatedInstitutions.create({
              almanacRecordID: currentItem.almanacRecordID,
              firstID: currentItem.instID,
              secondID: match.instID,
              isSibling: match.instID.includes('_')
            });
            createdRelationships.add(relationshipKey);
          } catch (error) {
            logSeedError(`[relatedInstitutions] Error creating relationship ${relationshipKey}:`, error);
          };
          createdRelationships.add(relationshipKey);
        }
      }
    } else {
      const matches = uniqueRelatedInstInfo.filter(item => 
        item.instID.startsWith(currentInstID + '_')
      );
      for (const match of matches) {
        // Create relationship key based only on institution IDs (sorted to avoid duplicates)
        const ids = [currentItem.instID, match.instID].sort();
        const relationshipKey = `${ids[0]}-${ids[1]}`;
        
        if (!createdRelationships.has(relationshipKey)) {
          try {
            await relatedInstitutions.findOrCreate({
              where: {
                almanacRecordID: currentItem.almanacRecordID,
                firstID: currentItem.instID,
                secondID: match.instID
              },
              defaults: { isSibling: false }
            });
            createdRelationships.add(relationshipKey);
          } catch (error) {
            logSeedError(`[relatedInstitutions] Error creating relationship ${relationshipKey}:`, error);
          };
          createdRelationships.add(relationshipKey);
        }
      }
    }
  }; */
  console.log(`Finished processing relatedInstitutions`);
}
