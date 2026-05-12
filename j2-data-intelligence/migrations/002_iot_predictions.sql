-- Migration 002: IoT Predictions Table
-- Run this in your Supabase SQL editor.
-- Non-destructive — uses CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.iot_predictions (
    -- Primary key
    id                uuid         DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Link back to the source IoT row
    source_id         text         NOT NULL,   -- id from iot_flood or iot_landslide
    disaster_type     text         NOT NULL,   -- 'flood' | 'landslide'

    -- ML model output
    predicted_status  text         NOT NULL,   -- 'Normal' | 'Moderate' | 'Severe' | 'Extreme'

    -- Input features stored for audit / debugging
    temp              numeric,                 -- Temperature (°C)
    hum               integer,                 -- Humidity (%)

    -- Flood-specific features
    depth_prev        numeric,                 -- Previous water depth reading (cm)
    depth             numeric,                 -- Current water depth reading (cm)

    -- Landslide-specific features
    moist             integer,                 -- Soil moisture (0–4095)
    ax                integer,                 -- Accel X (m/s²)
    ay                integer,                 -- Accel Y (m/s²)
    az                integer,                 -- Accel Z (m/s²)
    gx                integer,                 -- Gyro X (deg/s)
    gy                integer,                 -- Gyro Y (deg/s)
    gz                integer,                 -- Gyro Z (deg/s)

    predicted_at      timestamp with time zone DEFAULT now(),

    -- Ensure each source row is predicted exactly once per disaster type
    CONSTRAINT iot_predictions_source_type_unique UNIQUE (source_id, disaster_type),

    -- Validate disaster type values
    CONSTRAINT iot_predictions_disaster_type_check
        CHECK (disaster_type IN ('flood', 'landslide')),

    -- Validate severity label values
    CONSTRAINT iot_predictions_status_check
        CHECK (predicted_status IN ('Normal', 'Moderate', 'Severe', 'Extreme'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_iot_predictions_disaster_type
    ON public.iot_predictions (disaster_type);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_predicted_at
    ON public.iot_predictions (predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_predicted_status
    ON public.iot_predictions (predicted_status);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_source_id
    ON public.iot_predictions (source_id);

-- Optional: enable Supabase Realtime so the frontend can subscribe to new predictions
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_predictions;
