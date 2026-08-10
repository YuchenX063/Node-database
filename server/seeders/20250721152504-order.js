'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ order, orderInAlmanacRecord } = require('../models');
const{ loadData } = require('../utils/data-preprocess');
const{ logSeedError, logSeedSection } = require('../utils/seed-logger');


/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      logSeedSection('order');
      const data = await loadData(__dirname);
      for (const file of data) {
        await importData(file);
      }
    },
  
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('orders', null, {});
    await queryInterface.bulkDelete('orderInAlmanacRecords', null, {});
  }
};

async function importData(data) {

  const orderKeys = ['uniqueInstID', 'order'];

  const keyMapping = {
    uniqueInstID: 'almanacRecordID',
    order: 'order'
  };

   const orderInfo = data
    .map(row => {
      const filteredRow = {};
      orderKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      return filteredRow;
    });

  const uniqueOrderInfo = Array.from(new Map(orderInfo.map(item => [`${item.almanacRecordID}-${item.order}`, item])).values());

  for (const item of uniqueOrderInfo) {
    if (item.order) {
      try {
        //console.log(`Creating order: ${item.order}-${item.almanacRecordID}`);
        await order.findOrCreate({
          where: { order: item.order },
          defaults: {
            order: item.order
          }
        });
      } catch (error) {
        logSeedError(`[order] Error creating order: ${JSON.stringify(item)}`, error);
      }
    }
  };

  for (const item of uniqueOrderInfo) {
    if (item.order && item.almanacRecordID) {
      try {
        await orderInAlmanacRecord.findOrCreate({
          where: { order: item.order, almanacRecordID: item.almanacRecordID },
          defaults: {
            order: item.order,
            almanacRecordID: item.almanacRecordID
          }
        });
      } catch (error) {
        logSeedError(`[order] Error creating order: ${JSON.stringify(item)}`, error);
      }
    }
  };

  console.log(`Finished processing orders`);
};