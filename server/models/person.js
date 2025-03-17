'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Person extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Person.belongsToMany(models.Church, { through: models.Church_Person, foreignKey: 'uniquePersID', as: 'churches'});
    }
  }
  Person.init({
    uniquePersID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    persID: DataTypes.STRING,
    persName: DataTypes.STRING,
    persYear: DataTypes.INTEGER,
    persTitle: DataTypes.STRING,
    persSuffix: DataTypes.STRING,
    persNote: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Person',
  });
  return Person;
};