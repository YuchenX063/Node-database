'use strict';

// Widen almanacRecords.instNote from VARCHAR(1024) to TEXT.
//
// The model (models/almanacRecord.js) already declares `instNote: DataTypes.TEXT`,
// but the original create migration made the column `STRING(1024)` and no
// migration ever caught the DB up — a schema/model drift. Under strict sql_mode,
// any imported note longer than 1024 chars (some run 1200–2900: e.g. the 1839
// Burlington church-fire account, the Notre-Dame "Holy Cross" descriptions) makes
// the whole almanacRecord INSERT fail with ER_DATA_TOO_LONG, so those
// institution-years never land in the DB. TEXT (~65 KB) matches the model and
// holds these comfortably. (`member` is already MEDIUMTEXT; instNote was the only
// under-sized narrative column.)

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.changeColumn('almanacRecords', 'instNote', {
      type: Sequelize.TEXT,          // inherits the table's utf8mb4 charset
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    // Revert to the original width. NOTE: if any stored note exceeds 1024 chars
    // this will error under strict mode (narrowing is inherently lossy).
    await queryInterface.changeColumn('almanacRecords', 'instNote', {
      type: Sequelize.STRING(1024),
      allowNull: true
    });
  }
};
