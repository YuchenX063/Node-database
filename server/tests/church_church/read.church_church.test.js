const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('The relationship between church and small_church', () => {

    // create church, small church, and churchChurch
    beforeAll( async () => {
        const res = await requestWithSupertest.post('/api/church')
            .send([{
                instID: 'test-inst1',
                instName: 'test-church1',
                instYear: 1870
        }]);
        expect(res.status).toEqual(200);
        const res2 = await requestWithSupertest.post('/api/church')
            .send([{
                instID: 'test-small_church1',
                instName: 'test-small_church1',
                instYear: 1870,
                attendingInstID: 'test-inst1'
        }]);
        expect(res2.status).toEqual(200);
        const res3 = await requestWithSupertest.post('/api/churchChurch')
            .send([{
                instID: 'test-small_church1',
                attendingInstID: 'test-inst1',
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
        const res5 = await requestWithSupertest.post('/api/church')
            .send([{
                instID: 'test-small_church2',
                instName: 'test-small_church2',
                instYear: 1870,
                attendingInstID: 'test-inst2'
        }]);
        expect(res5.status).toEqual(200);
    });

    afterAll( async () => {
        await requestWithSupertest.delete('/api/church/test-inst1');
        await requestWithSupertest.delete('/api/church/test-small_church1');
        await requestWithSupertest.delete('/api/churchChurch/test-inst1/test-small_church1');
        await requestWithSupertest.delete('/api/church/test-inst2');
        await requestWithSupertest.delete('/api/church/test-small_church2');
    });

    it('should get a church through a small church', async () => {
        const res = await requestWithSupertest.get('/api/church/test-small_church1');
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('instID');
        expect(res.body).toHaveProperty('instYear');
        expect(res.body).toHaveProperty('attendingInstID');
        expect(res.body.instID).toEqual('test-small_church1');
        expect(res.body.instYear).toEqual(1870);
        expect(res.body.attendingInstID).toEqual('test-inst1');
        expect(res.body).toHaveProperty('attendedBy');
        expect(res.body.attendedBy).toBeInstanceOf(Array);
        expect(res.body.attendedBy[0]).toHaveProperty('instID');
        expect(res.body.attendedBy[0]).toHaveProperty('instName');
        expect(res.body.attendedBy[0]).toHaveProperty('instYear');
        expect(res.body.attendedBy[0].instID).toEqual('test-inst1');
        expect(res.body.attendedBy[0].instName).toEqual('test-church1');
        expect(res.body.attendedBy[0].instYear).toEqual(1870);
    });

    it('should get a small church through a church', async () => {
        const res = await requestWithSupertest.get('/api/church/test-inst1');
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('instID');
        expect(res.body).toHaveProperty('instYear');
        expect(res.body.instID).toEqual('test-inst1');
        expect(res.body.instYear).toEqual(1870);
        expect(res.body).toHaveProperty('attendingChurches');
        expect(res.body.attendingChurches).toBeInstanceOf(Array);
        expect(res.body.attendingChurches[0]).toHaveProperty('instID');
        expect(res.body.attendingChurches[0]).toHaveProperty('instName');
        expect(res.body.attendingChurches[0]).toHaveProperty('instYear');
        expect(res.body.attendingChurches[0].instID).toEqual('test-small_church1');
        expect(res.body.attendingChurches[0].instName).toEqual('test-small_church1');
        expect(res.body.attendingChurches[0].instYear).toEqual(1870);
    });

    it('should not get a church through a small church if the church is not related', async () => {
        const res = await requestWithSupertest.get('/api/church/test-small_church2');
        expect(res.status).toEqual(200);
        expect(res.body.attendedBy).toBeInstanceOf(Array);
        expect(res.body.attendedBy.length).toEqual(0);
    });

    it('should not get a small church through a church if the small church is not related', async () => {
        const res = await requestWithSupertest.get('/api/church/test-inst2');
        expect(res.status).toEqual(200);
        expect(res.body.attendingChurches).toBeInstanceOf(Array);
        expect(res.body.attendingChurches.length).toEqual(0);
    });

});