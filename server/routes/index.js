module.exports = app => {
    require('./person.routes.js')(app);
    require('./institution.routes.js')(app);
    require('./export.routes.js')(app);
    require('./churchPerson.routes.js')(app);
    require('./churchChurch.routes.js')(app);
    require('./maps.routes.js')(app);
    require('./searchAll.routes.js')(app);
    require('./dioceseInfo.routes.js')(app);
    require('./getFileDate.routes.js')(app);
    require('./stats.routes.js')(app);
};