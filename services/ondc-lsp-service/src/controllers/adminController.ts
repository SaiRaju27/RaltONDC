import { Request, Response } from 'express';
import { query, run, get } from '../database';
import { riderManager } from '../services/riderManager';
import { logger } from '../logger';
import { signRiderToken } from '../security';

export class AdminController {
  /**
   * 1. Get KPI Overview & Verification Stats
   */
  public static async getStats(req: Request, res: Response) {
    try {
      const totalRiders = await get<{ count: number | string }>('SELECT COUNT(*) as count FROM riders');
      const approvedRiders = await get<{ count: number | string }>(
        "SELECT COUNT(*) as count FROM riders WHERE kyc_status = 'APPROVED' OR onboarding_completed = 1"
      );
      const pendingRiders = await get<{ count: number | string }>(
        "SELECT COUNT(*) as count FROM riders WHERE kyc_status = 'PENDING_VERIFICATION' AND onboarding_completed = 0"
      );
      const actionRequiredRiders = await get<{ count: number | string }>(
        "SELECT COUNT(*) as count FROM riders WHERE kyc_status = 'ACTION_REQUIRED' OR kyc_status = 'REJECTED'"
      );

      const pendingDocs = await get<{ count: number | string }>(
        "SELECT COUNT(*) as count FROM rider_documents WHERE status = 'PENDING_VERIFICATION'"
      );

      res.json({
        success: true,
        stats: {
          totalPartners: parseInt(totalRiders?.count?.toString() || '0', 10),
          approvedPartners: parseInt(approvedRiders?.count?.toString() || '0', 10),
          pendingPartners: parseInt(pendingRiders?.count?.toString() || '0', 10),
          actionRequiredPartners: parseInt(actionRequiredRiders?.count?.toString() || '0', 10),
          pendingDocumentsCount: parseInt(pendingDocs?.count?.toString() || '0', 10)
        }
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[AdminController] Error in getStats');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 2. List all riders with verification progress & filter
   */
  public static async listRiders(req: Request, res: Response) {
    try {
      const filter = (req.query.filter as string) || 'all';
      const search = (req.query.search as string) || '';

      let sql = `
        SELECT r.*,
               (SELECT COUNT(*) FROM rider_documents WHERE rider_id = r.id) as total_docs,
               (SELECT COUNT(*) FROM rider_documents WHERE rider_id = r.id AND status = 'APPROVED') as approved_docs,
               (SELECT COUNT(*) FROM rider_documents WHERE rider_id = r.id AND status = 'REJECTED') as rejected_docs,
               (SELECT COUNT(*) FROM rider_documents WHERE rider_id = r.id AND status = 'PENDING_VERIFICATION') as pending_docs
        FROM riders r
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      if (filter === 'pending') {
        conditions.push("(r.kyc_status = 'PENDING_VERIFICATION' AND r.onboarding_completed = 0)");
      } else if (filter === 'action_required' || filter === 'rejected') {
        conditions.push("(r.kyc_status = 'ACTION_REQUIRED' OR r.kyc_status = 'REJECTED')");
      } else if (filter === 'approved') {
        conditions.push("(r.kyc_status = 'APPROVED' OR r.onboarding_completed = 1)");
      }

      if (search) {
        conditions.push('(r.name LIKE ? OR r.phone LIKE ? OR r.vehicle_number LIKE ? OR r.id LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      sql += ' ORDER BY r.created_at DESC LIMIT 100';

      const riders = await query(sql, params);

      res.json({
        success: true,
        count: riders.length,
        riders
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[AdminController] Error in listRiders');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 3. Get detailed profile of a rider + all documents with file preview
   */
  public static async getRiderDetails(req: Request, res: Response) {
    try {
      const riderId = req.params.id;
      const rider = await riderManager.getRider(riderId);

      if (!rider) {
        return res.status(404).json({ success: false, error: 'Partner not found' });
      }

      // Ensure all 6 standard KYC documents exist for inspected rider
      const standardDocs = [
        { type: 'aadhaar_front', file: 'Aadhaar_Front.jpg', name: 'Aadhaar Card (Front)' },
        { type: 'aadhaar_back', file: 'Aadhaar_Back.jpg', name: 'Aadhaar Card (Back)' },
        { type: 'pan_card', file: 'PAN_Card.jpg', name: 'PAN Card' },
        { type: 'driving_license', file: 'Driving_License.jpg', name: 'Driving License' },
        { type: 'vehicle_rc', file: 'Vehicle_RC.jpg', name: 'Vehicle RC' },
        { type: 'profile_selfie', file: 'Profile_Selfie.jpg', name: 'Live Partner Selfie' },
      ];

      for (const std of standardDocs) {
        const docId = `DOC-${riderId}-${std.type}`;
        const existing = await get<{ id: string }>('SELECT id FROM rider_documents WHERE id = ?', [docId]);
        if (!existing) {
          const now = new Date().toISOString();
          const docStatus = rider.kyc_status === 'APPROVED' ? 'APPROVED' : 'PENDING_VERIFICATION';
          await run(`
            INSERT INTO rider_documents (
              id, rider_id, doc_type, doc_number, file_name, mime_type, file_size,
              file_data, status, created_at, updated_at
            ) VALUES (?, ?, ?, '', ?, 'image/svg+xml', 1024, '', ?, ?, ?)
          `, [docId, riderId, std.type, std.file, docStatus, now, now]).catch(() => {});
        }
      }

      const documents = await query(
        `SELECT id, rider_id, doc_type, doc_number, file_name, mime_type, file_size,
                file_data, status, rejection_reason, verified_by, verified_at, created_at, updated_at
         FROM rider_documents
         WHERE rider_id = ?
         ORDER BY created_at ASC`,
        [riderId]
      );

      res.json({
        success: true,
        rider,
        documents
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[AdminController] Error in getRiderDetails');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 4. Verify (Approve / Reject with Feedback) an individual document
   */
  public static async verifyDocument(req: Request, res: Response) {
    try {
      const docId = req.params.docId;
      const { status, rejectionReason, adminId } = req.body || {};

      if (!docId || !status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Valid status ('APPROVED' or 'REJECTED') is required"
        });
      }

      if (status === 'REJECTED' && !rejectionReason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason/feedback is mandatory when rejecting a document'
        });
      }

      const doc = await get<{
        id: string;
        rider_id: string;
        doc_type: string;
        file_name: string;
      }>('SELECT * FROM rider_documents WHERE id = ?', [docId]);

      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      const now = new Date().toISOString();
      const verifiedBy = adminId || 'ADMIN-OPERATIONS';

      // Update document
      await run(`
        UPDATE rider_documents SET
          status = ?,
          rejection_reason = ?,
          verified_by = ?,
          verified_at = ?,
          updated_at = ?
        WHERE id = ?
      `, [
        status,
        status === 'REJECTED' ? rejectionReason : null,
        verifiedBy,
        now,
        now,
        docId
      ]);

      // Recalculate rider overall status
      const allDocs = await query<{
        doc_type: string;
        status: string;
        rejection_reason?: string;
      }>('SELECT doc_type, status, rejection_reason FROM rider_documents WHERE rider_id = ?', [doc.rider_id]);

      const hasRejections = allDocs.some((d) => d.status === 'REJECTED');
      const requiredTypes = ['aadhaar_front', 'pan_card', 'driving_license', 'profile_selfie'];
      const approvedTypes = allDocs.filter((d) => d.status === 'APPROVED').map((d) => d.doc_type);

      const allRequiredApproved = requiredTypes.every((rt) => approvedTypes.includes(rt));

      let newKycStatus = 'PENDING_VERIFICATION';
      let newOnboardingCompleted = 0;
      let newFeedback: string | null = null;

      if (hasRejections) {
        newKycStatus = 'ACTION_REQUIRED';
        newOnboardingCompleted = 0;
        const rejectedReasons = allDocs
          .filter((d) => d.status === 'REJECTED')
          .map((d) => `${d.doc_type.replace(/_/g, ' ').toUpperCase()}: ${d.rejection_reason}`)
          .join(' | ');
        newFeedback = rejectedReasons;
      } else if (allRequiredApproved) {
        newKycStatus = 'APPROVED';
        newOnboardingCompleted = 1;
        newFeedback = null;
      }

      await run(`
        UPDATE riders SET
          kyc_status = ?,
          onboarding_completed = ?,
          rejection_feedback = ?,
          updated_at = ?
        WHERE id = ?
      `, [newKycStatus, newOnboardingCompleted, newFeedback, now, doc.rider_id]);

      const updatedRider = await riderManager.getRider(doc.rider_id);

      // Real-time WebSocket notification to Rider app
      riderManager.notifyRider(doc.rider_id, {
        type: 'DOCUMENT_VERIFICATION_UPDATED',
        docId,
        docType: doc.doc_type,
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
        kycStatus: newKycStatus,
        onboardingCompleted: newOnboardingCompleted,
        message: status === 'APPROVED'
          ? `Your ${doc.file_name} has been verified and approved!`
          : `Action required on ${doc.file_name}: ${rejectionReason}`
      });

      // Broadcast to Admin consoles
      riderManager.broadcastToAll({
        type: 'ADMIN_DOCUMENT_VERIFIED',
        riderId: doc.rider_id,
        docId,
        status,
        kycStatus: newKycStatus
      });

      logger.info(
        { docId, riderId: doc.rider_id, status, newKycStatus },
        '[AdminController] Document verified & partner KYC state refreshed'
      );

      res.json({
        success: true,
        message: `Document ${status.toLowerCase()} successfully`,
        document: { id: docId, status, rejectionReason },
        rider: updatedRider
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[AdminController] Error in verifyDocument');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 5. Bulk Review Partner (One-click Approve All & Activate or Reject All)
   */
  public static async reviewRider(req: Request, res: Response) {
    try {
      const riderId = req.params.id;
      const { action, feedback, adminId } = req.body || {};

      if (!riderId || !action || !['APPROVE_ALL', 'REJECT_ALL'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: "Valid action ('APPROVE_ALL' or 'REJECT_ALL') is required"
        });
      }

      const rider = await riderManager.getRider(riderId);
      if (!rider) {
        return res.status(404).json({ success: false, error: 'Partner not found' });
      }

      const now = new Date().toISOString();
      const verifiedBy = adminId || 'ADMIN-OPERATIONS';

      if (action === 'APPROVE_ALL') {
        // Approve all docs
        await run(`
          UPDATE rider_documents SET
            status = 'APPROVED',
            rejection_reason = NULL,
            verified_by = ?,
            verified_at = ?,
            updated_at = ?
          WHERE rider_id = ?
        `, [verifiedBy, now, now, riderId]);

        // Activate rider
        await run(`
          UPDATE riders SET
            kyc_status = 'APPROVED',
            onboarding_completed = 1,
            rejection_feedback = NULL,
            penny_drop_status = 'VERIFIED',
            updated_at = ?
          WHERE id = ?
        `, [now, riderId]);

        riderManager.notifyRider(riderId, {
          type: 'ONBOARDING_APPROVED',
          kycStatus: 'APPROVED',
          onboardingCompleted: true,
          message: '🎉 Congratulations! Your profile & documents have been verified. You can now go online and accept delivery orders!'
        });
      } else {
        // Reject all / action required
        const reason = feedback || 'Documents incomplete or invalid. Please re-upload as instructed.';
        await run(`
          UPDATE rider_documents SET
            status = 'REJECTED',
            rejection_reason = ?,
            verified_by = ?,
            verified_at = ?,
            updated_at = ?
          WHERE rider_id = ? AND status != 'APPROVED'
        `, [reason, verifiedBy, now, now, riderId]);

        await run(`
          UPDATE riders SET
            kyc_status = 'ACTION_REQUIRED',
            onboarding_completed = 0,
            is_online = 0,
            rejection_feedback = ?,
            updated_at = ?
          WHERE id = ?
        `, [reason, now, riderId]);

        riderManager.notifyRider(riderId, {
          type: 'ONBOARDING_REJECTED',
          kycStatus: 'ACTION_REQUIRED',
          onboardingCompleted: false,
          rejectionFeedback: reason,
          message: `⚠️ Verification Update: ${reason}`
        });
      }

      const updated = await riderManager.getRider(riderId);

      riderManager.broadcastToAll({
        type: 'ADMIN_PARTNER_REVIEWED',
        riderId,
        action,
        kycStatus: updated?.kyc_status
      });

      res.json({
        success: true,
        action,
        message: action === 'APPROVE_ALL'
          ? 'Delivery partner approved and activated successfully'
          : 'Delivery partner marked action required with feedback',
        rider: updated
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[AdminController] Error in reviewRider');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 6. Toggle Partner Online / Active duty directly from Admin
   */
  public static async togglePartnerStatus(req: Request, res: Response) {
    try {
      const riderId = req.params.id;
      const { isOnline } = req.body || {};

      const rider = await riderManager.getRider(riderId);
      if (!rider) {
        return res.status(404).json({ success: false, error: 'Partner not found' });
      }

      if (isOnline && rider.onboarding_completed !== 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot activate partner before KYC onboarding documents are verified and approved'
        });
      }

      const now = new Date().toISOString();
      await run('UPDATE riders SET is_online = ?, updated_at = ? WHERE id = ?', [
        isOnline ? 1 : 0,
        now,
        riderId
      ]);

      const updated = await riderManager.getRider(riderId);
      res.json({ success: true, rider: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * 7. Admin Login Authentication
   */
  public static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body || {};
      const cleanUser = (username || '').toString().trim().toLowerCase();
      const cleanPass = (password || '').toString();

      const validUsers = ['admin', 'admin@ralt.in', 'ops', 'supervisor'];
      const validPass = process.env.ADMIN_PASSWORD || 'admin123';

      if (validUsers.includes(cleanUser) && cleanPass === validPass) {
        const token = signRiderToken('ADMIN-OPS-SUPERVISOR', '9876543210', 'ADMIN');
        return res.json({
          success: true,
          message: 'Admin authenticated successfully',
          token,
          admin: {
            id: 'ADMIN-OPS-SUPERVISOR',
            name: 'Operations Supervisor',
            role: 'ADMIN',
            username: cleanUser
          }
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid admin username or password'
      });
    } catch (err: any) {
      logger.error({ err: err.message }, '[AdminController] Error in login');
      res.status(500).json({ success: false, error: err.message });
    }
  }
  /**
   * 8. Update Delivery Partner Profile Details (e.g. DOB, Name, License, Bank)
   */
  public static async updateRiderProfile(req: Request, res: Response) {
    try {
      const riderId = req.params.id;
      const { name, dob, father_name, phone, dl_number, pan_number, aadhaar_number, bank_account_number, bank_ifsc } = req.body || {};

      const rider = await riderManager.getRider(riderId);
      if (!rider) {
        return res.status(404).json({ success: false, error: 'Partner not found' });
      }

      const now = new Date().toISOString();
      const updates: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (dob !== undefined) { updates.push('dob = ?'); values.push(dob); }
      if (father_name !== undefined) { updates.push('father_name = ?'); values.push(father_name); }
      if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
      if (dl_number !== undefined) { updates.push('dl_number = ?'); values.push(dl_number); }
      if (pan_number !== undefined) { updates.push('pan_number = ?'); values.push(pan_number); }
      if (aadhaar_number !== undefined) { updates.push('aadhaar_number = ?'); values.push(aadhaar_number); }
      if (bank_account_number !== undefined) { updates.push('bank_account_number = ?'); values.push(bank_account_number); }
      if (bank_ifsc !== undefined) { updates.push('bank_ifsc = ?'); values.push(bank_ifsc); }

      values.push(riderId);
      await run(`UPDATE riders SET ${updates.join(', ')} WHERE id = ?`, values);

      const updated = await riderManager.getRider(riderId);
      res.json({ success: true, rider: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
