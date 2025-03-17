'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('People', {
      uniquePersID: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      persID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      persName: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '(name not recorded)'
      },
      persYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      persTitle: {
        type: Sequelize.STRING
      },
      persSuffix: {
        type: Sequelize.STRING
      },
      persNote: {
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
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('People');
  }
};