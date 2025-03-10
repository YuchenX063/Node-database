'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Church_Church extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Church_Church.belongsTo(models.Church, { foreignKey: 'attendingInstID', as: 'church'});
      Church_Church.belongsTo(models.Small_Church, { foreignKey: 'instID', as: 'small_church' });
    }
  }
  Church_Church.init({
    instID: DataTypes.STRING,
    instYear: DataTypes.INTEGER,
    attendingInstID: DataTypes.STRING,
    attendingInstYear: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Church_Church',
    indexes: [
      {
        unique: true,
        fields: ['instID', 'instYear', 'attendingInstID', 'attendingInstYear']
      }
    ]
  });
  return Church_Church;
};