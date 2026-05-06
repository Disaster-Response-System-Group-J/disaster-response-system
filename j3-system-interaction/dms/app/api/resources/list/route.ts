import { NextResponse } from "next/server";
import { pool } from "@/lib/db"; //

// GET: Fetch all resources from Supabase
export async function GET() {
  try {
    // 1. Fetch all assets from the DeployableAsset table
    const query = 'SELECT * FROM public."DeployableAsset" ORDER BY name ASC';
    const { rows } = await pool.query(query);

    // 2. Calculate real-time deployment aggregates[cite: 4]
    // Filter logic based on the 'type' column in your schema
    const deployment = {
      ambulances: { 
        deployed: rows.filter(r => r.type === 'AMBULANCE' && r.status !== 'AVAILABLE').length, 
        total: rows.filter(r => r.type === 'AMBULANCE').length 
      },
      rescue: { 
        deployed: rows.filter(r => r.type === 'BOAT' && r.status !== 'AVAILABLE').length, 
        total: rows.filter(r => r.type === 'BOAT').length 
      },
      groundTeams: { 
        deployed: rows.filter(r => r.type === 'RESCUE_TEAM' && r.status !== 'AVAILABLE').length, 
        total: rows.filter(r => r.type === 'RESCUE_TEAM').length 
      },
    };

    return NextResponse.json(
      { resources: rows, deployment },
      { status: 200 }
    );
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { success: false, message: "Database connection error" },
      { status: 500 }
    );
  }
}

// PATCH: Update a resource's status in the database[cite: 4]
export async function PATCH(request: Request) {
  try {
    const { assetId, status } = await request.json();

    // Use double quotes for the table name to match PostgreSQL casing[cite: 4]
    const query = `
      UPDATE public."DeployableAsset"
      SET status = $1
      WHERE asset_id = $2
      RETURNING *
    `;

    const { rows } = await pool.query(query, [status, assetId]);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    console.error("Database Update Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update resource" },
      { status: 500 }
    );
  }
}