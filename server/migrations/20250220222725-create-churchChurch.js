'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('churchChurches', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      uniqueInstID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      uniqueAttendingInstID: {
        type: Sequelize.STRING,
        allowNull: false,
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
      createdAt: {
        allowNull: true,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: true,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('churchChurches', {
      fields: ['uniqueInstID', 'uniqueAttendingInstID'],
      type: 'unique',
      name: 'unique_churchChurch_constraint'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('churchChurches');
  }
};