import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

const DB_PATH = path.join(process.cwd(), "data", "db.sqlite")

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

let _db: Database.Database | null = null

export default function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma("journal_mode = WAL")
    _db.pragma("foreign_keys = ON")
    _initSchema(_db)
  }
  return _db
}

function _initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id                       TEXT    PRIMARY KEY,
      -- Section 1
      overall_wellbeing        TEXT    NOT NULL,
      stress_frequency         TEXT    NOT NULL,
      energy_levels            TEXT    NOT NULL,
      -- Section 2
      anxiety_frequency        TEXT    NOT NULL,
      low_mood_frequency       TEXT    NOT NULL,
      relaxation_difficulty    TEXT    NOT NULL,
      -- Section 3
      sleep_quality            TEXT    NOT NULL,
      sleep_hours              TEXT    NOT NULL,
      wake_rested              TEXT    NOT NULL,
      -- Section 4
      concentration_issues     TEXT    NOT NULL,
      productivity_level       TEXT    NOT NULL,
      -- Section 5
      comfort_sharing          TEXT    NOT NULL,
      support_system           TEXT    NOT NULL,
      loneliness_frequency     TEXT    NOT NULL,
      -- Section 6
      coping_methods           TEXT,
      relaxation_activities    TEXT    NOT NULL,
      -- Section 7 (optional)
      feeling_overwhelmed      TEXT,
      wants_support_resources  INTEGER,
      -- Section 8
      thoughts                 TEXT    NOT NULL,
      additional_notes         TEXT,
      -- Metadata
      created_at               TEXT    NOT NULL
                               DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS admin_accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL
                    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      ip            TEXT    NOT NULL,
      attempted_at  INTEGER NOT NULL  -- unix epoch ms
    );
  `)
}

export type Submission = {
  id: string
  overall_wellbeing: string
  stress_frequency: string
  energy_levels: string
  anxiety_frequency: string
  low_mood_frequency: string
  relaxation_difficulty: string
  sleep_quality: string
  sleep_hours: string
  wake_rested: string
  concentration_issues: string
  productivity_level: string
  comfort_sharing: string
  support_system: string
  loneliness_frequency: string
  coping_methods: string | null
  relaxation_activities: string
  feeling_overwhelmed: string | null
  wants_support_resources: number | null
  thoughts: string
  additional_notes: string | null
  created_at: string
}

