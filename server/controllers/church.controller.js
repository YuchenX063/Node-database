const db = require("../models");
const getPagination = require("../utils/get-pagination");
const Op = db.Sequelize.Op;

const Church = db.Church;
const Person = db.Person;
const Church_Person = db.Church_Person;
const Small_Church = db.Small_Church;

exports.create = (req, res) => {
    const churches = req.body;
    Church.bulkCreate(churches)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the Church."
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
    Church.findAndCountAll({
        where: where,
        limit: limit,
        offset: offset,
        attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
        include: [{
            model: Person,
            as: 'people',
            attributes: ['persID', 'persName', 'persYear', 'persSuffix', 'persNote'],
            through: {
                attributes: []
            }},{
                model: Small_Church,
                as: 'small_churches',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
            }
        }]
    }).then( data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving churches."
        });
    });
};

exports.findOne = (req, res) => {
    const id = req.params.instID;
    Church.findByPk(id, {
        attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
        include: [{
            model: Person,
            as: 'people',
            attributes: ['persID', 'persName', 'persYear', 'persSuffix', 'persNote'],
            through: {
                attributes: []
            }},{
                model: Small_Church,
                as: 'small_churches',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
            }
        }]
    }).then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot find Church with id=${id}.`
            });
        } else {
            res.send(data);
        }
    }).catch(err => {
        res.status(500).send({
            message: "Error retrieving Church with id=" + id
        });
    });
};

exports.delete = (req, res) => {
    const id = req.params.instID;
    Church.destroy({
        where: { instID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete Church with id=${id}. Maybe Church was not found!`
            });
        } else {
            res.send({
                message: "Church was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete Church with id=" + id
        });
    });
};