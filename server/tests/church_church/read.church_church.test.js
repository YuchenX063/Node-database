const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('The relationship between church and small_church', () => {

    // create church, small church, and church_church
    beforeAll( async () => {
        const res = await requestWithSupertest.post('/api/church')
            .send([{
                instID: 'test-inst1',
                instName: 'test-church1',
                instYear: 1870
        }]);
        expect(res.status).toEqual(200);
        const res2 = await requestWithSupertest.post('/api/small_church')
            .send([{
                instID: 'test-small_church1',
                instName: 'test-small_church1',
                instYear: 1870,
                attendingInstID: 'test-inst1'
        }]);
        expect(res2.status).toEqual(200);
        const res3 = await requestWithSupertest.post('/api/church_church')
            .send([{
                instID: 'test-small_church1',
                instYear: 1870,
                attendingInstID: 'test-inst1',
                attendingInstYear: 1870
        }]);
        expect(res3.status).toEqual(200);
        const res4 = await requestWithSupertest.post('/api/church')
            .send([{
                instID: 'test-inst2',
                instName: 'test-church2',
                instYear: 1870
        }]);
        expect(res4.status).toEqual(200);
        const res5 = await requestWithSupertest.post('/api/small_church')
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
        await requestWithSupertest.delete('/api/small_church/test-small_church1');
        await requestWithSupertest.delete('/api/church_church/test-inst1/test-small_church1');
        await requestWithSupertest.delete('/api/church/test-inst2');
        await requestWithSupertest.delete('/api/small_church/test-small_church2');
    });

    it('should get a church through a small church', async () => {
        const res = await requestWithSupertest.get('/api/small_church/test-small_church1');
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('instID');
        expect(res.body).toHaveProperty('instYear');
        expect(res.body).toHaveProperty('attendingInstID');
        expect(res.body.instID).toEqual('test-small_church1');
        expect(res.body.instYear).toEqual(1870);
        expect(res.body.attendingInstID).toEqual('test-inst1');
        expect(res.body).toHaveProperty('attending_institutions');
        expect(res.body.attending_institutions).toBeInstanceOf(Array);
        expect(res.body.attending_institutions[0]).toHaveProperty('instID');
        expect(res.body.attending_institutions[0]).toHaveProperty('instName');
        expect(res.body.attending_institutions[0]).toHaveProperty('instYear');
        expect(res.body.attending_institutions[0].instID).toEqual('test-inst1');
        expect(res.body.attending_institutions[0].instName).toEqual('test-church1');
        expect(res.body.attending_institutions[0].instYear).toEqual(1870);
    });

    it('should get a small church through a church', async () => {
        const res = await requestWithSupertest.get('/api/church/test-inst1');
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('instID');
        expect(res.body).toHaveProperty('instYear');
        expect(res.body.instID).toEqual('test-inst1');
        expect(res.body.instYear).toEqual(1870);
        expect(res.body).toHaveProperty('small_churches');
        expect(res.body.small_churches).toBeInstanceOf(Array);
        expect(res.body.small_churches[0]).toHaveProperty('instID');
        expect(res.body.small_churches[0]).toHaveProperty('instName');
        expect(res.body.small_churches[0]).toHaveProperty('instYear');
        expect(res.body.small_churches[0].instID).toEqual('test-small_church1');
        expect(res.body.small_churches[0].instName).toEqual('test-small_church1');
        expect(res.body.small_churches[0].instYear).toEqual(1870);
    });

    it('should not get a church through a small church if the church is not related', async () => {
        const res = await requestWithSupertest.get('/api/small_church/test-small_church2');
        expect(res.status).toEqual(200);
        expect(res.body.attending_institutions).toBeInstanceOf(Array);
        expect(res.body.attending_institutions.length).toEqual(0);
    });

    it('should not get a small church through a church if the small church is not related', async () => {
        const res = await requestWithSupertest.get('/api/church/test-inst2');
        expect(res.status).toEqual(200);
        expect(res.body.small_churches).toBeInstanceOf(Array);
        expect(res.body.small_churches.length).toEqual(0);
    });

});