module.exports = app => {
    const controller = require('../controllers/institution.controller');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/network', controller.getAllInstitutionNetwork);
    router.get('/network/bipartite', controller.getBipartiteNetwork);
    router.get('/', controller.findAll);
    router.get('/:id', controller.findByID);
    router.get('/:id/network', controller.getPersonNetwork);
    router.get('/:id/dendrogram', controller.getDendrogramData);
    router.get('/:id/:year', controller.findOne);
    router.delete('/:id', controller.delete);
    app.use('/api/institution', router);
}