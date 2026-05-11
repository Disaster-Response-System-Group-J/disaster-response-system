-- Migration: Create Incidents, Resources, and Alerts schema
-- Run this against your Supabase/PostgreSQL database.
-- Supports:
--   1) Users & Roles management
--   2) Incoming reports (from J1 SOS app, sensors, public portal)
--   3) Confirmed incidents (verified & escalated reports)
--   4) Resources (rescue teams, boats, shelters, etc.)
--   5) Alerts (risk, public, resource-related)

-- =====================================================================
-- ENUM TYPES
-- =====================================================================

-- User roles
CREATE TYPE user_role AS ENUM (
    'PUBLIC_USER',
    'INCIDENT_COMMANDER_NATIONAL',
    'INCIDENT_COMMANDER_ZONAL',
    'OPERATIONS_OFFICER_NATIONAL',
    'OPERATIONS_OFFICER_ZONAL',
    'RESOURCE_MANAGER_NATIONAL',
    'RESOURCE_MANAGER_ZONAL',
    'SYSTEM_ADMIN'
);

-- Report & Incident classification
CREATE TYPE disaster_type AS ENUM (
    'FLOOD',
    'LANDSLIDE',
    'DROUGHT',
    'OTHER'
);

CREATE TYPE report_source AS ENUM (
    'J1_SOS_APP',
    'J3_PUBLIC_PORTAL',
    'J1_SENSOR_SYSTEM',
    'WEATHER_API',
    'OFFICER_CREATED'
);

CREATE TYPE verification_status AS ENUM (
    'PENDING_REVIEW',
    'VERIFIED',
    'REJECTED',
    'DUPLICATE',
    'CONVERTED_TO_INCIDENT'
);

CREATE TYPE incident_severity AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE incident_status AS ENUM (
    'ACTIVE',
    'UNDER_RESPONSE',
    'RESOLVED',
    'CLOSED'
);

-- Resources
CREATE TYPE resource_type AS ENUM (
    'RESCUE_TEAM',
    'BOAT',
    'AMBULANCE',
    'SHELTER',
    'MEDICAL_TEAM',
    'FOOD_WATER'
);

CREATE TYPE resource_status AS ENUM (
    'AVAILABLE',
    'ASSIGNED',
    'BUSY',
    'OUT_OF_SERVICE'
);

-- Alerts
CREATE TYPE alert_type AS ENUM (
    'RISK_ALERT',
    'PUBLIC_ALERT',
    'SHELTER_CAPACITY',
    'RESOURCE_SHORTAGE',
    'INCIDENT_STATUS'
);

