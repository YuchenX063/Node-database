'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Church_Person extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Church_Person.belongsTo(models.Church, { foreignKey: 'instID', as: 'church'});
      Church_Person.belongsTo(models.Person, { foreignKey: 'persID', as: 'person'});
    }
  }
  Church_Person.init({
    instID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    instName: DataTypes.STRING,
    instYear: DataTypes.INTEGER,
    persID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    persName: DataTypes.STRING,
    persYear: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Church_Person',
    indexes: [
      {
        unique: true,
        fields: ['instID', 'persID', 'instYear', 'persYear']
      }
    ]
    }
  );
  return Church_Person;
};