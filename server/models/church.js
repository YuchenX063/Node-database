// The "ground truth" (immutable property) of a church: instID

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class church extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      church.hasMany(models.churchInYear, { foreignKey: 'instID', as: 'churchInYear' });
    }
  }
  church.init({
    instID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'church',
  });
  return church;
};