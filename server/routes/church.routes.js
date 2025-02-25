module.exports = app => {
    const controller = require('../controllers/church.controller');
    var router = require('express').Router();
    router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.get('/:instID', controller.findOne);
    router.delete('/:instID', controller.delete);
    app.use('/api/church', router);
}