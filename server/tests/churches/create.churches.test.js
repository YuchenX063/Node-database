const app = require('../../app');
const supertest = require('supertest');
const requestWithSupertest = supertest(app);

describe(
    'CREATE methods for the churchInYear model', () => {
        
        afterAll(async () => {
            await requestWithSupertest.delete('/api/church/test-inst1');
        });

        it('should create a new churchInYear', async () => {
            const res = await requestWithSupertest.post('/api/church')
                .send([{
                    instID: 'test-inst1',
                    instName: 'test-church1',
                    instYear: 1870
                }]);
            expect(res.status).toEqual(200);
            expect(res.body[0]).toHaveProperty('instID');
            expect(res.body[0]).toHaveProperty('instName');
            expect(res.body[0]).toHaveProperty('instYear');
            expect(res.body[0].instID).toEqual('test-inst1');
            expect(res.body[0].instName).toEqual('test-church1');
            expect(res.body[0].instYear).toEqual(1870);
            expect(res.body[0]).toHaveProperty('createdAt');
            expect(res.body[0]).toHaveProperty('updatedAt');
    });

        it('should not create a new churchInYear with the same instID and instYear', async () => {
            const res = await requestWithSupertest.post('/api/church')
                .send([{
                    instID: 'test-inst1',
                    instName: 'test-church1',
                    instYear: 1870
                }]);
            expect(res.status).toEqual(500);
    });
});