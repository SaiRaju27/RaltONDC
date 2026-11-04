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
        try {
          rider = await riderManager.createOrUpdateRider({
            id: riderId,
            phone: `+91 ${cleanPhone || '9876543210'}`,
            name: 'Delivery Partner',
            kyc_status: 'PENDING_VERIFICATION',
            onboarding_completed: 0,
            is_online: 0
          });
        } catch {
          rider = await riderManager.getRider(riderId);
        }
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
        session: { sessionId, totalChunks },
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
   * 4. Preview document directly by ID (Serves real binary or high-res vector preview card)
   */
  public static async previewDocument(req: Request, res: Response) {
    try {
      const docId = req.params.docId;
      const doc = await get<{
        id: string;
        rider_id: string;
        doc_type: string;
        doc_number: string;
        file_name: string;
        mime_type: string;
        file_data: string;
        status: string;
      }>('SELECT id, rider_id, doc_type, doc_number, file_name, mime_type, file_data, status FROM rider_documents WHERE id = ?', [docId]);

      if (!doc) {
        return res.status(404).send('Document not found');
      }

      const isValidImageBuffer = (buf: Buffer): boolean => {
        if (!buf || buf.length < 32) return false;
        if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
        if (buf.toString('ascii', 0, 4) === 'RIFF') return true; // WebP
        if (buf.toString('ascii', 0, 4) === '%PDF') return true; // PDF
        if (buf.toString('utf8', 0, 50).includes('<svg')) return true; // SVG
        return false;
      };

      if (doc.file_data && doc.file_data.startsWith('data:')) {
        const parts = doc.file_data.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : (doc.mime_type || 'image/jpeg');

        if (doc.file_data.includes('utf8,')) {
          const textContent = decodeURIComponent(parts[1]);
          if (res.setHeader) res.setHeader('Content-Type', mime);
          return res.send(textContent);
        }

        const buffer = Buffer.from(parts[1], 'base64');
        if (isValidImageBuffer(buffer)) {
          if (res.setHeader) {
            res.setHeader('Content-Type', mime);
            res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
          }
          return res.send(buffer);
        }
      } else if (doc.file_data) {
        try {
          const buffer = Buffer.from(doc.file_data, 'base64');
          if (isValidImageBuffer(buffer)) {
            if (res.setHeader) {
              res.setHeader('Content-Type', doc.mime_type || 'image/jpeg');
              res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
            }
            return res.send(buffer);
          }
        } catch (e) {}
      }

      // Fallback: render vector SVG preview card
      if (res.setHeader) res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(renderSvgDocumentCard(doc));
    } catch (err: any) {
      res.status(500).send('Error rendering document preview');
    }
  }
}

function renderSvgDocumentCard(doc: {
  doc_type?: string;
  file_name?: string;
  doc_number?: string;
  rider_id?: string;
  status?: string;
}): string {
  const docType = (doc.doc_type || 'document').toLowerCase();
  const status = (doc.status || 'PENDING_VERIFICATION').toUpperCase();
  const riderId = doc.rider_id || 'RALT-PARTNER';
  const fileName = doc.file_name || `${docType}.jpg`;

  const metaMap: Record<string, { title: string; subtitle: string; icon: string; color: string }> = {
    pan_card: {
      title: 'Permanent Account Number (PAN Card)',
      subtitle: 'Income Tax Department • Government of India',
      icon: '💳',
      color: '#0284c7'
    },
    aadhaar_front: {
      title: 'Aadhaar Identity Card (Front Side)',
      subtitle: 'Unique Identification Authority of India (UIDAI)',
      icon: '🪪',
      color: '#d97706'
    },
    aadhaar_back: {
      title: 'Aadhaar Identity Card (Address & QR)',
      subtitle: 'Unique Identification Authority of India (UIDAI)',
      icon: '🪪',
      color: '#d97706'
    },
    driving_license: {
      title: 'Commercial Driving License',
      subtitle: 'Ministry of Road Transport & Highways (MoRTH)',
      icon: '🚗',
      color: '#059669'
    },
    driving_license_back: {
      title: 'Driving License (Endorsement & Back)',
      subtitle: 'Ministry of Road Transport & Highways (MoRTH)',
      icon: '🚗',
      color: '#059669'
    },
    vehicle_rc: {
      title: 'Vehicle Registration Certificate (RC)',
      subtitle: 'Transport Department Government of India',
      icon: '📄',
      color: '#7c3aed'
    },
    profile_selfie: {
      title: 'Live Delivery Partner Profile Selfie',
      subtitle: 'Biometric Face Liveness Verification',
      icon: '🤳',
      color: '#042f1e'
    }
  };

  const meta = metaMap[docType] || {
    title: fileName || 'KYC Verification Document',
    subtitle: 'RALT Logistics Verification Desk',
    icon: '📄',
    color: '#0f172a'
  };

  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const badgeColor = isApproved ? '#059669' : (isRejected ? '#dc2626' : '#d97706');
  const badgeBg = isApproved ? '#ecfdf5' : (isRejected ? '#fef2f2' : '#fffbeb');
  const badgeBorder = isApproved ? '#a7f3d0' : (isRejected ? '#fecaca' : '#fde68a');
  const badgeText = isApproved ? 'APPROVED & VERIFIED ✓' : (isRejected ? 'ACTION REQUIRED ✕' : 'PENDING REVIEW ⏳');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#042f1e"/>
        <stop offset="100%" stop-color="#0b1720"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f8fafc"/>
      </linearGradient>
    </defs>
    <rect width="600" height="360" fill="url(#bgGrad)" rx="16"/>
    <rect x="20" y="20" width="560" height="320" rx="12" fill="url(#cardGrad)" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="20" y="20" width="560" height="8" rx="4" fill="${meta.color}"/>
    <circle cx="60" cy="65" r="22" fill="${meta.color}15"/>
    <text x="60" y="73" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="22" text-anchor="middle">${meta.icon}</text>
    <text x="96" y="60" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="15" font-weight="700" fill="#0f172a">${meta.title}</text>
    <text x="96" y="78" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="500" fill="#64748b">${meta.subtitle}</text>
    <rect x="420" y="48" width="145" height="28" rx="14" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.2"/>
    <text x="492" y="66" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" fill="${badgeColor}" text-anchor="middle">${badgeText}</text>
    <line x1="36" y1="102" x2="564" y2="102" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4"/>
    <rect x="36" y="116" width="528" height="150" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="56" y="142" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" fill="#64748b">PARTNER IDENTIFIER</text>
    <text x="56" y="162" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="600" fill="#0f172a">${riderId}</text>
    <text x="310" y="142" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" fill="#64748b">ATTACHED FILE</text>
    <text x="310" y="162" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="600" fill="#0f172a">${fileName}</text>
    <text x="56" y="196" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" fill="#64748b">DOCUMENT TYPE</text>
    <text x="56" y="216" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600" fill="#0f172a">${docType.toUpperCase()}</text>
    <text x="310" y="196" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" fill="#64748b">STATUS</text>
    <text x="310" y="216" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700" fill="${badgeColor}">${status}</text>
    <rect x="56" y="234" width="488" height="24" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <text x="300" y="250" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="600" fill="#00855d" text-anchor="middle">🛡️ ONDC DIGITALLY VERIFIED KYC RECORD • RALT AUDITED</text>
    <text x="36" y="300" font-family="'JetBrains Mono', monospace" font-size="10" fill="#94a3b8">DOC-ID: ${doc.doc_number || docType.toUpperCase()}</text>
    <text x="564" y="300" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" text-anchor="end">Official Ops Verification Desk</text>
  </svg>`;
}
