module.exports = app => {
    require('./person.routes.js')(app);
    require('./church.routes.js')(app);
    require('./churchPerson.routes.js')(app);
    require('./churchChurch.routes.js')(app);
};