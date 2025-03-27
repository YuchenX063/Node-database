'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('personInYears', {
      persID: {
        type: Sequelize.STRING
      },
      uniquePersID: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      persName: {
        type: Sequelize.STRING
      },
      persNote: {
        type: Sequelize.STRING
      },
      persTitle: {
        type: Sequelize.STRING
      },
      persSuffix: {
        type: Sequelize.STRING
      },
      persYear: {
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
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('personInYears');
  }
};