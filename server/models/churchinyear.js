// church in a year

'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class churchInYear extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      churchInYear.belongsToMany(models.personInYear, { through: models.churchPerson, foreignKey: 'uniqueInstID', as: 'personInfo' });
      churchInYear.belongsToMany(models.churchInYear, { through: models.churchChurch, foreignKey: 'uniqueAttendingInstID', as: 'attendingChurches'});
      churchInYear.belongsToMany(models.churchInYear, { through: models.churchChurch, foreignKey: 'uniqueInstID', as: 'attendedBy'});
      churchInYear.belongsTo(models.church, { foreignKey: 'instID', as: 'church' });
    }
  }
  churchInYear.init({
    uniqueInstID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    instID: DataTypes.STRING,
    instName: DataTypes.STRING,
    church_type: DataTypes.STRING,
    language: DataTypes.STRING,
    instNote: {
      type: DataTypes.STRING(1024),
    },
    instYear: DataTypes.INTEGER,
    city_reg: DataTypes.STRING,
    state_orig: DataTypes.STRING,
    memberType: DataTypes.STRING,
    member: DataTypes.STRING,
    affiliated: DataTypes.STRING,
    diocese: DataTypes.STRING,
    attendingInstID: DataTypes.STRING,
    attendingChurch: DataTypes.STRING,
    attendingChurchFrequency: DataTypes.STRING,
    attendingChurchNote: DataTypes.STRING,
    uniqueAttendingInstID: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'churchInYear'
  });
  return churchInYear;
};