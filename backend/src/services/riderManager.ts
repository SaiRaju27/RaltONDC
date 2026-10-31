import { WebSocket } from 'ws';
import { query, run, get } from '../database';

export interface RiderRecord {
  id: string;
  name: string;
  phone: string;
  vehicle_number: string;
  is_online: number;
  lat: number;
  lng: number;
  current_order_id?: string;
  updated_at: string;
}

class RiderManager {
  private activeSockets: Map<string, WebSocket> = new Map();

  public registerSocket(riderId: string, ws: WebSocket) {
    this.activeSockets.set(riderId, ws);
  }

  public removeSocket(riderId: string) {
    this.activeSockets.delete(riderId);
  }

  public notifyRider(riderId: string, payload: any) {
    const ws = this.activeSockets.get(riderId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  public broadcastToAll(payload: any) {
    const data = JSON.stringify(payload);
    for (const ws of this.activeSockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  public async getRider(riderId: string): Promise<RiderRecord | undefined> {
    return await get<RiderRecord>('SELECT * FROM riders WHERE id = ?', [riderId]);
  }

  public async getAllRiders(): Promise<RiderRecord[]> {
    return await query<RiderRecord>('SELECT * FROM riders');
  }

  public async toggleOnline(riderId: string, isOnline: boolean): Promise<RiderRecord | undefined> {
    await run('UPDATE riders SET is_online = ?, updated_at = ? WHERE id = ?', [
      isOnline ? 1 : 0,
      new Date().toISOString(),
      riderId
    ]);
    const updated = await this.getRider(riderId);
    this.notifyRider(riderId, {
      type: 'STATUS_UPDATED',
      isOnline: isOnline
    });
    return updated;
  }

  public async updateLocation(riderId: string, lat: number, lng: number): Promise<void> {
    await run('UPDATE riders SET lat = ?, lng = ?, updated_at = ? WHERE id = ?', [
      lat,
      lng,
      new Date().toISOString(),
      riderId
    ]);
  }

  public async assignOrderToRider(riderId: string, orderId: string): Promise<void> {
    await run('UPDATE riders SET current_order_id = ? WHERE id = ?', [orderId, riderId]);
  }

  public async clearRiderOrder(riderId: string): Promise<void> {
    await run('UPDATE riders SET current_order_id = NULL WHERE id = ?', [riderId]);
  }

  public async findAvailableRider(lat?: number, lng?: number): Promise<RiderRecord | undefined> {
    // Find first online rider without an active pending order
    const rider = await get<RiderRecord>(
      'SELECT * FROM riders WHERE is_online = 1 AND (current_order_id IS NULL OR current_order_id = "") LIMIT 1'
    );
    return rider;
  }

  public async getEarnings(riderId: string): Promise<{ total: number; count: number; history: any[] }> {
    const history = await query(
      'SELECT * FROM earnings WHERE rider_id = ? ORDER BY id DESC',
      [riderId]
    );
    const sumResult = await get<{ total: number }>(
      'SELECT SUM(amount) as total FROM earnings WHERE rider_id = ?',
      [riderId]
    );
    const total = sumResult?.total || 0;
    return {
      total,
      count: history.length,
      history
    };
  }
}

export const riderManager = new RiderManager();
