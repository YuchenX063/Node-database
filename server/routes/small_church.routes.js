module.exports = app => {
    const controller = require('../controllers/small_church.controller');
    var router = require('express').Router();
    router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.get('/:instID', controller.findOne);
    router.delete('/:instID', controller.delete);
    app.use('/api/small_church', router);
};