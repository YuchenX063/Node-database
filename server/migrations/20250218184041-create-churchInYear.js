'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('churchInYears', {
      uniqueInstID:{
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      instID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      instName: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '(name not recorded)'
      },
      instYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
        type: Sequelize.STRING(1024),
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
      attendingInstID: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attendingChurch: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attendingChurchFrequency: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attendingChurchNote: {
        type: Sequelize.STRING,
        allowNull: true
      },
      uniqueAttendingInstID: {
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
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('churchInYears');
  }
};