'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Church_People', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      instID: {
        type: Sequelize.STRING,
      },
      instName: {
        type: Sequelize.STRING
      },
      instYear: {
        type: Sequelize.INTEGER
      },
      persID: {
        type: Sequelize.STRING,
      },
      persName: {
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

    await queryInterface.addConstraint('Church_People', {
      fields: ['instID', 'persID', 'instYear', 'persYear'],
      type: 'unique',
      name: 'unique_church_person'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Church_People');
  }
};