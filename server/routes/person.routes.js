module.exports = app => {
    const controller = require('../controllers/person.controller');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.get('/network', controller.getAllPersonNetwork);
    router.get('/:id', controller.findByID);
    router.get('/:id/network', controller.getPersonNetwork);
    router.get('/:id/:year', controller.findOne);
    router.delete('/:id', controller.delete);
    app.use('/api/person', router);
}