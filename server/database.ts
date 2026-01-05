import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'anisuplayer.db');
const db = new Database(dbPath);

export function initializeDatabase() {
  // Videos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail TEXT,
      duration REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Video sources table (for multiple resolutions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      resolution TEXT NOT NULL,
      url TEXT NOT NULL,
      is_local INTEGER DEFAULT 0,
      file_size INTEGER,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    )
  `);

  // Subtitles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtitles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      label TEXT NOT NULL,
      language TEXT NOT NULL,
      url TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    )
  `);

  // Encoding jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS encoding_jobs (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress REAL DEFAULT 0,
      current_resolution TEXT,
      resolutions_completed TEXT DEFAULT '[]',
      resolutions_pending TEXT DEFAULT '[]',
      started_at DATETIME,
      completed_at DATETIME,
      estimated_time_remaining INTEGER,
      error TEXT,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    )
  `);

  console.log('📦 Database initialized successfully');
}

export default db;

