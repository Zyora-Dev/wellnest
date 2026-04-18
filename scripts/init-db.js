/**
 * Standalone SQLite initialisation script.
 * Run with: node scripts/init-db.js
 *
 * The database is also auto-initialised on first server start via lib/db.ts,
 * so this script is only needed if you want to pre-create the DB separately.
 */

const Database = require("better-sqlite3")
const path = require("path")
const fs = require("fs")

const DB_PATH = path.join(process.cwd(), "data", "db.sqlite")
const dataDir = path.dirname(DB_PATH)

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id                       TEXT    PRIMARY KEY,
    overall_wellbeing        TEXT    NOT NULL,
    stress_frequency         TEXT    NOT NULL,
    energy_levels            TEXT    NOT NULL,
    anxiety_frequency        TEXT    NOT NULL,
    low_mood_frequency       TEXT    NOT NULL,
    relaxation_difficulty    TEXT    NOT NULL,
    sleep_quality            TEXT    NOT NULL,
    sleep_hours              TEXT    NOT NULL,
    wake_rested              TEXT    NOT NULL,
    concentration_issues     TEXT    NOT NULL,
    productivity_level       TEXT    NOT NULL,
    comfort_sharing          TEXT    NOT NULL,
    support_system           TEXT    NOT NULL,
    loneliness_frequency     TEXT    NOT NULL,
    coping_methods           TEXT,
    relaxation_activities    TEXT    NOT NULL,
    feeling_overwhelmed      TEXT,
    wants_support_resources  INTEGER,
    thoughts                 TEXT    NOT NULL,
    additional_notes         TEXT,
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
    attempted_at  INTEGER NOT NULL
  );
`)

db.close()

console.log("✓ Database initialised at:", DB_PATH)
