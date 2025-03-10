const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe(
    'GET methods for the Church model', () => {

        let createdId = '';

        beforeAll(async () => {
            res = await requestWithSupertest.post('/api/church')
                .send([{
                    instID: 'test-inst1',
                    instName: 'test-church1',
                    instYear: 1870
                }]);
            createdId = res.body[0].instID;
            expect(res.status).toEqual(200);
        });
        
        afterAll(async () => {
            await requestWithSupertest.delete('/api/church/test-inst1');
        });

        it('should get all Churches', async () => {
            const res = await requestWithSupertest.get('/api/church');
            expect(res.status).toEqual(200);
            expect(res.body.rows).toBeInstanceOf(Array);
            if (res.body.rows.length > 0) {
                expect(res.body.rows[0]).toHaveProperty('instID');
                expect(res.body.rows[0]).toHaveProperty('instName');
                expect(res.body.rows[0]).toHaveProperty('instYear');
            }
        });

        it('should get a Church by instID', async () => {
            const res = await requestWithSupertest.get('/api/church/test-inst1');
            expect(res.status).toEqual(200);
            expect(res.body).toHaveProperty('instID');
            expect(res.body).toHaveProperty('instName');
            expect(res.body).toHaveProperty('instYear');
            expect(res.body.instID).toEqual('test-inst1');
            expect(res.body.instName).toEqual('test-church1');
            expect(res.body.instYear).toEqual(1870);
        });

    }
);