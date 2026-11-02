import { Pool, QueryResult } from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './logger';

export interface SpatialRiderMatch {
  id: string;
  name: string;
  phone: string;
  vehicle_number: string;
  vehicle_type: string;
  is_online: number;
  lat: number;
  lng: number;
  current_order_id?: string;
  distance_meters: number;
  distance_km: number;
}

// -----------------------------------------------------------------------------
// PostgreSQL + PostGIS Connection Pool
// -----------------------------------------------------------------------------
let pgPool: Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;
let activeEngine: 'postgres' | 'sqlite' = 'postgres';

export function getActiveEngine(): 'postgres' | 'sqlite' {
  return activeEngine;
}

/**
 * Universal Query Runner (Works seamlessly across PostgreSQL and SQLite fallback)
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (activeEngine === 'postgres' && pgPool) {
    // Convert ? to $1, $2, ... for PostgreSQL
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pgPool.query(pgSql, params);
    return res.rows as T[];
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.all(sql, params, (err: any, rows: any) => {
        if (err) return reject(err);
        resolve((rows || []) as T[]);
      });
    });
  }
  throw new Error('Database not initialized');
}

export async function run(sql: string, params: any[] = []): Promise<{ lastID: number | string; changes: number }> {
  if (activeEngine === 'postgres' && pgPool) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pgPool.query(pgSql, params);
    return { lastID: 0, changes: res.rowCount || 0 };
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.run(sql, params, function (this: any, err: any) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
  throw new Error('Database not initialized');
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

// -----------------------------------------------------------------------------
// PostGIS Spatial Queries
// -----------------------------------------------------------------------------

/**
 * Find nearest online delivery partners using PostGIS ST_DWithin and ST_Distance
 */
