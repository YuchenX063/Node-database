const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('GET methods for the SmallChurch model', () => {

    beforeAll( async () => {
        const res = await requestWithSupertest.post('/api/small_church')
            .send([{
                instID: 'test-small_church1',
                instName: 'test-small_church1',
                instYear: 1870,
                attendingInstID: 'test-inst1'
        }]);
        expect(res.status).toEqual(200);
    });

    afterAll( async () => {
        await requestWithSupertest.delete('/api/small_church/test-small_church1');
    });

    it('should get all SmallChurches', async () => {
        const res = await requestWithSupertest.get('/api/small_church');
        expect(res.status).toEqual(200);
        expect(res.body.rows).toBeInstanceOf(Array);
        if (res.body.rows.length > 0) {
            expect(res.body.rows[0]).toHaveProperty('instID');
            expect(res.body.rows[0]).toHaveProperty('instName');
            expect(res.body.rows[0]).toHaveProperty('instYear');
            expect(res.body.rows[0]).toHaveProperty('attendingInstID');
        }
    });

    it('should get a SmallChurch by instID', async () => {
        const res = await requestWithSupertest.get('/api/small_church/test-small_church1');
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('instID');
        expect(res.body).toHaveProperty('instName');
        expect(res.body).toHaveProperty('instYear');
        expect(res.body).toHaveProperty('attendingInstID');
        expect(res.body.instID).toEqual('test-small_church1');
        expect(res.body.instName).toEqual('test-small_church1');
        expect(res.body.instYear).toEqual(1870);
        expect(res.body.attendingInstID).toEqual('test-inst1');
    });

});