'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('churchPeople', {
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
      persID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      persName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      persYear: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      persTitle: {
        type: Sequelize.STRING,
        allowNull: true
      },
      persSuffix: {
        type: Sequelize.STRING,
        allowNull: true
      },
      persNote: {
        type: Sequelize.STRING,
        allowNull: true
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

    await queryInterface.addConstraint('churchPeople', {
      fields: ['uniqueInstID', 'persID'],
      type: 'unique',
      name: 'unique_churchPerson_constraint'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('churchPeople');
  }
};