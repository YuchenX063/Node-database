const db = require("../models");
const Op = db.Sequelize.Op;

const Church = db.Church;
const Person = db.Person;
const Church_Person = db.Church_Person;
const Church_Church = db.Church_Church;

exports.create = (req, res) => {
    const church_churches = req.body;
    const processedChurch_Churches = church_churches.map(church_church => {
        const uniqueInstID = `${church_church.year}-${church_church.instID}`;
        const uniqueAttendingInstID = church_church.attendingInstID ? `${church_church.year}-${church_church.attendingInstID}` : null;
        delete church_church.year;
        return {
            ...church_church,
            uniqueInstID: uniqueInstID,
            uniqueAttendingInstID: uniqueAttendingInstID
        };
    });
    Church_Church.bulkCreate(processedChurch_Churches)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the Church_Church object."
        });
    });
};

exports.findAll = (req, res) => {
    Church_Church.findAll({
    }).then(data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving church_church objects."
        });
    });
};

exports.delete = (req, res) => {
    const instID = req.params.instID;
    const attendingInstID = req.params.attendingInstID;
    Church_Church.destroy({
        where: { instID: instID, attendingInstID: attendingInstID }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete Church_Church with id=${instID}. Maybe Church_Church was not found!`
            });
        } else {
            res.send({
                message: "Church_Church was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete Church_Church with id=" + instID
        });
    });
};