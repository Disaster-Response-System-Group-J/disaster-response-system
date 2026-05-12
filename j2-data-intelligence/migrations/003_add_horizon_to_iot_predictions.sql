-- Migration 003: Add multi-day horizon support to iot_predictions
-- Run this in Supabase SQL editor if the table was already created by migration 002.
-- Safe to run: all steps are guarded with IF NOT EXISTS / IF EXISTS.

-- 1. Add horizon column (0 = current prediction, 1/2/3 = Day+N forecast)
ALTER TABLE public.iot_predictions
    ADD COLUMN IF NOT EXISTS horizon integer NOT NULL DEFAULT 0;

-- 2. Drop the old unique constraint that did not include horizon
ALTER TABLE public.iot_predictions
    DROP CONSTRAINT IF EXISTS iot_predictions_source_type_unique;

-- 3. New unique constraint: one prediction per (source_id, disaster_type, horizon)
ALTER TABLE public.iot_predictions
    ADD CONSTRAINT iot_predictions_source_type_horizon_unique
        UNIQUE (source_id, disaster_type, horizon);

-- 4. Enforce valid horizon range
ALTER TABLE public.iot_predictions
    DROP CONSTRAINT IF EXISTS iot_predictions_horizon_check;

ALTER TABLE public.iot_predictions
    ADD CONSTRAINT iot_predictions_horizon_check
        CHECK (horizon BETWEEN 0 AND 3);

-- 5. Index for filtering / ordering by horizon
CREATE INDEX IF NOT EXISTS idx_iot_predictions_horizon
    ON public.iot_predictions (horizon);