-- =====================================================================
-- USERS & ROLES
-- =====================================================================
CREATE TABLE IF NOT EXISTS "User" (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   VARCHAR(255) NOT NULL UNIQUE,
    name                    VARCHAR(255) NOT NULL,
    role                    user_role NOT NULL DEFAULT 'PUBLIC_USER',
    "assignedDistrict"      VARCHAR(120),
    "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_role ON "User"(role);
CREATE INDEX IF NOT EXISTS idx_user_district ON "User"("assignedDistrict");

COMMENT ON TABLE "User" IS 'System users with role-based access control and district assignment';
COMMENT ON COLUMN "User".role IS 'User role determining permission level and access scope';
COMMENT ON COLUMN "User"."assignedDistrict" IS 'ALL for National scope, or specific district name for Zonal scope';

-- =====================================================================
-- CONFIRMED INCIDENTS (Primary incident records)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "ConfirmedIncident" (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   VARCHAR(255) NOT NULL,
    "disasterType"          disaster_type NOT NULL,
    district                VARCHAR(120) NOT NULL,
    severity                incident_severity NOT NULL,
    status                  incident_status NOT NULL DEFAULT 'ACTIVE',
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    description             TEXT,
    "publicVisibility"      BOOLEAN NOT NULL DEFAULT TRUE,
    "affectedPeople"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_incident_coordinates CHECK (
        latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180
    ),
    CONSTRAINT chk_incident_affected_people CHECK ("affectedPeople" >= 0)
);

CREATE INDEX IF NOT EXISTS idx_confirmed_incident_district ON "ConfirmedIncident"(district);
CREATE INDEX IF NOT EXISTS idx_confirmed_incident_status ON "ConfirmedIncident"(status);
CREATE INDEX IF NOT EXISTS idx_confirmed_incident_severity ON "ConfirmedIncident"(severity);
CREATE INDEX IF NOT EXISTS idx_confirmed_incident_disaster_type ON "ConfirmedIncident"("disasterType");
CREATE INDEX IF NOT EXISTS idx_confirmed_incident_created_at ON "ConfirmedIncident"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_confirmed_incident_coordinates ON "ConfirmedIncident"(latitude, longitude);

COMMENT ON TABLE "ConfirmedIncident" IS 'Verified and escalated disaster incidents requiring coordinated response';

COMMENT ON COLUMN "ConfirmedIncident"."publicVisibility" IS 'If TRUE, incident details visible to public via J3 portal';

-- =====================================================================
-- INCOMING REPORTS (From SOS app, sensors, public portal)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "IncomingReport" (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source                  report_source NOT NULL,
    "disasterType"          disaster_type NOT NULL,
    district                VARCHAR(120) NOT NULL,
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    description             TEXT NOT NULL,
    contact                 VARCHAR(255),
    "mediaUrls"             TEXT[],
    "verificationStatus"    verification_status NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- External IDs (from J1 or Sensors)
    "sosId"                 VARCHAR(128),
    "deviceId"              VARCHAR(128),

    -- Review tracking
    "officerNotes"          TEXT,
    "reviewedById"          UUID,
    "reviewedAt"            TIMESTAMPTZ,

    -- Relation to confirmed incident (if elevated)
    "incidentId"            UUID,

    CONSTRAINT fk_incoming_report_reviewer 
        FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE SET NULL,
    CONSTRAINT fk_incoming_report_incident 
        FOREIGN KEY ("incidentId") REFERENCES "ConfirmedIncident"(id) ON DELETE SET NULL,
    CONSTRAINT chk_report_coordinates CHECK (
        latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180
    )
);

CREATE INDEX IF NOT EXISTS idx_incoming_report_source ON "IncomingReport"(source);
CREATE INDEX IF NOT EXISTS idx_incoming_report_status ON "IncomingReport"("verificationStatus");
CREATE INDEX IF NOT EXISTS idx_incoming_report_disaster_type ON "IncomingReport"("disasterType");
CREATE INDEX IF NOT EXISTS idx_incoming_report_district ON "IncomingReport"(district);
CREATE INDEX IF NOT EXISTS idx_incoming_report_created_at ON "IncomingReport"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_incoming_report_sos_id ON "IncomingReport"("sosId");
CREATE INDEX IF NOT EXISTS idx_incoming_report_device_id ON "IncomingReport"("deviceId");
CREATE INDEX IF NOT EXISTS idx_incoming_report_incident_id ON "IncomingReport"("incidentId");
CREATE INDEX IF NOT EXISTS idx_incoming_report_coordinates ON "IncomingReport"(latitude, longitude);

COMMENT ON TABLE "IncomingReport" IS 'Initial reports from J1 SOS app, sensor systems, and public portal awaiting verification';

COMMENT ON COLUMN "IncomingReport"."mediaUrls" IS 'Array of URLs to photos/videos attached to report';

COMMENT ON COLUMN "IncomingReport"."reviewedById" IS 'ID of officer who verified/rejected the report';

-- =====================================================================
-- RESOURCES (Rescue teams, boats, ambulances, shelters, etc.)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Resource" (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                    resource_type NOT NULL,
    name                    VARCHAR(255) NOT NULL,
    district                VARCHAR(120) NOT NULL,
    status                  resource_status NOT NULL DEFAULT 'AVAILABLE',
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    capacity                INTEGER,
    "currentLoad"           INTEGER,
    "lastUpdated"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Assignment tracking
    "incidentId"            UUID,

    CONSTRAINT fk_resource_incident 
        FOREIGN KEY ("incidentId") REFERENCES "ConfirmedIncident"(id) ON DELETE SET NULL,
    CONSTRAINT chk_resource_coordinates CHECK (
        latitude IS NULL OR (latitude >= -90 AND latitude <= 90)
        AND longitude IS NULL OR (longitude >= -180 AND longitude <= 180)
    ),
    CONSTRAINT chk_resource_capacity CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT chk_resource_current_load CHECK (
        "currentLoad" IS NULL OR ("currentLoad" >= 0 AND (capacity IS NULL OR "currentLoad" <= capacity))
    )
);

