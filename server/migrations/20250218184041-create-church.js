'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Churches', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      instID: {
        type: Sequelize.STRING
      },
      instName: {
        type: Sequelize.STRING
      },
      instYear: {
        type: Sequelize.INTEGER
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