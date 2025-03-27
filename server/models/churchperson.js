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
      churchPerson.belongsTo(models.personInYear, { foreignKey: 'uniquePersID', as: 'person'});
    }
  }
  churchPerson.init({
    uniqueInstID: DataTypes.STRING,
    uniquePersID: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'churchPerson',
    indexes: [
      {
        unique: true,
        fields: ['uniqueInstID', 'uniquePersID']
      }
    ]
    }
  );
  return churchPerson;
};