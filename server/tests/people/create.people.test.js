const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('CREATE methods for the People model', () => {

    afterAll( async() => {
        await requestWithSupertest.delete('/api/person/test-pers1');
    } );

    it('should create a new Person', async () => {
        const res = await requestWithSupertest.post('/api/person')
            .send([{
                persID: 'test-pers1',
                persName: 'test-person1',
                persYear: 1870,
                persTitle: 'test-title1'
        }]);
        expect(res.status).toEqual(200);
        expect(res.body[0]).toHaveProperty('persID');
        expect(res.body[0]).toHaveProperty('persName');
        expect(res.body[0]).toHaveProperty('persYear');
        expect(res.body[0].persID).toEqual('test-pers1');
        expect(res.body[0].persName).toEqual('test-person1');
        expect(res.body[0].persYear).toEqual(1870);
        expect(res.body[0].persTitle).toEqual('test-title1');
        expect(res.body[0]).toHaveProperty('createdAt');
        expect(res.body[0]).toHaveProperty('updatedAt');
    });

    it('should not create a new Person with the same persID and persYear', async () => {
        const res = await requestWithSupertest.post('/api/person')
            .send([{
                persID: 'test-pers1',
                persName: 'test-person1',
                persYear: 1870,
                persTitle: 'test-title1'
        }]);
        expect(res.status).toEqual(500);
    });

});