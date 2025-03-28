const db = require("../models");
const Op = db.Sequelize.Op;

const Church = db.Church;
const Person = db.Person;
const Church_Person = db.Church_Person;

exports.create = (req, res) => {
    const church_persons = req.body;
    Church_Person.bulkCreate(church_persons)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the Church_Person object."
        });
    });
};

exports.findAll = (req, res) => {
    Church_Person.findAll({
    }).then(data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving church_person objects."
        });
    });
};

exports.delete = (req, res) => {
    const instID = req.params.instID;
    const persID = req.params.persID;
    Church_Person.destroy({
        where: { instID: instID, persID: persID }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete Church_Person with id=${instID}. Maybe Church_Person was not found!`
            });
        } else {
            res.send({
                message: "Church_Person was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete Church_Person with id=" + instID
        });
    });
};