'use strict';

// Convert the data tables from latin1 (which MySQL treats as cp1252) to utf8mb4,
// so the database can store the FULL range of Unicode text that arrives from the
// external data source — not just the cp1252 subset. This is what was rejecting
// rows like the clergy role "Vicar‐General" (the "‐" is U+2010, a Unicode hyphen
// with no cp1252 representation), producing ER_TRUNCATED_WRONG_VALUE_FOR_FIELD.
//
// Existing rows are clean single-byte latin1 (verified: "Bécard" stored as
// …42 E9 63…, one byte per accent), so CONVERT TO CHARACTER SET re-encodes them
// losslessly — no mojibake.
//
// COLLATION CHOICE (important):
//  * Most tables use utf8mb4_unicode_ci — case-insensitive (the app searches with
//    bare `LIKE`, no LOWER(), so it depends on the column collation) and, as a
//    bonus, accent-insensitive so "Neraz" now matches "Néraz".
//  * `people` (an identity registry whose IDs are surname-derived, e.g.
//    `erh_gluck_001` vs `erh_glück_001`) uses utf8mb4_bin. unicode_ci is
//    accent-INsensitive and would collate those DISTINCT ids as equal, colliding
//    on the primary key (9 such pairs exist). bin keeps every byte-distinct id
//    distinct — matching the old latin1_swedish_ci behaviour. `people` has no
//    searchable text columns, so nothing is lost.
//  * personInAlmanacRecords.persID is a foreign key JOINed to people.ID (raw SQL
//    `WHERE pir.persID = person.ID` and the belongsTo(person) association), so it
//    must share people.ID's collation or MySQL throws "illegal mix of collations".
//    It's forced to utf8mb4_bin too; its text columns (name/role/title/…) stay
//    unicode_ci for case-insensitive search.
//
// Verified safe on MySQL 5.7.44 for this schema: innodb_large_prefix=ON,
// Barracuda, every table ROW_FORMAT=Dynamic; the widest index (relatedInstitutions'
// 3× varchar(255) unique key) is 3060 bytes in utf8mb4, under the 3072-byte limit.

const CI = 'utf8mb4_unicode_ci';   // searchable text (case- & accent-insensitive)
const BIN = 'utf8mb4_bin';         // exact identifiers (person ids)

async function selectTables(sequelize, sql, replacements) {
  return sequelize.query(sql, { type: sequelize.QueryTypes.SELECT, replacements });
}

module.exports = {
  async up (queryInterface) {
    const sequelize = queryInterface.sequelize;
    const dbName = sequelize.config.database;

    // Default new tables to utf8mb4.
    await sequelize.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET = utf8mb4 COLLATE = ${CI}`);

    // Convert every still-latin1 table EXCEPT people to the case-insensitive
    // collation. (Re-runnable: already-converted tables no longer match latin1%.)
    const tables = await selectTables(sequelize,
      `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
           AND TABLE_COLLATION LIKE 'latin1%' AND TABLE_NAME <> 'people'`);
    for (const { TABLE_NAME } of tables) {
      await sequelize.query(`ALTER TABLE \`${TABLE_NAME}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE ${CI}`);
    }

    // people: binary collation so ascii/accent id variants stay distinct.
    await sequelize.query(`ALTER TABLE \`people\` CONVERT TO CHARACTER SET utf8mb4 COLLATE ${BIN}`);

    // persID must match people.ID's collation for the person↔record JOINs.
    await sequelize.query(
      `ALTER TABLE \`personInAlmanacRecords\` MODIFY \`persID\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE ${BIN} NOT NULL`);
  },

  async down (queryInterface) {
    // Revert to latin1. NOTE: any characters written since the up-migration that
    // fall outside cp1252 (e.g. the U+2010 hyphen this migration was created to
    // allow) cannot be represented in latin1 and will be lost/replaced — inherent
    // to narrowing the charset.
    const sequelize = queryInterface.sequelize;
    const dbName = sequelize.config.database;

    const tables = await selectTables(sequelize,
      `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
           AND TABLE_COLLATION LIKE 'utf8mb4%'`);
    for (const { TABLE_NAME } of tables) {
      await sequelize.query(`ALTER TABLE \`${TABLE_NAME}\` CONVERT TO CHARACTER SET latin1 COLLATE latin1_swedish_ci`);
    }
    await sequelize.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET = latin1 COLLATE = latin1_swedish_ci`);
  }
};
