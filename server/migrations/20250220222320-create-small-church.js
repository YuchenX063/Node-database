'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Small_Churches', {
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
      attendingInstID: {
        type: Sequelize.STRING
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

    await queryInterface.addConstraint('Small_Churches', {
      fields: ['instID', 'instYear'],
      type: 'unique',
      name: 'unique_small_church'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Small_Churches');
  }
};