const db = require("../models");
const getPagination = require("../utils/get-pagination");
const Op = db.Sequelize.Op;

const churchInYear = db.churchInYear;
const person = db.person;
const churchPerson = db.churchPerson;
const church = db.church;

/*exports.create = (req, res) => {
    const churches = req.body;

    const processedChurches = churches.map(church => {
        const uniqueInstID = `${church.instYear}-${church.instID}`;
        const uniqueAttendingInstID = church.uniqueAttendingInstID ? `${church.instYear}-${church.attendingInstID}` : null;
        return {
            ...church,
            uniqueInstID: uniqueInstID,
            uniqueAttendingInstID: uniqueAttendingInstID
        }});

    churchInYear.bulkCreate(processedChurches)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the churchInYear."
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
    let where = {};
    //let { instName } = req.query;
    //if (instName) {
    //    where.instName = { [Op.like]: `%${instName}%` };
    //};
    church.findAndCountAll({
        where: where,
        limit: limit,
        offset: offset,
        attributes: ['instID'],
        include: [{
            model: churchInYear,
            as: 'churchInYear',
            attributes: ['instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
            include: [{
                model: person,
                as: 'personInfo',
                attributes: ['persID'],
                through: {
                    attributes: [
                        'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'
                    ]
                }}, {
                model: churchInYear,
                as: 'attendingChurches',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
                }}, {
                model: churchInYear,
                as: 'attendedBy',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
                }}]
        }]
        
    }).then( data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving churches."
        });
    });
};

exports.findByID = (req, res) => {
    const id = req.params.instID;
    church.findOne({
        where: { instID: id },
        attributes: ['instID'],
        include: [{
                model: churchInYear,
                as: 'churchInYear',
                attributes: ['instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
                include: [{
                    model: churchInYear,
                    as: 'attendingChurches',
                    attributes: ['instID', 'instName', 'instYear'],
                    through: {
                        attributes: []
                }},{
                    model: churchInYear,
                    as: 'attendedBy',
                    attributes: ['instID', 'instName', 'instYear'],
                    through: {
                        attributes: []
                }},{
                    model: person,
                    as: 'personInfo',
                    attributes: ['persID'],
                    through: {
                        attributes: [
                            'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'
                        ]
                }}]
        }]
    }).then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot find churchInYear with id=${id}.`
            });
        } else {
            res.send(data);
        }
    }).catch(err => {
        res.status(500).send({
            message: "Error retrieving churchInYear with id=" + id
        });
    });
};

exports.findOne = (req, res) => {
    const id = req.params.instID;
    churchInYear.findOne({
        where: { instID: id, instYear: req.params.instYear },
        attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency'],
        include: [{
                model: churchInYear,
                as: 'attendingChurches',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
            }},{
                model: churchInYear,
                as: 'attendedBy',
                attributes: ['instID', 'instName', 'instYear'],
                through: {
                    attributes: []
            }},{
                model: person,
                as: 'personInfo',
                attributes: ['persID'],
                through: {
                    attributes: [
                        'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'
                    ]
            }
        }]
    }).then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot find churchInYear with id=${id}.`
            });
        } else {
            res.send(data);
        }
    }).catch(err => {
        res.status(500).send({
            message: "Error retrieving churchInYear with id=" + id
        });
    });
};

exports.delete = (req, res) => {
    const id = req.params.instID;
    church.destroy({
        where: { instID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete churchInYear with id=${id}. Maybe churchInYear was not found!`
            });
        } else {
            res.send({
                message: "churchInYear was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete churchInYear with id=" + id
        });
    });
};