-- ============================================================
-- Migration: High-Priority Feature Tables
-- Run against your Supabase project SQL editor
-- ============================================================

-- 1. ResourceRequest — submitted by response teams via mobile/web
-- Stores requests for specific supplies/assets needed at an incident
CREATE TABLE IF NOT EXISTS public."ResourceRequest" (
  request_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   uuid NOT NULL REFERENCES public."ConfirmedIncident"(id) ON DELETE CASCADE,
  requested_by  uuid NOT NULL REFERENCES public."User"(id),
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  status        character varying NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','APPROVED','DISPATCHED','FULFILLED','REJECTED')),
  -- items is a JSON array: [{ resource_type, quantity, unit, urgency }]
  -- urgency values: CRITICAL | HIGH | MEDIUM | LOW
  items         jsonb NOT NULL DEFAULT '[]',
  notes         text,
  reviewed_by   uuid REFERENCES public."User"(id),
  reviewed_at   timestamp with time zone
);

-- Index for the resource manager inbox query
CREATE INDEX IF NOT EXISTS idx_resource_request_status
  ON public."ResourceRequest" (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resource_request_incident
  ON public."ResourceRequest" (incident_id);

-- ============================================================

-- 2. PersonnelAssignment — used by Incident Commander to dispatch
--    field officers and response teams to a confirmed incident
CREATE TABLE IF NOT EXISTS public."PersonnelAssignment" (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   uuid NOT NULL REFERENCES public."ConfirmedIncident"(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public."User"(id),
  -- Store the role at time of assignment for audit purposes
  assigned_role character varying NOT NULL,
  status        character varying NOT NULL DEFAULT 'ASSIGNED'
                  CHECK (status IN ('ASSIGNED','EN_ROUTE','ON_SITE','RELEASED')),
  assigned_by   uuid REFERENCES public."User"(id),
  assigned_at   timestamp with time zone NOT NULL DEFAULT now(),
  released_at   timestamp with time zone,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_personnel_assignment_incident
  ON public."PersonnelAssignment" (incident_id, status);

CREATE INDEX IF NOT EXISTS idx_personnel_assignment_user
  ON public."PersonnelAssignment" (user_id);

-- ============================================================
-- Optional: add incidentId FK to Alert for traceability
-- Only run if your Alert table doesn't already have this column
-- ============================================================
-- ALTER TABLE public."Alert"
--   ADD COLUMN IF NOT EXISTS "incidentId" uuid REFERENCES public."ConfirmedIncident"(id);
