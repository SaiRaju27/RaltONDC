import { Request, Response } from 'express';
import { query, run, get } from '../database';
import { documentWorker } from '../services/documentWorker';
import { riderManager } from '../services/riderManager';
import { logger } from '../logger';

export class DocumentController {
  /**
   * 1. Initialize a chunked upload session
   */
  public static async initUpload(req: Request, res: Response) {
    try {
      const {
        riderId,
        docType,
        docNumber,
        fileName,
        mimeType,
        totalChunks,
        totalSize
      } = req.body || {};

      if (!riderId || !docType || !fileName || !totalChunks || !totalSize) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: riderId, docType, fileName, totalChunks, totalSize'
        });
      }

      // Check rider exists or create pending placeholder
      let rider = await riderManager.getRider(riderId);
      if (!rider) {
        const cleanPhone = riderId.replace(/[^0-9]/g, '').slice(-10);
        rider = await riderManager.createOrUpdateRider({
          id: riderId,
          phone: `+91 ${cleanPhone || '9876543210'}`,
          name: 'Delivery Partner',
          kyc_status: 'PENDING_VERIFICATION',
          onboarding_completed: 0,
          is_online: 0
        });
      }

      const sessionId = `UP-${riderId}-${docType}-${Date.now()}`;
      const now = new Date().toISOString();

      await run(`
        INSERT INTO document_upload_sessions (
          session_id, rider_id, doc_type, doc_number, file_name, mime_type,
          total_chunks, total_size, uploaded_chunks, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'UPLOADING', ?)
      `, [
        sessionId,
        riderId,
        docType,
        docNumber || '',
        fileName,
        mimeType || 'image/jpeg',
        totalChunks,
        totalSize,
        now
      ]);

      logger.info({ sessionId, riderId, docType, totalChunks }, '[DocumentController] Upload session created');

      res.json({
        success: true,
        sessionId,
        totalChunks,
        message: 'Chunked upload session initialized successfully'
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[DocumentController] Error in initUpload');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 2. Upload single chunk
   */
  public static async uploadChunk(req: Request, res: Response) {
    try {
      const { sessionId, chunkIndex, chunkData } = req.body || {};

      if (!sessionId || chunkIndex === undefined || !chunkData) {
        return res.status(400).json({
          success: false,
          error: 'Missing required chunk payload: sessionId, chunkIndex, chunkData'
        });
      }

      const session = await get<{
        session_id: string;
        total_chunks: number;
        uploaded_chunks: number;
        status: string;
        rider_id: string;
        doc_type: string;
      }>('SELECT * FROM document_upload_sessions WHERE session_id = ?', [sessionId]);

      if (!session) {
        return res.status(404).json({ success: false, error: 'Upload session not found' });
      }

      if (session.status === 'COMPLETED') {
        return res.json({
          success: true,
          status: 'COMPLETED',
          message: 'Document already assembled and verified'
        });
      }

      // Insert chunk
      const now = new Date().toISOString();
      await run(`
        INSERT INTO document_chunks (session_id, chunk_index, chunk_data, created_at)
        VALUES (?, ?, ?, ?)
      `, [sessionId, chunkIndex, chunkData, now]);

      // Count current chunks
      const countRes = await get<{ count: number | string }>(
        'SELECT COUNT(*) as count FROM document_chunks WHERE session_id = ?',
        [sessionId]
      );
      const currentChunks = parseInt(countRes?.count?.toString() || '0', 10);

      await run(
        'UPDATE document_upload_sessions SET uploaded_chunks = ? WHERE session_id = ?',
        [currentChunks, sessionId]
      );

      // Check if all chunks received
      if (currentChunks >= session.total_chunks) {
        // Enqueue to worker node for async assembly and DB storage
        await documentWorker.enqueueAssemblyJob(sessionId);

        return res.json({
          success: true,
          sessionId,
          chunkIndex,
          uploadedChunks: currentChunks,
          totalChunks: session.total_chunks,
          status: 'PROCESSING',
          message: 'All chunks received. Dispatched to worker node for assembly.'
        });
      }

      res.json({
        success: true,
        sessionId,
        chunkIndex,
        uploadedChunks: currentChunks,
        totalChunks: session.total_chunks,
        status: 'UPLOADING',
        progressPercent: Math.round((currentChunks / session.total_chunks) * 100)
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[DocumentController] Error in uploadChunk');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 3. Get all documents for a rider
   */
  public static async getRiderDocuments(req: Request, res: Response) {
    try {
      const riderId = req.params.riderId || req.query.riderId;
      if (!riderId) {
        return res.status(400).json({ success: false, error: 'riderId is required' });
      }

      const rider = await riderManager.getRider(riderId as string);
      const docs = await query(
        `SELECT id, rider_id, doc_type, doc_number, file_name, mime_type, file_size,
                status, rejection_reason, verified_by, verified_at, created_at, updated_at
         FROM rider_documents
         WHERE rider_id = ?
         ORDER BY created_at ASC`,
        [riderId]
      );

      res.json({
        success: true,
        rider: rider || null,
        kycStatus: rider?.kyc_status || 'PENDING_VERIFICATION',
        onboardingCompleted: rider?.onboarding_completed === 1,
        rejectionFeedback: (rider as any)?.rejection_feedback || null,
        documents: docs || []
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[DocumentController] Error in getRiderDocuments');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 4. Preview document directly by ID
   */
  public static async previewDocument(req: Request, res: Response) {
    try {
      const docId = req.params.docId;
      const doc = await get<{
        file_name: string;
        mime_type: string;
        file_data: string;
      }>('SELECT file_name, mime_type, file_data FROM rider_documents WHERE id = ?', [docId]);

      if (!doc || !doc.file_data) {
        return res.status(404).send('Document not found');
      }

      if (doc.file_data.startsWith('data:')) {
        const parts = doc.file_data.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : (doc.mime_type || 'image/jpeg');

        if (doc.file_data.includes('utf8,')) {
          const content = decodeURIComponent(parts[1]);
          res.setHeader('Content-Type', mime);
          return res.send(content);
        }

        const buffer = Buffer.from(parts[1], 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
        return res.send(buffer);
      }

      // If raw base64 string
      const buffer = Buffer.from(doc.file_data, 'base64');
      res.setHeader('Content-Type', doc.mime_type || 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).send('Error rendering document preview');
    }
  }
}

