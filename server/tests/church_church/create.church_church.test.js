const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('CREATE methods for the ChurchChurch model', () => {

    afterAll( async () => {
        await requestWithSupertest.delete('/api/church_church/test-inst1/test-attendingInst1');
    });

    it('should create a new ChurchChurch', async () => {
        const res = await requestWithSupertest.post('/api/church_church')
            .send([{
                instID: 'test-inst1',
                attendingInstID: 'test-attendingInst1',
                year: 1870,
        }]);
        expect(res.status).toEqual(200);
        expect(res.body[0]).toHaveProperty('instID');
        expect(res.body[0]).toHaveProperty('instYear');
        expect(res.body[0]).toHaveProperty('attendingInstID');
        expect(res.body[0]).toHaveProperty('attendingInstYear');
        expect(res.body[0].instID).toEqual('test-inst1');
        expect(res.body[0].instYear).toEqual(1870);
        expect(res.body[0].attendingInstID).toEqual('test-attendingInst1');
        expect(res.body[0].attendingInstYear).toEqual(1870);
        expect(res.body[0]).toHaveProperty('createdAt');
        expect(res.body[0]).toHaveProperty('updatedAt');
    });

    it('should not create a new ChurchChurch with the same instID and instYear', async () => {
        const res = await requestWithSupertest.post('/api/church_church')
            .send([{
                instID: 'test-inst1',
                attendingInstID: 'test-attendingInst1',
                year: 1870,
        }]);
        expect(res.status).toEqual(500);
    });

    it('should create a new ChurchChurch with the same instYear and different instID', async () => {
        const res = await requestWithSupertest.post('/api/church_church')
            .send([{
                instID: 'test-inst2',
                attendingInstID: 'test-attendingInst1',
                year: 1870,
        }]);
    });

});