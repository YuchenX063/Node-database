'use strict';
const {
  Model
} = require('sequelize');
const { FOREIGNKEYS } = require('sequelize/lib/query-types');
module.exports = (sequelize, DataTypes) => {
  class Small_Church extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Small_Church.belongsToMany(models.Church, {through: 'Church_Churches', foreignKey: 'instID', as: 'attending_institutions'});
    }
  }
  Small_Church.init({
    instID: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    instName: DataTypes.STRING,
    instYear: DataTypes.INTEGER,
    attendingInstID: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Small_Church',
    indexes: [
      {
        unique: true,
        fields: ['instID', 'instYear']
      }
    ]
  });
  return Small_Church;
};