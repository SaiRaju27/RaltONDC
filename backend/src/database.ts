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

  // Safe migrations for Rider KYC & Zomato Onboarding columns
  try { await run('ALTER TABLE riders ADD COLUMN father_name TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN gender TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN emergency_relation TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN account_holder_name TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN kyc_step INTEGER DEFAULT 1'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN onboarding_completed INTEGER DEFAULT 0'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN rating REAL DEFAULT 5.0'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN total_orders INTEGER DEFAULT 0'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN total_earnings REAL DEFAULT 0.0'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN created_at TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN upi_id TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN dl_number TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN dl_expiry TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN aadhaar_number TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN pan_number TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN city TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN address TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN dob TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN emergency_name TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN emergency_phone TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN vehicle_type TEXT DEFAULT "motorcycle"'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN insurance_number TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN bank_account_number TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN bank_ifsc TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN bank_name TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN penny_drop_status TEXT DEFAULT "PENDING"'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN selfie_url TEXT'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN training_completed INTEGER DEFAULT 0'); } catch (_) {}
  try { await run('ALTER TABLE riders ADD COLUMN kyc_status TEXT DEFAULT "PENDING"'); } catch (_) {}

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

  // Ensure 1 active default rider exists in the database
  const existingRider = await get('SELECT id FROM riders WHERE id = ? OR phone LIKE ? LIMIT 1', ['RALT-RIDER-001', '%9876543210']);
  if (!existingRider) {
    const now = new Date().toISOString();
    await run(`
      INSERT INTO riders (
        id, name, phone, city, address, vehicle_number, vehicle_type,
        is_online, lat, lng, father_name, dob, gender,
        emergency_name, emergency_phone, emergency_relation,
        aadhaar_number, pan_number, dl_number, dl_expiry, insurance_number,
        bank_account_number, bank_ifsc, bank_name, account_holder_name, upi_id,
        penny_drop_status, selfie_url, training_completed, kyc_status,
        kyc_step, onboarding_completed, rating, total_orders, total_earnings,
        created_at, updated_at
      ) VALUES (
        'RALT-RIDER-001', 'Sai Raju', '+91 9876543210', 'Hyderabad', 'Hitec City, Hyderabad', 'TS 09 EA 1234', 'motorcycle',
        1, 17.4375, 78.3687, 'Ram Raju', '1998-05-15', 'Male',
        'Emergency Contact', '+91 9876500000', 'Brother',
        '548912349876', 'ABCDE1234F', 'TS0920190012345', '2030-12-31', 'POL-9921',
        '987654321012', 'HDFC0001234', 'HDFC Bank', 'Sai Raju', 'sairaju@okhdfcbank',
        'VERIFIED', '', 1, 'APPROVED',
        5, 1, 5.0, 0, 0.0,
        ?, ?
      )
    `, [now, now]);
    console.log('[Database] Seeded 1 clean active rider: RALT-RIDER-001 (Sai Raju, 9876543210)');
  }
}

/**
 * Erase entire mock data and re-initialize with 1 clean user
 */
export async function resetEntireDatabase() {
  await run('DELETE FROM orders');
  await run('DELETE FROM earnings');
  await run('DELETE FROM riders');

  const now = new Date().toISOString();
  await run(`
    INSERT INTO riders (
      id, name, phone, city, address, vehicle_number, vehicle_type,
      is_online, lat, lng, father_name, dob, gender,
      emergency_name, emergency_phone, emergency_relation,
      aadhaar_number, pan_number, dl_number, dl_expiry, insurance_number,
      bank_account_number, bank_ifsc, bank_name, account_holder_name, upi_id,
      penny_drop_status, selfie_url, training_completed, kyc_status,
      kyc_step, onboarding_completed, rating, total_orders, total_earnings,
      created_at, updated_at
    ) VALUES (
      'RALT-RIDER-001', 'Sai Raju', '+91 9876543210', 'Hyderabad', 'Hitec City, Hyderabad', 'TS 09 EA 1234', 'motorcycle',
      1, 17.4375, 78.3687, 'Ram Raju', '1998-05-15', 'Male',
      'Emergency Contact', '+91 9876500000', 'Brother',
      '548912349876', 'ABCDE1234F', 'TS0920190012345', '2030-12-31', 'POL-9921',
      '987654321012', 'HDFC0001234', 'HDFC Bank', 'Sai Raju', 'sairaju@okhdfcbank',
      'VERIFIED', '', 1, 'APPROVED',
      5, 1, 5.0, 0, 0.0,
      ?, ?
    )
  `, [now, now]);
  console.log('[Database] Reset complete: all tables cleared and 1 clean active rider seeded.');
}

export default db;

