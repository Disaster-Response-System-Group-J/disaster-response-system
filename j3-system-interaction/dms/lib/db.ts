import dns from 'dns';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');

function loadDatabaseEnv() {
  if (process.env.DATABASE_URL || process.env.NODE_ENV === 'production') {
    return;
  }

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

function getDatabaseUrl() {
  loadDatabaseEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Add it to j3-system-interaction/dms/.env.local or the repository root .env.'
    );
  }

  return process.env.DATABASE_URL;
}

// ==========================================
// 1. SUPABASE POSTGRESQL CONNECTION
// ==========================================
let sharedPool: Pool | null = null;

function getPool() {
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString: getDatabaseUrl(),
    });

    // Optional: Log when successfully connected to Supabase
    sharedPool.on('connect', () => {
      console.log('Connected to Supabase PostgreSQL database');
    });
  }

  return sharedPool;
}

// The pool is created only when an API route actually queries the database.
// This allows Next.js and CI builds to import routes without needing DATABASE_URL.
export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const realPool = getPool();
    const value = realPool[property as keyof Pool];

    if (typeof value === 'function') {
      return value.bind(realPool);
    }

    return value;
  },
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
