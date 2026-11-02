-- ==============================================================================
-- RALT ONDC Logistics Service Provider (BPP) — PostGIS Database Schema
-- Point-to-Point Hyperlocal Delivery (P2P - ONDC:LOG10)
-- ==============================================================================

-- 1. Enable Core Spatial & UUID Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Delivery Partner / Rider Table with Spatial Index
CREATE TABLE IF NOT EXISTS riders (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  city VARCHAR(64) DEFAULT 'Hyderabad',
  address TEXT,
  vehicle_number VARCHAR(32),
  vehicle_type VARCHAR(32) DEFAULT 'motorcycle',
  is_online INTEGER DEFAULT 1,
  lat DOUBLE PRECISION DEFAULT 17.4375,
  lng DOUBLE PRECISION DEFAULT 78.3687,
  geom geometry(Point, 4326),
  current_order_id VARCHAR(64),
  father_name VARCHAR(128),
  gender VARCHAR(32) DEFAULT 'Male',
  dob VARCHAR(32),
  emergency_name VARCHAR(128),
  emergency_phone VARCHAR(32),
  emergency_relation VARCHAR(64),
  aadhaar_number VARCHAR(32),
  pan_number VARCHAR(32),
  dl_number VARCHAR(64),
  dl_expiry VARCHAR(32),
  insurance_number VARCHAR(64),
  bank_account_number VARCHAR(64),
  bank_ifsc VARCHAR(32),
  bank_name VARCHAR(128),
  account_holder_name VARCHAR(128),
  upi_id VARCHAR(128),
  penny_drop_status VARCHAR(32) DEFAULT 'VERIFIED',
  selfie_url TEXT,
  training_completed INTEGER DEFAULT 1,
  kyc_status VARCHAR(32) DEFAULT 'APPROVED',
  kyc_step INTEGER DEFAULT 5,
  onboarding_completed INTEGER DEFAULT 1,
  rating DOUBLE PRECISION DEFAULT 5.0,
  total_orders INTEGER DEFAULT 0,
  total_earnings DOUBLE PRECISION DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auto-sync spatial geom column on insert or update
CREATE OR REPLACE FUNCTION sync_rider_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_rider_geom ON riders;
CREATE TRIGGER trg_sync_rider_geom
BEFORE INSERT OR UPDATE ON riders
FOR EACH ROW EXECUTE FUNCTION sync_rider_geom();

CREATE INDEX IF NOT EXISTS idx_riders_geom ON riders USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_riders_online ON riders (is_online);
CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders (phone);

-- 3. ONDC Orders Table
CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(64) PRIMARY KEY,
  transaction_id VARCHAR(128),
  message_id VARCHAR(128),
  bap_id VARCHAR(128),
  bap_uri TEXT,
  status VARCHAR(64) NOT NULL,
  pickup_name VARCHAR(128) NOT NULL,
  pickup_phone VARCHAR(32),
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  pickup_geom geometry(Point, 4326),
  drop_name VARCHAR(128) NOT NULL,
  drop_phone VARCHAR(32),
  drop_address TEXT NOT NULL,
  drop_lat DOUBLE PRECISION,
  drop_lng DOUBLE PRECISION,
  drop_geom geometry(Point, 4326),
  items_json JSONB DEFAULT '[]'::jsonb,
  delivery_fee DOUBLE PRECISION DEFAULT 50.0,
  delivery_otp VARCHAR(16) NOT NULL,
  rider_id VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE OR REPLACE FUNCTION sync_order_geoms()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pickup_lat IS NOT NULL AND NEW.pickup_lng IS NOT NULL THEN
    NEW.pickup_geom := ST_SetSRID(ST_MakePoint(NEW.pickup_lng, NEW.pickup_lat), 4326);
  END IF;
  IF NEW.drop_lat IS NOT NULL AND NEW.drop_lng IS NOT NULL THEN
    NEW.drop_geom := ST_SetSRID(ST_MakePoint(NEW.drop_lng, NEW.drop_lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_geoms ON orders;
CREATE TRIGGER trg_sync_order_geoms
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_order_geoms();

CREATE INDEX IF NOT EXISTS idx_orders_pickup_geom ON orders USING GIST (pickup_geom);
CREATE INDEX IF NOT EXISTS idx_orders_drop_geom ON orders USING GIST (drop_geom);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders (rider_id);

-- 4. Rider Earnings Ledger
CREATE TABLE IF NOT EXISTS earnings (
  id BIGSERIAL PRIMARY KEY,
  rider_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_earnings_rider ON earnings (rider_id);

-- 5. Real-Time Telemetry & Driver Breadcrumbs (Spatial GPS Streams)
CREATE TABLE IF NOT EXISTS driver_breadcrumbs (
  id BIGSERIAL PRIMARY KEY,
  rider_id VARCHAR(64) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geom geometry(Point, 4326),
  heading DOUBLE PRECISION,
  speed_kmph DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_geom ON driver_breadcrumbs USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_rider ON driver_breadcrumbs (rider_id, created_at DESC);

-- 6. Enterprise Notification System (Push, SMS, In-App)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  rider_id VARCHAR(64),
  title VARCHAR(128) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(32) DEFAULT 'PUSH',
  type VARCHAR(32) DEFAULT 'ORDER_UPDATE',
  data JSONB DEFAULT '{}'::jsonb,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_rider ON notifications (rider_id, created_at DESC);

-- 7. Document Storage & Verification Tables (Zomato Partner Compliance)
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
);

CREATE INDEX IF NOT EXISTS idx_docs_rider ON rider_documents (rider_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_docs_status ON rider_documents (status);

-- 8. Chunked Document Upload Sessions & Parts (Worker Queue Processing)
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
);

CREATE INDEX IF NOT EXISTS idx_sessions_rider ON document_upload_sessions (rider_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_session ON document_chunks (session_id, chunk_index);

ALTER TABLE riders ADD COLUMN IF NOT EXISTS rejection_feedback TEXT;

-- 9. Seed Initial Active Delivery Partner (Sai Raju)
INSERT INTO riders (
  id, name, phone, city, address, vehicle_number, vehicle_type,
  is_online, lat, lng, geom, father_name, dob, gender,
  emergency_name, emergency_phone, emergency_relation,
  aadhaar_number, pan_number, dl_number, dl_expiry, insurance_number,
  bank_account_number, bank_ifsc, bank_name, account_holder_name, upi_id,
  penny_drop_status, selfie_url, training_completed, kyc_status,
  kyc_step, onboarding_completed, rating, total_orders, total_earnings
) VALUES (
  'RALT-RIDER-001', 'Sai Raju', '+91 9876543210', 'Hyderabad', 'LB Nagar, Hyderabad', 'TS 09 EA 1234', 'motorcycle',
  1, 17.3457, 78.5522, ST_SetSRID(ST_MakePoint(78.5522, 17.3457), 4326),
  'Ram Raju', '1998-05-15', 'Male',
  'Emergency Contact', '+91 9876500000', 'Brother',
  '548912349876', 'ABCDE1234F', 'TS0920190012345', '2030-12-31', 'POL-9921',
  '987654321012', 'HDFC0001234', 'HDFC Bank', 'Sai Raju', 'sairaju@okhdfcbank',
  'VERIFIED', '', 1, 'APPROVED',
  5, 1, 5.0, 0, 0.0
)
ON CONFLICT (id) DO UPDATE SET
  is_online = 1,
  kyc_status = 'APPROVED',
  onboarding_completed = 1,
  updated_at = CURRENT_TIMESTAMP;

-- Seed verified documents for default partner (Sai Raju)
INSERT INTO rider_documents (
  id, rider_id, doc_type, doc_number, file_name, mime_type, file_size, file_data, status, verified_by, verified_at
) VALUES 
('DOC-SEED-001', 'RALT-RIDER-001', 'aadhaar_front', '548912349876', 'aadhaar_front.jpg', 'image/jpeg', 10240, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%23f1f5f9" rx="10"/><text x="150" y="40" font-family="Arial" font-size="14" font-weight="bold" fill="%230f172a" text-anchor="middle">GOVERNMENT OF INDIA</text><text x="150" y="70" font-family="Arial" font-size="12" fill="%232563eb" text-anchor="middle">AADHAAR CARD (FRONT)</text><text x="150" y="110" font-family="Arial" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">5489 1234 9876</text><text x="150" y="140" font-family="Arial" font-size="12" fill="%2316a34a" text-anchor="middle">NAME: SAI RAJU</text></svg>', 'APPROVED', 'ADMIN-SYSTEM', CURRENT_TIMESTAMP),
('DOC-SEED-002', 'RALT-RIDER-001', 'pan_card', 'ABCDE1234F', 'pan_card.jpg', 'image/jpeg', 9500, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%23f8fafc" rx="10"/><text x="150" y="40" font-family="Arial" font-size="14" font-weight="bold" fill="%230f172a" text-anchor="middle">INCOME TAX DEPARTMENT</text><text x="150" y="70" font-family="Arial" font-size="12" fill="%230284c7" text-anchor="middle">PERMANENT ACCOUNT NUMBER</text><text x="150" y="110" font-family="Arial" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">ABCDE1234F</text><text x="150" y="140" font-family="Arial" font-size="12" fill="%2316a34a" text-anchor="middle">NAME: SAI RAJU</text></svg>', 'APPROVED', 'ADMIN-SYSTEM', CURRENT_TIMESTAMP),
('DOC-SEED-003', 'RALT-RIDER-001', 'driving_license', 'TS0920190012345', 'driving_license.jpg', 'image/jpeg', 11200, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%23f0fdf4" rx="10"/><text x="150" y="40" font-family="Arial" font-size="14" font-weight="bold" fill="%2315803d" text-anchor="middle">INDIAN DRIVING LICENCE</text><text x="150" y="70" font-family="Arial" font-size="12" fill="%23334155" text-anchor="middle">TRANSPORT DEPT TELANGANA</text><text x="150" y="110" font-family="Arial" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">TS09 2019 0012345</text><text x="150" y="140" font-family="Arial" font-size="12" fill="%2316a34a" text-anchor="middle">VALID TILL: 2030-12-31</text></svg>', 'APPROVED', 'ADMIN-SYSTEM', CURRENT_TIMESTAMP),
('DOC-SEED-004', 'RALT-RIDER-001', 'profile_selfie', '', 'profile_selfie.jpg', 'image/jpeg', 8400, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="%23dcfce7"/><circle cx="100" cy="80" r="35" fill="%2316a34a"/><path d="M 40 160 C 40 125, 160 125, 160 160 Z" fill="%2316a34a"/><text x="100" y="185" font-family="Arial" font-size="12" font-weight="bold" fill="%2314532d" text-anchor="middle">VERIFIED PARTNER</text></svg>', 'APPROVED', 'ADMIN-SYSTEM', CURRENT_TIMESTAMP),
('DOC-SEED-005', 'RALT-RIDER-001', 'vehicle_rc', 'TS 09 EA 1234', 'rc_certificate.jpg', 'image/jpeg', 9800, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%23fef3c7" rx="10"/><text x="150" y="40" font-family="Arial" font-size="14" font-weight="bold" fill="%23b45309" text-anchor="middle">CERTIFICATE OF REGISTRATION</text><text x="150" y="70" font-family="Arial" font-size="12" fill="%23334155" text-anchor="middle">TWO WHEELER - MOTORCYCLE</text><text x="150" y="110" font-family="Arial" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">TS 09 EA 1234</text><text x="150" y="140" font-family="Arial" font-size="12" fill="%2316a34a" text-anchor="middle">STATUS: ACTIVE & INSURED</text></svg>', 'APPROVED', 'ADMIN-SYSTEM', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

