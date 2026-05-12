import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // 1. Fetch incident counts by day for the trend chart
    const trendQuery = `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as date,
        COUNT(*) as count
      FROM public."ConfirmedIncident"
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY date
      ORDER BY date ASC
    `;

    // 2. Fetch disaster type distribution for the pie/bar charts
    const distributionQuery = `
      SELECT 
        severity,
        COUNT(*) as count
      FROM public."ConfirmedIncident"
      GROUP BY severity
    `;

    // 3. Fetch resource allocation stats
    const resourceQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM public."DeployableAsset"
      GROUP BY status
    `;

    const [trends, distribution, resources] = await Promise.all([
      pool.query(trendQuery),
      pool.query(distributionQuery),
      pool.query(resourceQuery)
    ]);

    return NextResponse.json({
      trends: trends.rows,
      distribution: distribution.rows,
      resources: resources.rows
    });
  } catch (error) {
    console.error('Analytics API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}