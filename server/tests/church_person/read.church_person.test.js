const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('The relationship between church and person', () => {

    // create church, person, and church_person
    beforeAll( async () => {
        const res = await requestWithSupertest.post('/api/church')
            .send([{
                instID: 'test-inst1',
                instName: 'test-church1',
                instYear: 1870
        }]);
        expect(res.status).toEqual(200);
        const res2 = await requestWithSupertest.post('/api/person')
            .send([{
                persID: 'test-pers1',
                persName: 'test-person1',
                persYear: 1870,
                persTitle: 'test-title1'
        }]);
        expect(res2.status).toEqual(200);
        const res3 = await requestWithSupertest.post('/api/church_person')
            .send([{
                instID: 'test-inst1',
                persID: 'test-pers1',
                year: 1870
        }]);
        expect(res3.status).toEqual(200);
        const res4 = await requestWithSupertest.post('/api/church')
            .send([{
                instID: 'test-inst2',
                instName: 'test-church2',
                instYear: 1870
        }]);
        expect(res4.status).toEqual(200);
        const res5 = await requestWithSupertest.post('/api/person')
            .send([{
                persID: 'test-pers2',
                persName: 'test-person2',
                persYear: 1870,
                persTitle: 'test-title2'
        }]);
        expect(res5.status).toEqual(200);
    });

    afterAll( async () => {
        await requestWithSupertest.delete('/api/church/test-inst1');
        await requestWithSupertest.delete('/api/person/test-pers1');
        await requestWithSupertest.delete('/api/church_person/test-inst1/test-pers1');
        await requestWithSupertest.delete('/api/church/test-inst2');
        await requestWithSupertest.delete('/api/person/test-pers2');
    });

    it('should get a church through a person', async () => {
        const res = await requestWithSupertest.get('/api/person/test-pers1');
        //console.log(res.body);
        const temp = await requestWithSupertest.get('/api/church/test-inst1');
        //console.log(temp.body);
        const t = await requestWithSupertest.get('/api/church_person');
        //console.log(t.body);
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('persID');
        expect(res.body).toHaveProperty('persName');
        expect(res.body).toHaveProperty('persYear');
        expect(res.body).toHaveProperty('persTitle');
        expect(res.body.persID).toEqual('test-pers1');
        expect(res.body.persName).toEqual('test-person1');
        expect(res.body.persYear).toEqual(1870);
        expect(res.body.persTitle).toEqual('test-title1');
        expect(res.body).toHaveProperty('churches');
        expect(res.body.churches).toBeInstanceOf(Array);
        expect(res.body.churches[0]).toHaveProperty('instID');
        expect(res.body.churches[0]).toHaveProperty('instName');
        expect(res.body.churches[0]).toHaveProperty('instYear');
        expect(res.body.churches[0].instID).toEqual('test-inst1');
        expect(res.body.churches[0].instName).toEqual('test-church1');
        expect(res.body.churches[0].instYear).toEqual(1870);
    });

    it('should get a person through a church', async () => {
        const res = await requestWithSupertest.get('/api/church/test-inst1');
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('instID');
        expect(res.body).toHaveProperty('instName');
        expect(res.body).toHaveProperty('instYear');
        expect(res.body.instID).toEqual('test-inst1');
        expect(res.body.instName).toEqual('test-church1');
        expect(res.body.instYear).toEqual(1870);
        expect(res.body).toHaveProperty('people');
        expect(res.body.people).toBeInstanceOf(Array);
        expect(res.body.people[0]).toHaveProperty('persID');
        expect(res.body.people[0]).toHaveProperty('persName');
        expect(res.body.people[0]).toHaveProperty('persYear');
        expect(res.body.people[0].persID).toEqual('test-pers1');
        expect(res.body.people[0].persName).toEqual('test-person1');
        expect(res.body.people[0].persYear).toEqual(1870);
    });

    it('should not get a church through a person if the church is not related', async () => {
        const res = await requestWithSupertest.get('/api/person/test-pers2');
        expect(res.status).toEqual(200);
        expect(res.body.churches).toBeInstanceOf(Array);
        expect(res.body.churches.length).toEqual(0);
    });

    it('should not get a person through a church if the person is not related', async () => {
        const res = await requestWithSupertest.get('/api/church/test-inst2');
        expect(res.status).toEqual(200);
        expect(res.body.people).toBeInstanceOf(Array);
        expect(res.body.people.length).toEqual(0);
    });

});