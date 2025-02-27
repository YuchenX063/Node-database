'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Churches', {
      instID: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      instName: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'name not recorded'
      },
      instYear: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('Churches', {
      fields: ['instID', 'instYear'],
      type: 'unique',
      name: 'unique_church'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Churches');
  }
};