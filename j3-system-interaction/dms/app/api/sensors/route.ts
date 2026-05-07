import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // 1. Fetch devices and their division info
    const devicesQuery = `
      SELECT d.device_id, d.status, d.installation_date, div.division_name, div.division_id
      FROM public."IoT_Device" d
      LEFT JOIN public."Division" div ON d.division_id = div.division_id
      ORDER BY d.device_id ASC
    `;
    
    // 2. Fetch all metric data
    const floodQuery = `SELECT * FROM public."FloodSeverity" ORDER BY timestamp DESC LIMIT 50`;
    const tempQuery = `SELECT * FROM public."TemperatureData" ORDER BY date DESC LIMIT 50`;
    const soilQuery = `SELECT * FROM public."SoilMoisture" ORDER BY date DESC LIMIT 50`;
    const rainQuery = `SELECT * FROM public."RainfallData" ORDER BY date DESC LIMIT 50`;

    // Run all queries concurrently
    const [devices, floodData, tempData, soilData, rainData] = await Promise.all([
      pool.query(devicesQuery),
      pool.query(floodQuery),
      pool.query(tempQuery),
      pool.query(soilQuery),
      pool.query(rainQuery)
    ]);

    return NextResponse.json({
      devices: devices.rows,
      waterLevels: floodData.rows,
      temperatures: tempData.rows,
      soilMoisture: soilData.rows,
      rainfall: rainData.rows
    });
    
  } catch (error) {
    console.error('Database Error fetching IoT data:', error);
    return NextResponse.json({ error: 'Failed to fetch IoT data' }, { status: 500 });
  }
}