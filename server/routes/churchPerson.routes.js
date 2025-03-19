module.exports = app => {
    const controller = require('../controllers/churchPerson.controller');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.delete('/:instID/:persID', controller.delete);
    app.use('/api/churchPerson', router);
};