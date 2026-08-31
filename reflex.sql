-- Reflex Delivery Coordination System
-- PostgreSQL Schema
-- Purpose: Manage delivery requests, assignments, real-time status tracking for small retailers

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('retailer_staff', 'dispatcher', 'rider');

CREATE TYPE delivery_status AS ENUM ('Requested', 'Assigned', 'PickedUp', 'Delivered', 'Cancelled');

CREATE TYPE rider_availability AS ENUM ('available', 'busy', 'offline');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Retailers: The shops/merchants in the system
CREATE TABLE retailers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    shop_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users: System users across all roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    retailer_id UUID REFERENCES retailers(id) ON DELETE SET NULL,
    availability rider_availability DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

-- Constraint: retailer_staff must belong to a retailer
CONSTRAINT retailer_staff_requires_retailer CHECK (
        (role = 'retailer_staff' AND retailer_id IS NOT NULL) 
        OR (role != 'retailer_staff')
    ),
    -- Constraint: Only riders have availability status
    CONSTRAINT riders_only_have_availability CHECK (
        (role = 'rider') 
        OR (availability IS NULL)
    )
);

-- Delivery Requests: Individual delivery orders
CREATE TABLE delivery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    retailer_id UUID NOT NULL REFERENCES retailers (id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users (id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    delivery_address TEXT NOT NULL,
    item_description TEXT NOT NULL,
    status delivery_status NOT NULL DEFAULT 'Requested',
    confirmation_code TEXT NOT NULL UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assignments: Links a delivery request to a rider (1:1 relationship)
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    request_id UUID NOT NULL UNIQUE REFERENCES delivery_requests (id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES users (id),
    assigned_by UUID NOT NULL REFERENCES users (id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status Updates: Audit trail of all status changes
CREATE TABLE status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    request_id UUID NOT NULL REFERENCES delivery_requests (id) ON DELETE CASCADE,
    status delivery_status NOT NULL,
    updated_by UUID REFERENCES users (id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES: Optimize common queries
-- ============================================================================

-- Users queries
CREATE INDEX idx_users_retailer ON users (retailer_id);

CREATE INDEX idx_users_role ON users (role);

CREATE INDEX idx_users_email ON users (email);

-- Delivery requests queries
CREATE INDEX idx_delivery_requests_retailer ON delivery_requests (retailer_id);

CREATE INDEX idx_delivery_requests_status ON delivery_requests (status);

CREATE INDEX idx_delivery_requests_created_by ON delivery_requests (created_by);

CREATE INDEX idx_delivery_requests_created_at ON delivery_requests (created_at);

-- Assignments queries
CREATE INDEX idx_assignments_rider ON assignments (rider_id);

CREATE INDEX idx_assignments_assigned_by ON assignments (assigned_by);

-- Status updates queries
CREATE INDEX idx_status_updates_request ON status_updates (request_id);

CREATE INDEX idx_status_updates_created_at ON status_updates (created_at);

-- ============================================================================
-- VIEWS: Common queries for app layers
-- ============================================================================

-- Active deliveries with rider info for dispatcher dashboard
CREATE VIEW dispatcher_active_deliveries AS
SELECT
    dr.id,
    dr.retailer_id,
    dr.customer_name,
    dr.customer_phone,
    dr.delivery_address,
    dr.item_description,
    dr.status,
    dr.confirmation_code,
    dr.created_at,
    r.shop_name AS retailer_name,
    COALESCE(u.name, 'Unassigned') AS rider_name,
    u.phone AS rider_phone,
    u.availability AS rider_availability,
    a.assigned_at
FROM
    delivery_requests dr
    LEFT JOIN retailers r ON dr.retailer_id = r.id
    LEFT JOIN assignments a ON dr.id = a.request_id
    LEFT JOIN users u ON a.rider_id = u.id
WHERE
    dr.status IN (
        'Requested',
        'Assigned',
        'PickedUp'
    );

-- Rider's active deliveries with full context
CREATE VIEW rider_deliveries AS
SELECT
    dr.id,
    dr.customer_name,
    dr.customer_phone,
    dr.delivery_address,
    dr.item_description,
    dr.status,
    dr.confirmation_code,
    r.shop_name,
    r.phone AS retailer_phone,
    dr.created_at,
    dr.updated_at,
    a.assigned_at
FROM
    delivery_requests dr
    JOIN assignments a ON dr.id = a.request_id
    JOIN retailers r ON dr.retailer_id = r.id
WHERE
    dr.status IN ('Assigned', 'PickedUp');

-- Retailer's delivery history with status timeline
CREATE VIEW retailer_delivery_history AS
SELECT
    dr.id,
    dr.customer_name,
    dr.delivery_address,
    dr.status,
    dr.confirmation_code,
    COUNT(su.id) AS status_changes,
    MAX(su.created_at) AS last_update,
    dr.created_at
FROM
    delivery_requests dr
    LEFT JOIN status_updates su ON dr.id = su.request_id
GROUP BY
    dr.id,
    dr.customer_name,
    dr.delivery_address,
    dr.status,
    dr.confirmation_code,
    dr.created_at;