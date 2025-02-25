module.exports = app => {
    const controller = require('../controllers/church_person.controller');
    var router = require('express').Router();
    router.post('/', controller.create);
    router.get('/', controller.findAll);
    router.delete('/:id', controller.delete);
    app.use('/api/church_person', router);
};