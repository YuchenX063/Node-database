'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Church_Churches', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      instID: {
        type: Sequelize.STRING
      },
      instYear: {
        type: Sequelize.INTEGER
      },
      attendingInstID: {
        type: Sequelize.STRING
      },
      attendingInstYear: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: true,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: true,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('Church_Churches', {
      fields: ['instID', 'instYear', 'attendingInstID', 'attendingInstYear'],
      type: 'unique',
      name: 'unique_church_church'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Church_Churches');
  }
};