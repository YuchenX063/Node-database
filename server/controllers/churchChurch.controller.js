const db = require("../models");
const Op = db.Sequelize.Op;

const churchInYear = db.churchInYear;
const person = db.person;
const churchPerson = db.churchPerson;
const churchChurch = db.churchChurch;

/*exports.create = (req, res) => {
    const churchChurches = req.body;
    const processedchurchChurches = churchChurches.map(churchChurch => {
        const uniqueInstID = `${churchChurch.year}-${churchChurch.instID}`;
        const uniqueAttendingInstID = churchChurch.attendingInstID ? `${churchChurch.year}-${churchChurch.attendingInstID}` : null;
        delete churchChurch.year;
        return {
            ...churchChurch,
            uniqueInstID: uniqueInstID,
            uniqueAttendingInstID: uniqueAttendingInstID
        };
    });
    churchChurch.bulkCreate(processedchurchChurches)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the churchChurch object."
        });
    });
}; */

exports.findAll = (req, res) => {
    churchChurch.findAll({
    }).then(data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving churchChurch objects."
        });
    });
};

exports.delete = (req, res) => {
    const instID = req.params.instID;
    const attendingInstID = req.params.attendingInstID;
    churchChurch.destroy({
        where: { uniqueInstID: instID, uniqueAttendingInstID: attendingInstID }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete churchChurch with id=${instID}. Maybe churchChurch was not found!`
            });
        } else {
            res.send({
                message: "churchChurch was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete churchChurch with id=" + instID
        });
    });
};