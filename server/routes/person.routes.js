module.exports = app => {
    const controller = require('../controllers/person.controller');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.get('/:persID', controller.findByID);
    router.get('/:persID/:persYear', controller.findOne);
    router.delete('/:persID', controller.delete);
    app.use('/api/person', router);
}