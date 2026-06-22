module.exports = app => {
    const controller = require('../controllers/stats.controller');
    var router = require('express').Router();
    router.get('/composition', controller.getComposition);
    router.get('/subset-vs-whole', controller.getSubsetVsWhole);
    app.use('/api/stats', router);
}
