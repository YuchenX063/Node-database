const { where } = require("sequelize");
const db = require("../models");
const Op = db.Sequelize.Op;

const Church = db.Church;
const Person = db.Person;
const Church_Person = db.Church_Person;

exports.create = (req, res) => {
    const persons = req.body;
    Person.bulkCreate(persons)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the Person."
        });
    });
};

exports.findAll = (req, res) => {
    Person.findAll({
        attributes: ['persID', 'persName', 'persYear'],
        include: [
            {
                model: Church,
                as: 'churches',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
                }
            }
        ]
    }).then(data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving people."
        });
    });
};

exports.findOne = (req, res) => {
    const id = req.params.persID;
    Person.findByPk(id, {
        attributes: ['persID', 'persName', 'persYear'],
        include: [
            {
                model: Church,
                as: 'churches',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
                }
            }
        ]
    }).then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot find Person with id=${id}.`
            });
        } else {
            res.send(data);
        }
    }).catch(err => {
        res.status(500).send({
            message: "Error retrieving Person with id=" + id
        });
    });
};

exports.delete = (req, res) => {
    const id = req.params.persID;
    Person.destroy({
        where: { persID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete Person with id=${id}. Maybe Person was not found!`
            });
        } else {
            res.send({
                message: "Person was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete Person with id=" + id
        });
    });
};