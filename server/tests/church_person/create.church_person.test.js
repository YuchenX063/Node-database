const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('CREATE methods for the ChurchPerson model', () => {

    afterAll( async() => {
        await requestWithSupertest.delete('/api/church_person/test-inst1/test-pers1');
    });

    it('should create a new ChurchPerson', async () => {
        const res = await requestWithSupertest.post('/api/church_person')
            .send([{
                instID: 'test-inst1',
                instName: 'test-church1',
                instYear: 1870,
                persID: 'test-pers1',
                persName: 'test-person1',
                persYear: 1870,
            }]);
        expect(res.status).toEqual(200);
        expect(res.body[0]).toHaveProperty('instID');
        expect(res.body[0]).toHaveProperty('instName');
        expect(res.body[0]).toHaveProperty('instYear');
        expect(res.body[0]).toHaveProperty('persID');
        expect(res.body[0]).toHaveProperty('persName');
        expect(res.body[0]).toHaveProperty('persYear');
        expect(res.body[0].instID).toEqual('test-inst1');
        expect(res.body[0].instName).toEqual('test-church1');
        expect(res.body[0].instYear).toEqual(1870);
        expect(res.body[0].persID).toEqual('test-pers1');
        expect(res.body[0].persName).toEqual('test-person1');
        expect(res.body[0].persYear).toEqual(1870);
        expect(res.body[0]).toHaveProperty('createdAt');
        expect(res.body[0]).toHaveProperty('updatedAt');
    });

    it('should not create a new ChurchPerson with the same instID and persID', async () => {
        const res = await requestWithSupertest.post('/api/church_person')
            .send([{
                instID: 'test-inst1',
                instName: 'test-church1',
                instYear: 1870,
                persID: 'test-pers1',
                persName: 'test-person1',
                persYear: 1870,
            }]);
        expect(res.status).toEqual(500);
    });

});