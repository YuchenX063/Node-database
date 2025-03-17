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
      Church_Church.belongsTo(models.Church, { foreignKey: 'instID', as: 'small_church' });
    }
  }
  Church_Church.init({
    uniqueInstID: DataTypes.STRING,
    uniqueAttendingInstID: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Church_Church',
    indexes: [
      {
        unique: true,
        fields: ['uniqueInstID', 'uniqueAttendingInstID']
      }
    ]
  });
  return Church_Church;
};