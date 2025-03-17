'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Church_Person extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Church_Person.belongsTo(models.Church, { foreignKey: 'uniqueInstID', as: 'church'});
      Church_Person.belongsTo(models.Person, { foreignKey: 'uniquePersID', as: 'person'});
    }
  }
  Church_Person.init({
    uniqueInstID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uniquePersID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'Church_Person',
    indexes: [
      {
        unique: true,
        fields: ['uniqueInstID', 'uniquePersID']
      }
    ]
    }
  );
  return Church_Person;
};