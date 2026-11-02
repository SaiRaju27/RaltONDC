import { query, run, get } from '../database';
import { queueService } from './queueService';
import { riderManager } from './riderManager';
import { logger } from '../logger';

export interface DocumentUploadSession {
  session_id: string;
  rider_id: string;
  doc_type: string;
  doc_number?: string;
  file_name: string;
  mime_type: string;
  total_chunks: number;
  total_size: number;
  uploaded_chunks: number;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
}

export interface RiderDocument {
  id: string;
  rider_id: string;
  doc_type: string;
  doc_number?: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  file_data: string;
  status: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

class DocumentWorker {
  private inMemoryQueue: string[] = [];
  private isProcessing = false;
  private readonly QUEUE_NAME = 'ondc.documents.assemble';

  public async init() {
    logger.info('[DocumentWorker] Initializing worker node for chunked document assembly...');
    
    // Register RabbitMQ consumer if available
    try {
      queueService.registerConsumer(this.QUEUE_NAME, async (msg: any) => {
        if (msg && msg.sessionId) {
          await this.processAssemblyJob(msg.sessionId);
        }
      });
    } catch (e: any) {
      logger.warn({ err: e.message }, '[DocumentWorker] RabbitMQ worker registration fallback to in-process queue');
    }

    // Start background processor loop for resilient worker execution
    setInterval(() => {
      this.drainQueue();
    }, 1000);
  }

  public async enqueueAssemblyJob(sessionId: string) {
    logger.info({ sessionId }, '[DocumentWorker] Enqueueing chunk assembly job');
    this.inMemoryQueue.push(sessionId);

    // Also dispatch to RabbitMQ for distributed worker nodes
    if (queueService.isHealthy) {
      await queueService.publish(this.QUEUE_NAME, { sessionId, timestamp: new Date().toISOString() });
    }

    // Trigger immediate drain
    this.drainQueue();
  }

  private async drainQueue() {
    if (this.isProcessing || this.inMemoryQueue.length === 0) return;
    this.isProcessing = true;

    try {
      while (this.inMemoryQueue.length > 0) {
        const sessionId = this.inMemoryQueue.shift();
        if (sessionId) {
          await this.processAssemblyJob(sessionId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public async processAssemblyJob(sessionId: string): Promise<boolean> {
    try {
      logger.info({ sessionId }, '[DocumentWorker] Worker node processing assembly for session');

      const session = await get<DocumentUploadSession>(
        'SELECT * FROM document_upload_sessions WHERE session_id = ?',
        [sessionId]
      );

      if (!session) {
        logger.warn({ sessionId }, '[DocumentWorker] Session not found');
        return false;
      }

      if (session.status === 'COMPLETED') {
        return true;
      }

      // Mark processing
      await run('UPDATE document_upload_sessions SET status = ? WHERE session_id = ?', ['PROCESSING', sessionId]);

      // Fetch all chunks in strict sequential order
      const chunks = await query<{ chunk_index: number; chunk_data: string }>(
        'SELECT chunk_index, chunk_data FROM document_chunks WHERE session_id = ? ORDER BY chunk_index ASC',
        [sessionId]
      );

      if (chunks.length < session.total_chunks) {
        logger.warn(
          { sessionId, expected: session.total_chunks, actual: chunks.length },
          '[DocumentWorker] Incomplete chunks received'
        );
        return false;
      }

      // Reassemble chunked base64 payload
      const fullData = chunks.map((c) => c.chunk_data).join('');

      // Formulate document ID
      const docId = `DOC-${session.rider_id}-${session.doc_type}`;
      const now = new Date().toISOString();

      // Check if document record already exists for this rider & docType
      const existingDoc = await get<RiderDocument>(
        'SELECT id FROM rider_documents WHERE rider_id = ? AND doc_type = ? LIMIT 1',
        [session.rider_id, session.doc_type]
      );

      if (existingDoc) {
        await run(`
          UPDATE rider_documents SET
            doc_number = ?,
            file_name = ?,
            mime_type = ?,
            file_size = ?,
            file_data = ?,
            status = 'PENDING_VERIFICATION',
            rejection_reason = NULL,
            verified_by = NULL,
            verified_at = NULL,
            updated_at = ?
          WHERE id = ?
        `, [
          session.doc_number || '',
          session.file_name,
          session.mime_type,
          session.total_size,
          fullData,
          now,
          existingDoc.id
        ]);
      } else {
        await run(`
          INSERT INTO rider_documents (
            id, rider_id, doc_type, doc_number, file_name, mime_type, file_size, file_data,
            status, rejection_reason, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_VERIFICATION', NULL, ?, ?)
        `, [
          docId,
          session.rider_id,
          session.doc_type,
          session.doc_number || '',
          session.file_name,
          session.mime_type,
          session.total_size,
          fullData,
          now,
          now
        ]);
      }

      // Update rider status to PENDING_VERIFICATION
      await run(`
        UPDATE riders SET
          kyc_status = 'PENDING_VERIFICATION',
          onboarding_completed = 0,
          is_online = 0,
          updated_at = ?
        WHERE id = ?
      `, [now, session.rider_id]);

      // Clean up temporary chunks to save storage
      await run('DELETE FROM document_chunks WHERE session_id = ?', [sessionId]);

      // Mark session complete
      await run('UPDATE document_upload_sessions SET status = ? WHERE session_id = ?', ['COMPLETED', sessionId]);

      logger.info(
        { sessionId, docId, riderId: session.rider_id, docType: session.doc_type },
        '[DocumentWorker] ✅ Successfully assembled and stored document in DB (Status: PENDING_VERIFICATION)'
      );

      // Notify Rider and Admin via WebSocket
      riderManager.notifyRider(session.rider_id, {
        type: 'DOCUMENT_UPLOAD_PROCESSED',
        docType: session.doc_type,
        status: 'PENDING_VERIFICATION',
        message: `${session.file_name} has been processed and is under verification.`
      });

      riderManager.broadcastToAll({
        type: 'ADMIN_PARTNER_DOCUMENT_UPDATE',
        riderId: session.rider_id,
        docType: session.doc_type,
        status: 'PENDING_VERIFICATION'
      });

      return true;
    } catch (err: any) {
      logger.error({ sessionId, err: err.message }, '[DocumentWorker] ❌ Error assembling document chunks');
      await run('UPDATE document_upload_sessions SET status = ? WHERE session_id = ?', ['FAILED', sessionId]);
      return false;
    }
  }
}

export const documentWorker = new DocumentWorker();

