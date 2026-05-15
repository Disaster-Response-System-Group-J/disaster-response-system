import dns from 'dns';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');

function loadDatabaseEnv() {
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile, override: false });
    }
  }
}

loadDatabaseEnv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to j3-system-interaction/dms/.env.local or the repository root .env.'
  );
}

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
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'local_alerts.db');

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
