// person in a year (and in a church)

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class churchPerson extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      churchPerson.belongsTo(models.churchInYear, { foreignKey: 'uniqueInstID', as: 'church'});
      churchPerson.belongsTo(models.person, { foreignKey: 'persID', as: 'person'});
    }
  }
  churchPerson.init({
    uniqueInstID: DataTypes.STRING,
    persID: DataTypes.STRING,
    persName: DataTypes.STRING,
    persYear: DataTypes.INTEGER,
    persTitle: DataTypes.STRING,
    persSuffix: DataTypes.STRING,
    persNote: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'churchPerson',
    indexes: [
      {
        unique: true,
        fields: ['uniqueInstID', 'persID']
      }
    ]
    }
  );
  return churchPerson;
};