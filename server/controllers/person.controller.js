const { where } = require("sequelize");
const db = require("../models");
const Op = db.Sequelize.Op;

const getPagination = require("../utils/get-pagination");

const Church = db.Church;
const Person = db.Person;
const Church_Person = db.Church_Person;

exports.create = (req, res) => {
    const persons = req.body;

    const processedPersons = persons.map(person => {
        const uniquePersID = `${person.persYear}-${person.persID}`;
        return {
            ...person,
            uniquePersID: uniquePersID
        };});

    Person.bulkCreate(processedPersons)
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
    let {page, size} = req.query;
    if (!page) {
        page = 0;
    };
    if (!size) {
        size = 3;
    };
    let {limit, offset} = getPagination(page, size);
    let where = {};
    let { instName } = req.query;
    if (instName) {
        where.instName = { [Op.like]: `%${instName}%` };
    };
    Person.findAndCountAll({
        where: where,
        limit: limit,
        offset: offset,
        attributes: ['persID', 'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'],
        include: [
            {
                model: Church,
                as: 'churches',
                attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
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

exports.findByID = (req, res) => {
    const id = req.params.persID;
    Person.findAll({
        where: { persID: id },
        attributes: ['persID', 'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'],
        include: [
            {
                model: Church,
                as: 'churches',
                attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
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

exports.findOne = (req, res) => {
    const id = req.params.persID;
    Person.findOne({
        where: { persID: id, persYear: req.params.persYear },
        attributes: ['persID', 'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'],
        include: [
            {
                model: Church,
                as: 'churches',
                attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
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