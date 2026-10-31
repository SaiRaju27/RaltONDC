import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ralt_ondc.db');
const db = new sqlite3.Database(dbPath);

// Helper for promise-based queries
export function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []) as T[]);
    });
  });
}

export function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row as T);
    });
  });
}

/**
 * Initialize Database Schema
 */
export async function initDatabase() {
  // Riders Table
  await run(`
    CREATE TABLE IF NOT EXISTS riders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      is_online INTEGER DEFAULT 1,
      lat REAL DEFAULT 17.4375,
      lng REAL DEFAULT 78.3687,
      current_order_id TEXT,
      updated_at TEXT
    )
  `);

  // Orders Table
  await run(`
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

  // Earnings Ledger Table
  await run(`
    CREATE TABLE IF NOT EXISTS earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rider_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Seed default rider if not exists (Persistent rider profile)
  const existingRider = await get('SELECT id FROM riders WHERE id = ?', ['rider-ralt-001']);
  if (!existingRider) {
    await run(`
      INSERT INTO riders (id, name, phone, vehicle_number, is_online, lat, lng, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'rider-ralt-001',
      'Raju Kumar (RALT Rider)',
      '+91 98765 43210',
      'TS-09-EA-1234',
      1,
      17.4375, // Gachibowli / Hitec City, Hyderabad
      78.3687,
      new Date().toISOString()
    ]);
    console.log('[Database] Seeded initial rider profile: Raju Kumar (rider-ralt-001)');
  }
}

export default db;

