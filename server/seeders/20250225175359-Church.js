'use strict';

const { create } = require("../controllers/church.controller");
const importChurch = require('./import/church.json')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    for (const c of importChurch) {
      await queryInterface.bulkInsert('Churches', [{
        instID: c.instID,
        instName: c.instName,
        instYear: c.instYear,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date()
      }], {});
  }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Churches');
  }
};
