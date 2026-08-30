-- Reflex database schema
-- Matches the project ERD. This is a self-hosted equivalent of the Supabase
-- "profiles" design: since we run our own auth here (no Supabase auth.users
-- table to avoid colliding with), the table is simply called "users".

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS retailers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name   TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('retailer_staff', 'dispatcher', 'rider')),
  name           TEXT NOT NULL,
  phone          TEXT,
  retailer_id    UUID REFERENCES retailers(id) ON DELETE SET NULL,
  availability   TEXT CHECK (availability IN ('available', 'busy')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retailer_id_only_for_staff CHECK (
    (role = 'retailer_staff' AND retailer_id IS NOT NULL) OR
    (role != 'retailer_staff')
  ),
  CONSTRAINT availability_only_for_riders CHECK (
    (role = 'rider') OR (availability IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS delivery_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id        UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  created_by         UUID NOT NULL REFERENCES users(id),
  customer_name      TEXT NOT NULL,
  customer_phone     TEXT,
  address            TEXT NOT NULL,
  item_description   TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'Requested'
                        CHECK (status IN ('Requested', 'Assigned', 'PickedUp', 'Delivered')),
  confirmation_code  TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL UNIQUE REFERENCES delivery_requests(id) ON DELETE CASCADE,
  rider_id      UUID NOT NULL REFERENCES users(id),
  assigned_by   UUID NOT NULL REFERENCES users(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS status_updates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,
  updated_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_retailer ON delivery_requests(retailer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_status_updates_request ON status_updates(request_id);
CREATE INDEX IF NOT EXISTS idx_assignments_rider ON assignments(rider_id);
