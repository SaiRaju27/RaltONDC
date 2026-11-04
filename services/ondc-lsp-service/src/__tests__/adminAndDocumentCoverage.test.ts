import request from 'supertest';
import { app } from '../server';
import { AdminController } from '../controllers/adminController';
import { DocumentController } from '../controllers/documentController';
import { documentWorker } from '../services/documentWorker';
import { queueService } from '../services/queueService';
import { redisService } from '../services/redisService';
import { initDatabase, query, run } from '../database';

describe('Admin, Document Controller & Document Worker Coverage Suite', () => {
  const testRiderId = 'TEST-ADMIN-RIDER-01';

  beforeAll(async () => {
    await initDatabase();
    // Ensure test rider exists
    await run(`DELETE FROM riders WHERE id = '${testRiderId}'`);
    await run(`
      INSERT INTO riders (
        id, name, phone, vehicle_type, vehicle_number, dl_number,
        pan_number, aadhaar_number, bank_account_number, bank_ifsc,
        kyc_status, is_online, onboarding_completed, created_at, updated_at
      ) VALUES (
        '${testRiderId}', 'Admin Test Candidate', '9876599999',
        'Motorcycle', 'TS09EA9999', 'TS0920210009999', 'ABCDE9999F',
        '548912349999', '999912345678', 'HDFC0009999',
        'PENDING_VERIFICATION', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
  });

  describe('AdminController API Endpoints', () => {
    it('GET /api/admin/stats returns metrics overview', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
      expect(typeof res.body.stats.totalPartners).toBe('number');
    });

    it('GET /api/admin/riders lists riders with filters and search', async () => {
      // 1. All
      const resAll = await request(app).get('/api/admin/riders?filter=all');
      expect(resAll.status).toBe(200);
      expect(resAll.body.success).toBe(true);
      expect(Array.isArray(resAll.body.riders)).toBe(true);

      // 2. Pending filter
      const resPending = await request(app).get('/api/admin/riders?filter=pending');
      expect(resPending.status).toBe(200);

      // 3. Approved filter
      const resApproved = await request(app).get('/api/admin/riders?filter=approved');
      expect(resApproved.status).toBe(200);

      // 4. Action required filter
      const resAction = await request(app).get('/api/admin/riders?filter=action_required');
      expect(resAction.status).toBe(200);

      // 5. Search query
      const resSearch = await request(app).get('/api/admin/riders?search=Admin%20Test');
      expect(resSearch.status).toBe(200);
      expect(resSearch.body.count).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/admin/riders/:id returns rider details and documents', async () => {
      const res = await request(app).get(`/api/admin/riders/${testRiderId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rider.id).toBe(testRiderId);
      expect(Array.isArray(res.body.documents)).toBe(true);
    });

    it('GET /api/admin/riders/:id returns 404 for non-existent rider', async () => {
      const res = await request(app).get('/api/admin/riders/NON-EXISTENT-RIDER');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/admin/riders/:id/review approves partner profile', async () => {
      const res = await request(app)
        .post(`/api/admin/riders/${testRiderId}/review`)
        .send({ action: 'APPROVE_ALL' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rider.kyc_status).toBe('APPROVED');
      expect(res.body.rider.onboarding_completed).toBe(1);
    });

    it('POST /api/admin/riders/:id/review rejects partner with feedback', async () => {
      const res = await request(app)
        .post(`/api/admin/riders/${testRiderId}/review`)
        .send({
          action: 'REJECT_ALL',
          feedback: 'Please upload clearer photo of Driving License'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rider.kyc_status).toBe('ACTION_REQUIRED');
    });

    it('POST /api/admin/riders/:id/review rejects invalid review action', async () => {
      const res = await request(app)
        .post(`/api/admin/riders/${testRiderId}/review`)
        .send({ action: 'UNKNOWN_ACTION' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/admin/riders/:id/toggle-status updates active state', async () => {
      const res = await request(app)
        .post(`/api/admin/riders/${testRiderId}/toggle-status`)
        .send({ isOnline: 0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rider.is_online).toBe(0);
    });

    it('POST /api/admin/login authenticates valid admin credentials', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.admin.role).toBe('ADMIN');
    });

    it('POST /api/admin/login rejects invalid admin credentials', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid admin username or password');
    });
  });

  describe('DocumentController & Chunked Upload Pipeline', () => {
    let uploadSessionId = '';
    const mockFileContent = Buffer.from('TEST_DOCUMENT_IMAGE_CONTENT_SAMPLE_FOR_UNIT_TESTS').toString('base64');

    it('POST /api/documents/upload/init initiates chunked upload session', async () => {
      const res = await request(app)
        .post('/api/documents/upload/init')
        .send({
          riderId: testRiderId,
          docType: 'vehicle_rc',
          fileName: 'rc_card.jpg',
          totalSize: 1024,
          totalChunks: 2,
          mimeType: 'image/jpeg'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sessionId || res.body.session?.sessionId).toBeDefined();
      uploadSessionId = res.body.sessionId || res.body.session?.sessionId;
    });

    it('POST /api/documents/upload/init rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/documents/upload/init')
        .send({ riderId: testRiderId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/documents/upload/chunk uploads chunks correctly', async () => {
      // Chunk 0
      const res0 = await request(app)
        .post('/api/documents/upload/chunk')
        .send({
          sessionId: uploadSessionId,
          chunkIndex: 0,
          chunkData: mockFileContent.slice(0, 20)
        });

      expect(res0.status).toBe(200);
      expect(res0.body.success).toBe(true);
      expect(res0.body.status).toBe('UPLOADING');

      // Chunk 1 (final chunk)
      const res1 = await request(app)
        .post('/api/documents/upload/chunk')
        .send({
          sessionId: uploadSessionId,
          chunkIndex: 1,
          chunkData: mockFileContent.slice(20)
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.status).toBe('PROCESSING');
    });

    it('POST /api/documents/upload/chunk rejects invalid session ID', async () => {
      const res = await request(app)
        .post('/api/documents/upload/chunk')
        .send({
          sessionId: 'INVALID_SESSION_UUID',
          chunkIndex: 0,
          chunkData: 'SGVsbG8='
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/documents/rider/:riderId returns all rider documents', async () => {
      const res = await request(app).get(`/api/documents/rider/${testRiderId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.documents)).toBe(true);
    });

    it('GET /api/documents/:documentId/preview returns document metadata/file', async () => {
      // Create a test doc record
      const docId = `DOC-TEST-${Date.now()}`;
      await run(`
        INSERT INTO rider_documents (
          id, rider_id, doc_type, file_name, file_size, mime_type, file_data, status, created_at, updated_at
        ) VALUES (
          '${docId}', '${testRiderId}', 'pan_card', 'pan.jpg', 1024, 'image/jpeg',
          'data:image/jpeg;base64,${mockFileContent}', 'PENDING_VERIFICATION',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      const res = await request(app).get(`/api/documents/${docId}/preview`);
      expect(res.status).toBe(200);

      // Verify document via admin API
      const verifyRes = await request(app)
        .post(`/api/admin/documents/${docId}/verify`)
        .send({ status: 'APPROVED' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.document.status).toBe('APPROVED');
    });
  });

  describe('DocumentWorker Assembly Pipeline', () => {
    it('initializes document worker successfully', async () => {
      await documentWorker.init();
      expect(documentWorker).toBeDefined();
    });

    it('processAssemblyJob handles missing sessions gracefully', async () => {
      const res = await documentWorker.processAssemblyJob('NON-EXISTENT-JOB-ID');
      expect(res).toBe(false);
    });
  });

  describe('Admin and Document Controller Error Branches', () => {
    it('AdminController.verifyDocument handles errors on missing doc', async () => {
      const req: any = { params: { docId: 'NON-EXISTENT-DOC' }, body: { status: 'APPROVED' } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn()
      };
      await AdminController.verifyDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('DocumentController.previewDocument handles non-existent doc', async () => {
      const req: any = { params: { docId: 'NON-EXISTENT' } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn()
      };
      await DocumentController.previewDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('AdminController.verifyDocument rejects missing or invalid status and missing feedback', async () => {
      const req1: any = { params: { docId: 'DOC-123' }, body: { status: 'INVALID' } };
      const res1: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await AdminController.verifyDocument(req1, res1);
      expect(res1.status).toHaveBeenCalledWith(400);

      const req2: any = { params: { docId: 'DOC-123' }, body: { status: 'REJECTED' } };
      const res2: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await AdminController.verifyDocument(req2, res2);
      expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('AdminController.togglePartnerStatus rejects non-existent and unapproved riders', async () => {
      const res404 = await request(app)
        .post('/api/admin/riders/NON-EXISTENT-RIDER/toggle-status')
        .send({ isOnline: true });
      expect(res404.status).toBe(404);

      // Create an unverified rider
      await run(`DELETE FROM riders WHERE id = 'UNVERIFIED-RIDER-01'`);
      await run(`
        INSERT INTO riders (id, name, phone, vehicle_type, vehicle_number, kyc_status, onboarding_completed)
        VALUES ('UNVERIFIED-RIDER-01', 'Unverified', '9998881111', 'Motorcycle', 'TS09EA1111', 'PENDING_VERIFICATION', 0)
      `);
      const res400 = await request(app)
        .post('/api/admin/riders/UNVERIFIED-RIDER-01/toggle-status')
        .send({ isOnline: true });
      expect(res400.status).toBe(400);
    });

    it('DocumentController.getRiderDocuments handles missing riderId and SVG preview', async () => {
      const reqEmpty: any = { params: {}, query: {} };
      const resEmpty: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await DocumentController.getRiderDocuments(reqEmpty, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(400);

      // Preview with utf8 SVG data
      await run(`DELETE FROM rider_documents WHERE id = 'DOC-SVG-TEST-01'`);
      await run(`
        INSERT INTO rider_documents (
          id, rider_id, doc_type, file_name, mime_type, file_size, file_data, status
        ) VALUES (
          'DOC-SVG-TEST-01', '${testRiderId}', 'pan_card', 'test.svg', 'image/svg+xml', 1024,
          'data:image/svg+xml;utf8,<svg><text>Sample</text></svg>', 'APPROVED'
        )
      `);
      const resSvg = await request(app).get('/api/documents/DOC-SVG-TEST-01/preview');
      expect(resSvg.status).toBe(200);
    });

    it('redisService operates cleanly in fallback memory mode', async () => {
      await redisService.updateRiderLocation('RIDER-GEO-01', 17.4483, 78.3915);
      const nearby = await redisService.searchNearbyRiders(17.4485, 78.3917, 5);
      expect(Array.isArray(nearby)).toBe(true);
      expect(nearby.length).toBeGreaterThanOrEqual(1);

      await redisService.set('test_key', 'test_value', 60);
      const cached = await redisService.get('test_key');
      expect(cached).toBe('test_value');

      await redisService.publish('test_channel', { msg: 'ping' });
    });

    it('queueService publishes and registers consumers', async () => {
      const pubResult = await queueService.publish('test_queue', { event: 'TEST' });
      expect(pubResult).toBe(true);

      const pubResult2 = await queueService.publishToQueue('test_queue_2', { event: 'TEST_2' });
      expect(pubResult2).toBe(true);

      await queueService.registerConsumer('test_queue', async (payload) => {});
      expect(queueService).toBeDefined();
    });

    it('DocumentController.initUpload creates placeholder for unknown rider', async () => {
      const res = await request(app)
        .post('/api/documents/upload/init')
        .send({
          riderId: 'NEW-UNKNOWN-RIDER-999',
          docType: 'pan_card',
          fileName: 'pan.jpg',
          totalSize: 500,
          totalChunks: 1,
          mimeType: 'image/jpeg'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DocumentController.previewDocument renders raw base64 data correctly', async () => {
      await run(`DELETE FROM rider_documents WHERE id = 'DOC-RAW-BASE64-01'`);
      await run(`
        INSERT INTO rider_documents (
          id, rider_id, doc_type, file_name, mime_type, file_size, file_data, status
        ) VALUES (
          'DOC-RAW-BASE64-01', '${testRiderId}', 'aadhaar_front', 'raw.jpg', 'image/jpeg', 24,
          'cmF3X2Jhc2U2NF90ZXN0X2J5dGVz', 'APPROVED'
        )
      `);
      const res = await request(app).get('/api/documents/DOC-RAW-BASE64-01/preview');
      expect(res.status).toBe(200);
    });

    it('RiderController.requestDigioKyc and responseDigioKyc fallback handling', async () => {
      // Empty ID
      const reqEmpty: any = { params: {}, query: {}, body: {} };
      const resEmpty: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const { RiderController } = require('../controllers/riderController');
      await RiderController.requestDigioKyc(reqEmpty, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(400);

      const resEmpty2: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await RiderController.responseDigioKyc(reqEmpty, resEmpty2);
      expect(resEmpty2.status).toHaveBeenCalledWith(400);

      // Valid ID fallback
      const reqValid: any = { params: { id: 'TEST-RIDER-DIGIO-1' } };
      const resValid: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await RiderController.requestDigioKyc(reqValid, resValid);
      expect(resValid.json).toHaveBeenCalled();

      const resValid2: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await RiderController.responseDigioKyc(reqValid, resValid2);
      expect(resValid2.json).toHaveBeenCalled();
    });

    it('AdminController.updateRiderProfile updates DOB and profile fields or 404s', async () => {
      // 404 for non-existent rider
      const res404 = await request(app)
        .post('/api/admin/riders/NON_EXISTENT_RIDER_999/update')
        .send({ dob: '01-01-2000' });
      expect(res404.status).toBe(404);

      // Success update for test rider
      const resSuccess = await request(app)
        .post(`/api/admin/riders/${testRiderId}/update`)
        .send({
          dob: '20-10-1999',
          name: 'Updated Name',
          father_name: 'Father Name',
          dl_number: 'DL-999',
          pan_number: 'PAN999',
          aadhaar_number: '123412341234',
          bank_account_number: '9988776655',
          bank_ifsc: 'HDFC0001'
        });
      expect(resSuccess.status).toBe(200);
      expect(resSuccess.body.success).toBe(true);
      expect(resSuccess.body.rider.dob).toBe('20-10-1999');
    });

    it('DocumentController.previewDocument serves SVG fallback when file_data is empty', async () => {
      await run(`DELETE FROM rider_documents WHERE id = 'DOC-EMPTY-DATA-01'`);
      await run(`
        INSERT INTO rider_documents (
          id, rider_id, doc_type, file_name, mime_type, file_size, file_data, status
        ) VALUES (
          'DOC-EMPTY-DATA-01', '${testRiderId}', 'pan_card', 'empty.jpg', 'image/jpeg', 0,
          '', 'APPROVED'
        )
      `);
      const res = await request(app).get('/api/documents/DOC-EMPTY-DATA-01/preview');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
    });
  });
});
