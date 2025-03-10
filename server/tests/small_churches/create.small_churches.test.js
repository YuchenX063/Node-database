const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('CREATE methods for the SmallChurch model', () => {

    afterAll( async () => {
        await requestWithSupertest.delete('/api/small_church/test-small_church1');
    });

    it('should create a new SmallChurch', async () => {
        const res = await requestWithSupertest.post('/api/small_church')
            .send([{
                instID: 'test-small_church1',
                instName: 'test-small_church1',
                instYear: 1870,
                attendingInstID: 'test-inst1'
        }]);
        expect(res.status).toEqual(200);
        expect(res.body[0]).toHaveProperty('instID');
        expect(res.body[0]).toHaveProperty('instName');
        expect(res.body[0]).toHaveProperty('instYear');
        expect(res.body[0]).toHaveProperty('attendingInstID');
        expect(res.body[0].instID).toEqual('test-small_church1');
        expect(res.body[0].instName).toEqual('test-small_church1');
        expect(res.body[0].instYear).toEqual(1870);
        expect(res.body[0].attendingInstID).toEqual('test-inst1');
        expect(res.body[0]).toHaveProperty('createdAt');
        expect(res.body[0]).toHaveProperty('updatedAt');
    });

    it('should not create a new SmallChurch with the same instID and instYear', async () => {
        const res = await requestWithSupertest.post('/api/small_church')
            .send([{
                instID: 'test-small_church1',
                instName: 'test-small_church1',
                instYear: 1870,
                attendingInstID: 'test-inst1'
        }]);
        expect(res.status).toEqual(500);
    });

});