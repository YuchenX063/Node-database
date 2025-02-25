module.exports = app => {
    const controller = require('../controllers/small_church.controller');
    var router = require('express').Router();
    router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.delete('/:id', controller.delete);
    app.use('/api/small_church', router);
};