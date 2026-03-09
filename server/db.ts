import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {serverConfig} from './config';

function ensureDirectoryExists(filePath: string) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, {recursive: true});
}

ensureDirectoryExists(serverConfig.databasePath);

export const db = new Database(serverConfig.databasePath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    color TEXT NOT NULL,
    bg_color TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memory_nodes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    tokens TEXT NOT NULL,
    last_synced TEXT NOT NULL,
    active INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    time TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    priority TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS session_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    plan TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL,
    read INTEGER NOT NULL,
    source_path TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS integration_connections (
    user_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,
    encrypted_config TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, integration_id)
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    voice_model TEXT NOT NULL,
    text_model TEXT NOT NULL,
    image_model TEXT NOT NULL,
    reasoning_level TEXT NOT NULL,
    proactive_suggestions INTEGER NOT NULL,
    auto_start_screen_share INTEGER NOT NULL,
    blur_sensitive_fields INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    result_json TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
  );
`);

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT`);
} catch {}
