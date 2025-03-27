const db = require("../models");
const getPagination = require("../utils/get-pagination");
const Op = db.Sequelize.Op;

const churchInYear = db.churchInYear;
const person = db.person;
const churchPerson = db.churchPerson;
const church = db.church;
const personInYear = db.personInYear;

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

exports.findAll = async (req, res) => {
    try {
        let {page, size} = req.query;
        if (!page) {
            page = 0;
        };
        if (!size) {
            size = 3;
        };
        let {limit, offset} = getPagination(page, size);
        let where = {};
        let persWhere = {};
        let { instName, city_reg, diocese, instYear, persName } = req.query;
        if (instName) {
            where.instName = { [Op.like]: `%${instName}%` };
        };
        if (diocese) {
            where.diocese = { [Op.like]: `%${diocese}%` };
        };
        if (instYear) {
            where.instYear = { [Op.like]: `%${instYear}%` };
        };
        if (city_reg) {
            where.city_reg = { [Op.like]: `%${city_reg}%` };
        };
        if (persName) {
            persWhere.persName = { [Op.like]: `%${persName}%` };
        }
        //console.log('-----------where', where);
        const data = await church.findAndCountAll({
            limit: limit,
            offset: offset,
            distinct: true,
            attributes: ['instID'],
            include: [{
                model: churchInYear,
                as: 'churchInYear',
                where: where,
                attributes: ['instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese'],
                include: [{
                    model: churchInYear,
                    as: 'attendingChurches',
                    attributes: ['instID', 'instName', 'instYear'],
                    through: {
                        attributes: ['attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote']
                    }}, {
                    model: churchInYear,
                    as: 'attendedBy',
                    attributes: ['instID', 'instName', 'instYear'],
                    through: {
                        attributes: ['attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote']
                    }}
                    ,{
                    model: personInYear,
                    as: 'personInfo',
                    where: persWhere,
                    attributes: ['persID', 'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'],
                    through: {
                        model: churchPerson,
                        attributes: []
                    }
                }
    ]}]});
        /*if (data) {
            const personData = await person.findAll({
                attributes: ['persID'],
                include: [{
                    model: churchInYear,
                    where: where,
                    as: 'church',
                    attributes: ['uniqueInstID'], // one more redundant field
                    through:{
                        model: churchPerson,
                        where: persWhere,
                        attributes: ['persYear', 'persName', 'persTitle', 'persSuffix', 'persNote']
                    }
                }]
            });
            data.rows.forEach(churchRecord => {
                churchRecord.dataValues.personInfo = personData;
            });*/
            res.send(data);
        //} else {
        //    return res.status(404).json({ message: "No churches found." });
        //};

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
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
                    attributes: ['instID', 'instName', 'instYear', 'attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote'],
                    through: {
                        attributes: []
                }},{
                    model: personInYear,
                    as: 'personInfo',
                    attributes: ['persID', 'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'],
                    through: {
                        attributes: []
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

exports.findOne = async (req, res) => {
    try {
        const data = await churchInYear.findOne({
            where: { instID: req.params.instID, instYear: req.params.instYear },
            attributes: ['instID', 'instName', 'instYear', 'language', 'church_type', 'instNote', 'city_reg', 'state_orig', 'diocese', 'attendingInstID', 'attendingChurch', 'attendingChurchFrequency'],
            include: [{
                    model: churchInYear,
                    as: 'attendingChurches',
                    attributes: ['instID', 'instName', 'instYear'],
                    through: {
                        attributes: ['attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote']
                }},{
                    model: churchInYear,
                    as: 'attendedBy',
                    attributes: ['instID', 'instName', 'instYear', 'attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote'],
                    through: {
                        attributes: ['attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote']
                }},]
            });
        if (data) {
            const personData = await personInYear.findAll({
                attributes: ['persID', 'persName', 'persYear', 'persTitle', 'persSuffix', 'persNote'],
                include: [{
                    model: churchInYear,
                    where: { instID: req.params.instID, instYear: req.params.instYear },
                    attributes: [],
                    as: 'churches',
                    through: {
                        attributes:[]
                    }}]
            });
            data.dataValues.personInfo = personData;
        };
        res.send(data);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
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