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
      uniquePersID: {
        type: Sequelize.STRING,
        allowNull: false,
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
      fields: ['uniqueInstID', 'uniquePersID'],
      type: 'unique',
      name: 'unique_churchPerson_constraint'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('churchPeople');
  }
};