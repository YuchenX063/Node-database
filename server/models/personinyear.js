'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class personInYear extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      personInYear.belongsTo(models.person, {foreignKey: 'persID', as: 'person'});
      personInYear.belongsToMany(models.churchInYear, { through: models.churchPerson, foreignKey: 'uniquePersID', as: 'churches' });
    }
  }
  personInYear.init({
    persID: DataTypes.STRING,
    uniquePersID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    persName: DataTypes.STRING,
    persNote: DataTypes.STRING,
    persTitle: DataTypes.STRING,
    persSuffix: DataTypes.STRING,
    persYear: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'personInYear',
  });
  return personInYear;
};