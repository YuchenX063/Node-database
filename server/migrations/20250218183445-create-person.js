'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('People', {
      persID: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      persName: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'name not recorded'
      },
      persYear: {
        type: Sequelize.INTEGER
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

    await queryInterface.addConstraint('People', {
      fields: ['persID', 'persYear'],
      type: 'unique',
      name: 'unique_person'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('People');
  }
};