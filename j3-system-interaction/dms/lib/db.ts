import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';

// ==========================================
// 1. SUPABASE POSTGRESQL CONNECTION
// ==========================================
// This creates a connection pool using the URL from your .env.local file
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Optional: Log when successfully connected to Supabase
pool.on('connect', () => {
  console.log('Connected to Supabase PostgreSQL database');
});


// ==========================================
// 2. LOCAL SQLITE CONNECTION (For Alerts)
// ==========================================
// This creates a file named 'local_alerts.db' in your project root
const dbPath = path.resolve(process.cwd(), 'local_alerts.db');

export const localDb = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening local SQLite database:', err.message);
  } else {
    console.log('Connected to Local SQLite database.');
    
    // Automatically create the alerts table if it doesn't exist yet
    localDb.run(`
      CREATE TABLE IF NOT EXISTS local_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity_level TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});