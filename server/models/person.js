// The unique identifier for a person across all churches: persID

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class person extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      person.belongsToMany(models.churchInYear, { through: models.churchPerson, foreignKey: 'persID', as: 'church' });
    }
  }
  person.init({
    persID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'person',
  });
  return person;
};