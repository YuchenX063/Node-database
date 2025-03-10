module.exports = app => {
    const controller = require('../controllers/church_church.controller');
    var router = require('express').Router();
    router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.delete('/:instID/:attendingInstID', controller.delete);
    app.use('/api/church_church', router);
};