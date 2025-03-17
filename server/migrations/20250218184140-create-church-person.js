'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Church_People', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      uniqueInstID: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      uniquePersID: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
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

    await queryInterface.addConstraint('Church_People', {
      fields: ['uniqueInstID', 'uniquePersID'],
      type: 'unique',
      name: 'unique_church_person_constraint'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Church_People');
  }
};