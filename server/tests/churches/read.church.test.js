const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe(
    'GET methods for the Church model', () => {
        
        afterAll(async () => {
            await requestWithSupertest.delete('/api/church/test-inst1');
        });

        it('should get all Churches', async () => {
            const res = await requestWithSupertest.get('/api/church');
            expect(res.status).toEqual(200);
            expect(res.body).toBeInstanceOf(Array);
            if (res.body.length > 0) {
                expect(res.body[0]).toHaveProperty('instID');
                expect(res.body[0]).toHaveProperty('instName');
                expect(res.body[0]).toHaveProperty('instYear');
            }
        });

        it('should get a Church by instID', async () => {
            const res = await requestWithSupertest.get('/api/church/test-inst1');
            expect(res.status).toEqual(200);
            expect(res.body[0]).toHaveProperty('instID');
            expect(res.body[0]).toHaveProperty('instName');
            expect(res.body[0]).toHaveProperty('instYear');
            expect(res.body[0].instID).toEqual('test-inst1');
            expect(res.body[0].instName).toEqual('test-church1');
            expect(res.body[0].instYear).toEqual(1870);
        });

    }
);