-- Migration 002: IoT Predictions Table (fresh-install version)
-- Run this in Supabase SQL editor on a database that has NOT yet had
-- this table created. If the table already exists, run 003 instead.

CREATE TABLE IF NOT EXISTS public.iot_predictions (
    id                uuid         DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Link back to the originating IoT sensor row
    source_id         text         NOT NULL,
    disaster_type     text         NOT NULL,   -- 'flood' | 'landslide'

    -- ML model output
    predicted_status  text         NOT NULL,   -- 'Normal' | 'Moderate' | 'Severe' | 'Extreme'

    -- Forecast horizon
    --   0 = current reading (sensor values as-is)
    --   1 = Day+1 forecast  (features linearly extrapolated 1 day forward)
    --   2 = Day+2 forecast
    --   3 = Day+3 forecast
    horizon           integer      NOT NULL DEFAULT 0,

    -- Projected input features (stored for audit)
    temp              numeric,
    hum               integer,

    -- Flood-specific
    depth_prev        numeric,
    depth             numeric,

    -- Landslide-specific (ax/ay/az/gx/gy/gz held constant across horizons)
    moist             integer,
    ax                integer,
    ay                integer,
    az                integer,
    gx                integer,
    gy                integer,
    gz                integer,

    predicted_at      timestamp with time zone DEFAULT now(),

    CONSTRAINT iot_predictions_source_type_horizon_unique
        UNIQUE (source_id, disaster_type, horizon),

    CONSTRAINT iot_predictions_disaster_type_check
        CHECK (disaster_type IN ('flood', 'landslide')),

    CONSTRAINT iot_predictions_status_check
        CHECK (predicted_status IN ('Normal', 'Moderate', 'Severe', 'Extreme')),

    CONSTRAINT iot_predictions_horizon_check
        CHECK (horizon BETWEEN 0 AND 3)
);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_source_id
    ON public.iot_predictions (source_id);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_disaster_type
    ON public.iot_predictions (disaster_type);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_horizon
    ON public.iot_predictions (horizon);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_predicted_status
    ON public.iot_predictions (predicted_status);

CREATE INDEX IF NOT EXISTS idx_iot_predictions_predicted_at
    ON public.iot_predictions (predicted_at DESC);

-- Uncomment to enable Supabase Realtime for live frontend subscriptions:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_predictions;
