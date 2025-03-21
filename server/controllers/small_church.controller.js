const db = require("../models");
const Op = db.Sequelize.Op;

const getPagination = require("../utils/get-pagination");

const Church = db.Church;
const Person = db.Person;
const Church_Person = db.Church_Person;
const Small_Church = db.Small_Church;  
const Church_Church = db.Church_Church;

exports.create = (req, res) => {
    const small_churches = req.body;
    Small_Church.bulkCreate(small_churches)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the Small Church."
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
    Small_Church.findAndCountAll({
        attributes: ['instID', 'instName', 'instYear', 'language', 'instNote', 'city_reg', 'state_orig', 'diocese', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency'],
        include: [
            {
                model: Church,
                as: 'attending_institutions',
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
            message: err.message || "An error occurred while retrieving small churches."
        });
    });
};

exports.findOne = (req, res) => {
    const id = req.params.instID;
    Small_Church.findByPk(id, {
        attributes: ['instID', 'instName', 'instYear', 'language', 'instNote', 'city_reg', 'state_orig', 'diocese', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency'],
        include: [
            {
                model: Church,
                as: 'attending_institutions',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
                }
            }
        ]
    }).then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot find Small Church with id=${id}.`
            });
        } else {
            res.send(data);
        }
    }).catch(err => {
        res.status(500).send({
            message: "Error retrieving Small Church with id=" + id
        });
    });
};

exports.delete = (req, res) => {
    const id = req.params.instID;
    Small_Church.destroy({
        where: { instID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete Small Church with id=${id}. Maybe Small Church was not found!`
            });
        } else {
            res.send({
                message: "Small Church was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete Small Church with id=" + id
        });
    });
};