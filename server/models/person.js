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
      Person.belongsToMany(models.Church, { through: models.Church_Person, foreignKey: 'persID', as: 'churches'});
    }
  }
  Person.init({
    persID: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    persName: DataTypes.STRING,
    persYear: DataTypes.INTEGER,
    persTitle: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Person',
    indexes: [
      {
        unique: true,
        fields: ['persID', 'persYear']
      }
    ]
  });
  return Person;
};