CREATE INDEX IF NOT EXISTS idx_resource_type ON "Resource"(type);
CREATE INDEX IF NOT EXISTS idx_resource_status ON "Resource"(status);
CREATE INDEX IF NOT EXISTS idx_resource_district ON "Resource"(district);
CREATE INDEX IF NOT EXISTS idx_resource_incident_id ON "Resource"("incidentId");
CREATE INDEX IF NOT EXISTS idx_resource_coordinates ON "Resource"(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_resource_updated_at ON "Resource"("lastUpdated" DESC);

COMMENT ON TABLE "Resource" IS 'Emergency response resources (teams, boats, shelters, etc.) and their assignment status';

COMMENT ON COLUMN "Resource".capacity IS 'Max capacity (for shelters); NULL for non-capacity resources';

COMMENT ON COLUMN "Resource"."currentLoad" IS 'Current occupancy (for shelters); NULL for non-capacity resources';

-- =====================================================================
-- ALERTS (Risk alerts, public alerts, resource alerts)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Alert" (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                    alert_type NOT NULL,
    severity                incident_severity NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    district                VARCHAR(120) NOT NULL,
    "isPublic"              BOOLEAN NOT NULL DEFAULT FALSE,
    "isActive"              BOOLEAN NOT NULL DEFAULT TRUE,
    source                  VARCHAR(255),
    "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiresAt"             TIMESTAMPTZ,

    CONSTRAINT chk_alert_expires_after_created CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt")
);

CREATE INDEX IF NOT EXISTS idx_alert_type ON "Alert"(type);
CREATE INDEX IF NOT EXISTS idx_alert_severity ON "Alert"(severity);
CREATE INDEX IF NOT EXISTS idx_alert_is_active ON "Alert"("isActive");
CREATE INDEX IF NOT EXISTS idx_alert_is_public ON "Alert"("isPublic");
CREATE INDEX IF NOT EXISTS idx_alert_district ON "Alert"(district);
CREATE INDEX IF NOT EXISTS idx_alert_created_at ON "Alert"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_alert_expires_at ON "Alert"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_alert_active_public ON "Alert"("isActive", "isPublic");

COMMENT ON TABLE "Alert" IS 'System alerts for risks, public awareness, and resource management';

-- =====================================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================================

-- Active incidents requiring response
CREATE OR REPLACE VIEW vw_active_incidents AS
SELECT 
    id,
    title,
    "disasterType",
    district,
    severity,
    status,
    latitude,
    longitude,
    "affectedPeople",
    "createdAt",
    "updatedAt"
FROM "ConfirmedIncident"
WHERE status IN ('ACTIVE', 'UNDER_RESPONSE')
ORDER BY severity DESC, "createdAt" DESC;

COMMENT ON VIEW vw_active_incidents IS 'Active incidents requiring immediate response and coordination';

-- Pending report reviews
CREATE OR REPLACE VIEW vw_pending_reviews AS
SELECT 
    id,
    source,
    "disasterType",
    district,
    latitude,
    longitude,
    description,
    contact,
    "createdAt"
FROM "IncomingReport"
WHERE "verificationStatus" = 'PENDING_REVIEW'
ORDER BY "createdAt" ASC;

COMMENT ON VIEW vw_pending_reviews IS 'Reports awaiting officer verification and classification';

-- Available resources by type and district
CREATE OR REPLACE VIEW vw_available_resources AS
SELECT 
    id,
    type,
    name,
    district,
    status,
    latitude,
    longitude,
    capacity,
    "currentLoad",
    "lastUpdated"
FROM "Resource"
WHERE status = 'AVAILABLE'
ORDER BY district, type;

COMMENT ON VIEW vw_available_resources IS 'Resources ready for deployment sorted by location and type';

