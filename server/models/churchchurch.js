//churchChurch middle table

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class churchChurch extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      churchChurch.belongsTo(models.churchInYear, { foreignKey: 'uniqueAttendingInstID', as: 'church'});
      churchChurch.belongsTo(models.churchInYear, { foreignKey: 'uniqueInstID', as: 'small_church' });
    }
  }
  churchChurch.init({
    uniqueInstID: DataTypes.STRING,
    uniqueAttendingInstID: DataTypes.STRING,
    attendingChurch: DataTypes.STRING,
    attendingChurchFrequency: DataTypes.STRING,
    attendingChurchNote: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'churchChurch',
    indexes: [
      {
        unique: true,
        fields: ['uniqueInstID', 'uniqueAttendingInstID']
      }
    ]
  });
  return churchChurch;
};