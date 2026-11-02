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

-- 7. Seed Initial Active Delivery Partner (Sai Raju)
INSERT INTO riders (
  id, name, phone, city, address, vehicle_number, vehicle_type,
  is_online, lat, lng, geom, father_name, dob, gender,
  emergency_name, emergency_phone, emergency_relation,
  aadhaar_number, pan_number, dl_number, dl_expiry, insurance_number,
  bank_account_number, bank_ifsc, bank_name, account_holder_name, upi_id,
  penny_drop_status, selfie_url, training_completed, kyc_status,
  kyc_step, onboarding_completed, rating, total_orders, total_earnings
) VALUES (
  'RALT-RIDER-001', 'Sai Raju', '+91 9876543210', 'Hyderabad', 'Hitec City, Hyderabad', 'TS 09 EA 1234', 'motorcycle',
  1, 17.4375, 78.3687, ST_SetSRID(ST_MakePoint(78.3687, 17.4375), 4326),
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

