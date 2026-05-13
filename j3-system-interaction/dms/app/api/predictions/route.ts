import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const STATUS_TO_RISK: Record<string, RiskLevel> = {
  Normal:   'LOW',
  Moderate: 'MEDIUM',
  Severe:   'HIGH',
  Extreme:  'CRITICAL',
};

const RISK_TO_SCORE: Record<RiskLevel, number> = {
  LOW: 10, MEDIUM: 40, HIGH: 70, CRITICAL: 95,
};

export async function GET() {
  try {
    // Pivot the 4 horizons into columns so the frontend gets one row per sensor.
    // DISTINCT ON keeps the most-recently-predicted set for each (source_id, disaster_type).
    const query = `
      WITH latest AS (
        SELECT DISTINCT ON (source_id, disaster_type, horizon)
          source_id, disaster_type, horizon, predicted_status,
          temp, hum, depth, depth_prev, moist, ax, ay, az, gx, gy, gz, predicted_at
        FROM public.iot_predictions
        ORDER BY source_id, disaster_type, horizon, predicted_at DESC
      )
      SELECT
        source_id,
        disaster_type,
        MAX(predicted_at) AS predicted_at,
        MAX(CASE WHEN horizon = 0 THEN predicted_status END) AS status_h0,
        MAX(CASE WHEN horizon = 1 THEN predicted_status END) AS status_h1,
        MAX(CASE WHEN horizon = 2 THEN predicted_status END) AS status_h2,
        MAX(CASE WHEN horizon = 3 THEN predicted_status END) AS status_h3,
        MAX(CASE WHEN horizon = 0 THEN temp  END) AS temp,
        MAX(CASE WHEN horizon = 0 THEN hum   END) AS hum,
        MAX(CASE WHEN horizon = 0 THEN depth END) AS depth,
        MAX(CASE WHEN horizon = 0 THEN depth_prev END) AS depth_prev,
        MAX(CASE WHEN horizon = 0 THEN moist END) AS moist,
        MAX(CASE WHEN horizon = 0 THEN ax END) AS ax,
        MAX(CASE WHEN horizon = 0 THEN ay END) AS ay,
        MAX(CASE WHEN horizon = 0 THEN az END) AS az,
        MAX(CASE WHEN horizon = 0 THEN gx END) AS gx,
        MAX(CASE WHEN horizon = 0 THEN gy END) AS gy,
        MAX(CASE WHEN horizon = 0 THEN gz END) AS gz
      FROM latest
      GROUP BY source_id, disaster_type
      ORDER BY predicted_at DESC
      LIMIT 50
    `;

    const { rows } = await pool.query(query);

    const normalized = rows.map((row: any) => {
      const currentStatus: string = row.status_h0 ?? 'Normal';
      const riskLevel: RiskLevel  = STATUS_TO_RISK[currentStatus] ?? 'LOW';

      return {
        source_id:    row.source_id,
        disaster_type: row.disaster_type,
        zone:         `${row.disaster_type.charAt(0).toUpperCase() + row.disaster_type.slice(1)} Sensor`,
        district:     `ID: ${row.source_id}`,
        risk_level:   riskLevel,
        score:        RISK_TO_SCORE[riskLevel],
        predicted_status: currentStatus,
        status_h1:    row.status_h1 ?? currentStatus,
        status_h2:    row.status_h2 ?? currentStatus,
        status_h3:    row.status_h3 ?? currentStatus,
        temp:         row.temp  !== null ? Number(row.temp)  : null,
        hum:          row.hum   !== null ? Number(row.hum)   : null,
        depth:        row.depth !== null ? Number(row.depth) : null,
        depth_prev:   row.depth_prev !== null ? Number(row.depth_prev) : null,
        moist:        row.moist !== null ? Number(row.moist) : null,
        ax:           row.ax    !== null ? Number(row.ax)    : null,
        ay:           row.ay    !== null ? Number(row.ay)    : null,
        az:           row.az    !== null ? Number(row.az)    : null,
        gx:           row.gx    !== null ? Number(row.gx)    : null,
        gy:           row.gy    !== null ? Number(row.gy)    : null,
        gz:           row.gz    !== null ? Number(row.gz)    : null,
        predicted_at: row.predicted_at,
      };
    });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('[api/predictions] Failed to fetch predictions:', error);
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}
