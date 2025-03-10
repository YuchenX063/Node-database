'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Small_Churches', {
      instID: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      instName: {
        type: Sequelize.STRING
      },
      instYear: {
        type: Sequelize.INTEGER
      },
      church_type: {
        type: Sequelize.STRING
      },
      language: {
        type: Sequelize.STRING
      },
      instNote: {
        type: Sequelize.STRING
      },
      city_reg: {
        type: Sequelize.STRING
      },
      state_orig: {
        type: Sequelize.STRING
      },
      diocese: {
        type: Sequelize.STRING
      },
      attendingInstID: {
        type: Sequelize.STRING
      },
      attendingChurch: {
        type: Sequelize.STRING
      },
      attendingChurchFrequency: {
        type: Sequelize.STRING
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