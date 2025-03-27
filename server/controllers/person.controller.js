const { where } = require("sequelize");
const db = require("../models");
const Op = db.Sequelize.Op;

const getPagination = require("../utils/get-pagination");

const churchInYear = db.churchInYear;
const churchPerson = db.churchPerson;
const person = db.person;
const personInYear = db.personInYear;

/*exports.create = (req, res) => {
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
};*/

exports.findAll = (req, res) => {
    let {page, size} = req.query;
    if (!page) {
        page = 0;
    };
    if (!size) {
        size = 3;
    };
    let {limit, offset} = getPagination(page, size);
    let persWhere = {};
    let instWhere = {};
    let { persName, instName, diocese } = req.query;
    if (persName) {
        where.persName = { [Op.like]: `%${persName}%` };
    };
    if (instName) {
        instWhere.instName = { [Op.like]: `%${instName}%` };
    };
    if (diocese) {
        instWhere.diocese = { [Op.like]: `%${diocese}%` };
    }
    person.findAndCountAll({
        limit: limit,
        offset: offset,
        distinct: true,
        attributes: ['persID'],
        include: [
            {
                model: personInYear,
                where: persWhere,
                as: 'personInYear',
                attributes: ['persYear', 'persName', 'persTitle', 'persSuffix', 'persNote'],
                include: [
                    {
                        model: churchInYear,
                        where: instWhere,
                        as: 'churches',
                        attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
                        through: {
                            model: churchPerson,
                            attributes: []
                        }
                    }
                ]
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
    person.findAll({
        where: { persID: id },
        attributes: ['persID'],
        include: [
            {
                model: personInYear,
                as: 'personInYear',
                attributes: ['persYear', 'persName', 'persTitle', 'persSuffix', 'persNote'],
                include: [{
                    model: churchInYear,
                    as: 'churches',
                    attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
                    through: {
                        model: churchPerson,
                        attributes: []
                    }}]
            }]
            }
    ).then(data => {
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
    personInYear.findOne({
        where: { persID: req.params.persID, persYear: req.params.persYear },
        attributes: ['persID', 'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'],
        include: [
            {
                model: churchInYear,
                as: 'churches',
                attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
                through: {
                    model: churchPerson,
                    attributes: []
            }}
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
    person.destroy({
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