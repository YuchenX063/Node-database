'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Church extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Church.belongsToMany(models.Person, { through: models.Church_Person, foreignKey: 'instID', as: 'people'});
      Church.belongsToMany(models.Small_Church, { through: models.Church_Church, foreignKey: 'instID', as: 'small_churches'});
    }
  }
  Church.init({
    instID: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    instName: DataTypes.STRING,
    instYear: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Church',
    indexes: [
      {
        unique: true,
        fields: ['instID', 'instYear']
      }
    ]
  });
  return Church;
};