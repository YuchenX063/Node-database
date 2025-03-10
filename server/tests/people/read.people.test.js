const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe('GET methods for the People model', () => {

    let test_persID = '';

    beforeAll( async() => {
        const res = await requestWithSupertest.post('/api/person')
            .send([{
                persID: 'test-pers1',
                persName: 'test-person1',
                persYear: 1870,
                persTitle: 'test-title1'
        }]);
        test_persID = res.body[0].persID;
        expect(res.status).toEqual(200);
    });

    afterAll( async() => {
        await requestWithSupertest.delete('/api/person/test-pers1');
    });

    it('should get all People', async () => {
        const res = await requestWithSupertest.get('/api/person');
        expect(res.status).toEqual(200);
        expect(res.body.rows).toBeInstanceOf(Array);
        if (res.body.rows.length > 0) {
            expect(res.body.rows[0]).toHaveProperty('persID');
            expect(res.body.rows[0]).toHaveProperty('persName');
            expect(res.body.rows[0]).toHaveProperty('persYear');
            expect(res.body.rows[0]).toHaveProperty('persTitle');
        }
    });

    it('should get a Person by persID', async () => {
        const res = await requestWithSupertest.get('/api/person/test-pers1');
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('persID');
        expect(res.body).toHaveProperty('persName');
        expect(res.body).toHaveProperty('persYear');
        expect(res.body).toHaveProperty('persTitle');
        expect(res.body.persID).toEqual('test-pers1');
        expect(res.body.persName).toEqual('test-person1');
        expect(res.body.persYear).toEqual(1870);
        expect(res.body.persTitle).toEqual('test-title1');
    });
        
});