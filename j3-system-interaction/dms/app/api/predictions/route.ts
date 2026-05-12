import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT
        dp.prediction_id,
        dp.division_id,
        d.division_name,
        d.district,
        dp.feature_date,
        dp.predicted_for_date,
        dp.horizon,
        dp.hazard_type,
        dp.prob_normal,
        dp.prob_moderate,
        dp.prob_severe,
        dp.prob_extreme,
        dp.predicted_severity,
        dp.predicted_severity_label,
        dp.run_at
      FROM public.disaster_predictions dp
      LEFT JOIN public."Division" d ON dp.division_id = d.division_id
      WHERE dp.horizon = 1
      ORDER BY dp.run_at DESC, dp.division_id ASC, dp.hazard_type ASC
      LIMIT 100
    `;
    const { rows } = await pool.query(query);
    const normalized = rows.map((row: any) => ({
      ...row,
      district: row.district || row.division_name,
      risk_level: String(row.predicted_severity_label || 'Normal').toUpperCase() === 'EXTREME'
        ? 'CRITICAL'
        : String(row.predicted_severity_label || 'Normal').toUpperCase() === 'SEVERE'
          ? 'HIGH'
          : String(row.predicted_severity_label || 'Normal').toUpperCase() === 'MODERATE'
            ? 'MEDIUM'
            : 'LOW',
      score: Number(((Number(row.prob_severe || 0) + Number(row.prob_extreme || 0))).toFixed(4)),
      disaster_type: row.hazard_type,
    }));
    return NextResponse.json(normalized);
  } catch (error) {
    console.error('[api/predictions] Failed to fetch predictions:', error);
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}