export async function findNearestRidersSpatial(
  lat: number,
  lng: number,
  radiusKm: number = 10.0,
  limit: number = 5
): Promise<SpatialRiderMatch[]> {
  if (activeEngine === 'postgres' && pgPool) {
    const radiusMeters = radiusKm * 1000;
    const sql = `
      SELECT 
        id, name, phone, vehicle_number, vehicle_type, is_online, lat, lng, current_order_id,
        ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) AS distance_meters,
        ROUND((ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000.0)::numeric, 2) AS distance_km
      FROM riders
      WHERE is_online = 1
        AND (current_order_id IS NULL OR current_order_id = '')
        AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
      LIMIT $4;
    `;
    const res = await pgPool.query(sql, [lng, lat, radiusMeters, limit]);
    return res.rows.map((r: any) => ({
      ...r,
      distance_meters: parseFloat(r.distance_meters),
      distance_km: parseFloat(r.distance_km)
    }));
  }

  // Fallback Haversine for SQLite
  const riders = await query<any>('SELECT * FROM riders WHERE is_online = 1');
  const scored = riders.map(r => {
    const dLat = ((r.lat - lat) * Math.PI) / 180;
    const dLon = ((r.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) * Math.cos((r.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = parseFloat((6371 * c).toFixed(2));
    return {
      ...r,
      distance_meters: Math.round(distKm * 1000),
      distance_km: distKm
    };
  }).filter(r => r.distance_km <= radiusKm);

  scored.sort((a, b) => a.distance_km - b.distance_km);
  return scored.slice(0, limit);
}

/**
 * Record real-time GPS telemetry breadcrumb with PostGIS spatial geometry point
 */
export async function recordRiderBreadcrumb(
  riderId: string,
  lat: number,
  lng: number,
  heading: number = 0,
  speedKmph: number = 0
): Promise<void> {
  if (activeEngine === 'postgres' && pgPool) {
    await pgPool.query(
      `INSERT INTO driver_breadcrumbs (rider_id, lat, lng, geom, heading, speed_kmph)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326), $4, $5)`,
      [riderId, lat, lng, heading, speedKmph]
    );
  }
}

// -----------------------------------------------------------------------------
// Database Initialization
// -----------------------------------------------------------------------------

async function initPostgres(): Promise<boolean> {
  try {
    pgPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      max: config.db.maxConnections,
      idleTimeoutMillis: config.db.idleTimeoutMillis,
      connectionTimeoutMillis: 5000,
    });

    const client = await pgPool.connect();
    logger.info({ host: config.db.host, port: config.db.port, db: config.db.database }, 'Connected to PostgreSQL');

    // Enable extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Run schema setup from init-dbs.sql if available
    const possiblePaths = [
      path.resolve(__dirname, '../../../packages/database/init-dbs.sql'),
      path.resolve(__dirname, '../../packages/database/init-dbs.sql'),
      path.resolve(__dirname, '../../init-dbs.sql'),
      path.resolve(process.cwd(), 'packages/database/init-dbs.sql'),
      path.resolve(process.cwd(), 'init-dbs.sql')
    ];
    const initSqlPath = possiblePaths.find(p => fs.existsSync(p));
    if (initSqlPath) {
      const sql = fs.readFileSync(initSqlPath, 'utf8');
      await client.query(sql);
      logger.info({ path: initSqlPath }, 'Applied PostGIS schema migrations from init-dbs.sql');
    }

    client.release();
    activeEngine = 'postgres';
    return true;
  } catch (err: any) {
    logger.warn({ err: err.message }, 'PostgreSQL connection failed. Falling back to embedded SQLite for local session...');
    pgPool = null;
    return false;
  }
}

export async function initSqlite(): Promise<void> {
  activeEngine = 'sqlite';
  const dataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'ralt_ondc.db');
  sqliteDb = new sqlite3.Database(dbPath);

  // Setup SQLite schema
  await new Promise<void>((resolve, reject) => {
    sqliteDb!.serialize(() => {
      sqliteDb!.run(`
        CREATE TABLE IF NOT EXISTS riders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          vehicle_number TEXT NOT NULL,
          vehicle_type TEXT DEFAULT "motorcycle",
          is_online INTEGER DEFAULT 1,
          lat REAL DEFAULT 17.4375,
          lng REAL DEFAULT 78.3687,
          current_order_id TEXT,
          father_name TEXT,
          gender TEXT DEFAULT "Male",
          dob TEXT,
          city TEXT DEFAULT "Hyderabad",
          address TEXT,
          emergency_name TEXT,
          emergency_phone TEXT,
          emergency_relation TEXT,
          aadhaar_number TEXT,
          pan_number TEXT,
          dl_number TEXT,
          dl_expiry TEXT,
          insurance_number TEXT,
          bank_account_number TEXT,
          bank_ifsc TEXT,
          bank_name TEXT,
          account_holder_name TEXT,
          upi_id TEXT,
          penny_drop_status TEXT DEFAULT "VERIFIED",
          selfie_url TEXT,
          training_completed INTEGER DEFAULT 1,
          kyc_status TEXT DEFAULT "APPROVED",
          kyc_step INTEGER DEFAULT 5,
          onboarding_completed INTEGER DEFAULT 1,
          rating REAL DEFAULT 5.0,
          total_orders INTEGER DEFAULT 0,
          total_earnings REAL DEFAULT 0.0,
          created_at TEXT,
          updated_at TEXT
        )
      `);

      sqliteDb!.run(`
        CREATE TABLE IF NOT EXISTS orders (
          order_id TEXT PRIMARY KEY,
          transaction_id TEXT,
          message_id TEXT,
          bap_id TEXT,
          bap_uri TEXT,
          status TEXT NOT NULL,
          pickup_name TEXT NOT NULL,
          pickup_phone TEXT,
          pickup_address TEXT NOT NULL,
          pickup_lat REAL,
          pickup_lng REAL,
          drop_name TEXT NOT NULL,
          drop_phone TEXT,
          drop_address TEXT NOT NULL,
          drop_lat REAL,
          drop_lng REAL,
          items_json TEXT,
          delivery_fee REAL DEFAULT 50.0,
          delivery_otp TEXT NOT NULL,
          rider_id TEXT,
          created_at TEXT NOT NULL,
          delivered_at TEXT
        )
      `);

      sqliteDb!.run(`
        CREATE TABLE IF NOT EXISTS earnings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rider_id TEXT NOT NULL,
          order_id TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL
        )
      `);

      sqliteDb!.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          rider_id TEXT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          channel TEXT DEFAULT "PUSH",
          type TEXT DEFAULT "ORDER_UPDATE",
          data TEXT DEFAULT "{}",
          is_read INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `, () => resolve());
    });
  });

  logger.info({ dbPath }, 'Embedded SQLite initialized successfully');
}

export async function initDatabase() {
  const pgSuccess = await initPostgres();
  if (!pgSuccess) {
    await initSqlite();
  }

  // Ensure documents and chunking tables exist across engines
  if (activeEngine === 'postgres') {
    await run(`
      CREATE TABLE IF NOT EXISTS rider_documents (
        id VARCHAR(64) PRIMARY KEY,
        rider_id VARCHAR(64) NOT NULL,
        doc_type VARCHAR(64) NOT NULL,
        doc_number VARCHAR(64),
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        file_size INTEGER NOT NULL,
        file_data TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING_VERIFICATION',
        rejection_reason TEXT,
        verified_by VARCHAR(64),
        verified_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS document_upload_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        rider_id VARCHAR(64) NOT NULL,
        doc_type VARCHAR(64) NOT NULL,
        doc_number VARCHAR(64),
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        total_chunks INTEGER NOT NULL,
        total_size INTEGER NOT NULL,
        uploaded_chunks INTEGER DEFAULT 0,
        status VARCHAR(32) DEFAULT 'UPLOADING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id BIGSERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_data TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try { await run('ALTER TABLE riders ADD COLUMN IF NOT EXISTS rejection_feedback TEXT'); } catch (_) {}
  } else {
    await run(`
      CREATE TABLE IF NOT EXISTS rider_documents (
        id TEXT PRIMARY KEY,
        rider_id TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        doc_number TEXT,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_data TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING_VERIFICATION',
        rejection_reason TEXT,
        verified_by TEXT,
        verified_at TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS document_upload_sessions (
        session_id TEXT PRIMARY KEY,
        rider_id TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        doc_number TEXT,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        total_chunks INTEGER NOT NULL,
        total_size INTEGER NOT NULL,
        uploaded_chunks INTEGER DEFAULT 0,
        status TEXT DEFAULT 'UPLOADING',
        created_at TEXT
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_data TEXT NOT NULL,
        created_at TEXT
      )
    `);
    try { await run('ALTER TABLE riders ADD COLUMN rejection_feedback TEXT'); } catch (_) {}
    try { await run('ALTER TABLE riders ADD COLUMN email TEXT'); } catch (_) {}
    try { await run('ALTER TABLE riders ADD COLUMN is_active INTEGER DEFAULT 1'); } catch (_) {}
  }

  // Test fixture ONLY: seeded during automated Jest tests so test suites pass
  if (process.env.NODE_ENV === 'test') {
    try {
      const existing = await get('SELECT id FROM riders WHERE id = ?', ['RALT-RIDER-001']);
      if (!existing) {
        await run(`
          INSERT INTO riders (
            id, name, phone, vehicle_type, vehicle_number, dl_number,
            pan_number, aadhaar_number, bank_account_number, bank_ifsc,
            kyc_status, is_active, is_online, onboarding_completed, created_at, updated_at
          ) VALUES (
            'RALT-RIDER-001', 'Test Rider Fixture', '9876543210',
            'Motorcycle', 'TS09EA1234', 'TS0920190012345', 'ABCDE1234F',
            '548912349876', '123456789012', 'HDFC0001234',
            'APPROVED', 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `);
      }
    } catch (_) {}
  }

  // Database tables ready - No mock/dummy riders in development or production
  logger.info('Database schema verified. Ready for real delivery partner registrations.');
}

export async function resetEntireDatabase() {
  await run('DELETE FROM document_chunks');
  await run('DELETE FROM document_upload_sessions');
  await run('DELETE FROM rider_documents');
  await run('DELETE FROM orders');
  await run('DELETE FROM earnings');
  await run('DELETE FROM notifications');
  await run('DELETE FROM riders');
  logger.info('Database reset complete: all tables cleared cleanly.');
}

export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    if (activeEngine === 'postgres' && pgPool) {
      await pgPool.query('SELECT 1');
      return true;
    }
    return true; // SQLite is healthy if active
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pgPool) {
    const pool = pgPool;
    pgPool = null;
    await pool.end().catch(() => {});
  }
  if (sqliteDb) {
    const db = sqliteDb;
    sqliteDb = null;
    await new Promise(resolve => db.close(() => resolve(null))).catch(() => {});
  }
}
