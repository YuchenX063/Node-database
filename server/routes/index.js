module.exports = app => {
    require('./person.routes.js')(app);
    require('./church.routes.js')(app);
    require('./church_person.routes.js')(app);
    require('./church_church.routes.js')(app);
};