-- Shelter occupancy status
CREATE OR REPLACE VIEW vw_shelter_status AS
SELECT 
    id,
    name,
    district,
    latitude,
    longitude,
    capacity,
    "currentLoad",
    ROUND(100.0 * "currentLoad" / NULLIF(capacity, 0), 1) AS occupancy_percent,
    CASE 
        WHEN "currentLoad" >= (capacity * 0.9) THEN 'CRITICAL'
        WHEN "currentLoad" >= (capacity * 0.7) THEN 'HIGH'
        WHEN "currentLoad" >= (capacity * 0.5) THEN 'MEDIUM'
        ELSE 'LOW'
    END AS occupancy_level,
    "lastUpdated"
FROM "Resource"
WHERE type = 'SHELTER'
ORDER BY occupancy_percent DESC;

COMMENT ON VIEW vw_shelter_status IS 'Real-time shelter capacity and occupancy levels for resource planning';

-- Active public alerts
CREATE OR REPLACE VIEW vw_public_alerts AS
SELECT 
    id,
    type,
    severity,
    title,
    description,
    district,
    source,
    "createdAt",
    "expiresAt"
FROM "Alert"
WHERE "isActive" = TRUE 
    AND "isPublic" = TRUE
    AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
ORDER BY severity DESC, "createdAt" DESC;

COMMENT ON VIEW vw_public_alerts IS 'All active alerts visible to the public via J3 portal';

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

-- Update "updatedAt" timestamp on ConfirmedIncident
CREATE OR REPLACE FUNCTION update_confirmed_incident_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_confirmed_incident_timestamp ON "ConfirmedIncident";
CREATE TRIGGER trigger_update_confirmed_incident_timestamp
    BEFORE UPDATE ON "ConfirmedIncident"
    FOR EACH ROW
    EXECUTE FUNCTION update_confirmed_incident_timestamp();

-- Update Resource "lastUpdated" on any change
CREATE OR REPLACE FUNCTION update_resource_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."lastUpdated" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_resource_timestamp ON "Resource";
CREATE TRIGGER trigger_update_resource_timestamp
    BEFORE UPDATE ON "Resource"
    FOR EACH ROW
    EXECUTE FUNCTION update_resource_timestamp();

-- Log report status changes (audit trail)
CREATE TABLE IF NOT EXISTS "ReportStatusAudit" (
    id                      BIGSERIAL PRIMARY KEY,
    "reportId"              UUID NOT NULL REFERENCES "IncomingReport"(id) ON DELETE CASCADE,
    "oldStatus"             verification_status,
    "newStatus"             verification_status NOT NULL,
    "changedBy"             UUID REFERENCES "User"(id) ON DELETE SET NULL,
    "changedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_status_audit_report_id 
    ON "ReportStatusAudit"("reportId");
CREATE INDEX IF NOT EXISTS idx_report_status_audit_changed_at 
    ON "ReportStatusAudit"("changedAt" DESC);

-- Trigger to log report status changes
CREATE OR REPLACE FUNCTION log_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."verificationStatus" IS DISTINCT FROM NEW."verificationStatus" THEN
        INSERT INTO "ReportStatusAudit" ("reportId", "oldStatus", "newStatus", "changedBy", reason)
        VALUES (NEW.id, OLD."verificationStatus", NEW."verificationStatus", NEW."reviewedById", NULL);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_report_status ON "IncomingReport";
CREATE TRIGGER trigger_log_report_status
    AFTER UPDATE ON "IncomingReport"
    FOR EACH ROW
    EXECUTE FUNCTION log_report_status_change();

COMMENT ON TABLE "ReportStatusAudit" IS 'Audit trail tracking all report status transitions for compliance and debugging';

-- =====================================================================
-- INITIAL DATA (Optional: Add sample data for development)
-- =====================================================================

-- Insert sample admin user (optional - uncomment if needed)
-- INSERT INTO "User" (email, name, role, "assignedDistrict")
-- VALUES 
--   ('admin@disaster-system.local', 'System Administrator', 'SYSTEM_ADMIN', 'ALL'),
--   ('officer@disaster-system.local', 'Duty Officer', 'OPERATIONS_OFFICER_NATIONAL', 'ALL')
-- ON CONFLICT (email) DO NOTHING;

-- =====================================================================
-- GRANTS & PERMISSIONS (adjust as needed for your setup)
-- =====================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT SELECT ON ALL VIEWS IN SCHEMA public TO your_app_user;

-- =====================================================================
-- SUCCESS MARKER
-- =====================================================================
-- Run this query to verify all tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
-- ORDER BY table_name;
