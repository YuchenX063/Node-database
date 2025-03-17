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
      uniqueInstID: {
        type: Sequelize.STRING,
        allowNull: false
      },
      uniqueAttendingInstID: {
        type: Sequelize.STRING,
        allowNull: false
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
      fields: ['uniqueInstID', 'uniqueAttendingInstID'],
      type: 'unique',
      name: 'unique_church_church_constraint'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Church_Churches');
  }
};