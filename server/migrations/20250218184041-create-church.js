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
      church_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      language: {
        type: Sequelize.STRING,
        allowNull: true
      },
      instNote: {
        type: Sequelize.STRING,
        allowNull: true
      },
      city_reg: {
        type: Sequelize.STRING,
        allowNull: true
      },
      state_orig: {
        type: Sequelize.STRING,
        allowNull: true
      },
      memberType: {
        type: Sequelize.STRING,
        allowNull: true
      },
      member: {
        type: Sequelize.STRING,
        allowNull: true
      },
      affiliated: {
        type: Sequelize.STRING,
        allowNull: true
      },
      diocese: {
        type: Sequelize.STRING,
        allowNull: true
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