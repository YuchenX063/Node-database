const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('CREATE methods for the ChurchPerson model', () => {

    afterAll( async() => {
        await requestWithSupertest.delete('/api/churchPerson/test-inst1/test-pers1');
    });

    it('should create a new ChurchPerson', async () => {
        const res = await requestWithSupertest.post('/api/churchPerson')
            .send([{
                instID: 'test-inst1',
                persID: 'test-pers1',
                year: 1870
            }]);
        expect(res.status).toEqual(200);
        expect(res.body[0]).toHaveProperty('instID');
        expect(res.body[0]).toHaveProperty('persID');
        expect(res.body[0]).toHaveProperty('year');
        expect(res.body[0].instID).toEqual('test-inst1');
        expect(res.body[0].persID).toEqual('test-pers1');
        expect(res.body[0].year).toEqual(1870);
        expect(res.body[0]).toHaveProperty('createdAt');
        expect(res.body[0]).toHaveProperty('updatedAt');
    });

    it('should not create a new ChurchPerson with the same instID and persID', async () => {
        const res = await requestWithSupertest.post('/api/churchPerson')
            .send([{
                instID: 'test-inst1',
                persID: 'test-pers1',
                year: 1870
            }]);
        expect(res.status).toEqual(500);
    });

});