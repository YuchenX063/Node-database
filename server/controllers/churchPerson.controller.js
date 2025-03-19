const db = require("../models");
const Op = db.Sequelize.Op;

const churchPerson = db.churchPerson;

/*exports.create = (req, res) => {
    const personInfo = req.body;
    const processedchurchPersons = personInfo.map(churchPerson => {
        const uniqueInstID = `${churchPerson.year}-${churchPerson.instID}`;
        const uniquePersID = `${churchPerson.year}-${churchPerson.persID}`;
        delete churchPerson.year;
        return {
            ...churchPerson,
            uniqueInstID: uniqueInstID,
            uniquePersID: uniquePersID
        };});

    churchPerson.bulkCreate(processedchurchPersons)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the churchPerson object."
        });
    });
};*/

exports.findAll = (req, res) => {
    churchPerson.findAll({
    }).then(data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving churchPerson objects."
        });
    });
};

exports.delete = (req, res) => {
    const instID = req.params.instID;
    const persID = req.params.persID;
    churchPerson.destroy({
        where: { uniqueInstID: instID, persID: persID }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete churchPerson with id=${instID}. Maybe churchPerson was not found!`
            });
        } else {
            res.send({
                message: "churchPerson was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete churchPerson with id=" + instID
        });
    });
};