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
      Church.belongsToMany(models.Small_Church, { through: models.Church_Church, foreignKey: 'attendingInstID', as: 'small_churches'});
      // the foreign key for Church should be "attendingInstID" rather than "instID"
    }
  }
  Church.init({
    instID: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    instName: DataTypes.STRING,
    church_type: DataTypes.STRING,
    language: DataTypes.STRING,
    instNote: DataTypes.STRING,
    instYear: DataTypes.INTEGER,
    city_reg: DataTypes.STRING,
    state_orig: DataTypes.STRING,
    memberType: DataTypes.STRING,
    member: DataTypes.STRING,
    affiliated: DataTypes.STRING,
    diocese: DataTypes.STRING,
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