import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { serverConfig } from './config';

function ensureDirectoryExists(filePath: string) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
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
    ended_at TEXT,
    provider TEXT NOT NULL DEFAULT 'local'
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

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
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
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL,
    read INTEGER NOT NULL,
    source_path TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS integration_connections (
    workspace_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,
    encrypted_config TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (workspace_id, integration_id)
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
    workspace_id TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS workflow_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    intent TEXT NOT NULL,
    deliver_to_notion INTEGER NOT NULL DEFAULT 0,
    notify_in_slack INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS onboarding_profiles (
    user_id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE sessions ADD COLUMN provider TEXT NOT NULL DEFAULT 'local'`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '__system__'`);
} catch { }

try {
  db.exec(`ALTER TABLE integration_connections RENAME COLUMN user_id TO workspace_id`);
} catch { }

try {
  db.exec(`ALTER TABLE activities ADD COLUMN user_id TEXT NOT NULL DEFAULT '__system__'`);
} catch { }

try {
  db.exec(`ALTER TABLE notifications ADD COLUMN user_id TEXT NOT NULL DEFAULT '__system__'`);
} catch { }

try {
  db.exec(`ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT '__system__'`);
} catch { }

try {
  db.exec(`ALTER TABLE memory_nodes ADD COLUMN embedding TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE memory_nodes ADD COLUMN search_text TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE memory_nodes ADD COLUMN user_id TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE memory_nodes ADD COLUMN workspace_id TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE agent_tasks ADD COLUMN user_id TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE agent_tasks ADD COLUMN workspace_id TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN origin_type TEXT NOT NULL DEFAULT 'delegation'`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN origin_ref TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN delivery_channels_json TEXT NOT NULL DEFAULT '[]'`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN artifact_refs_json TEXT NOT NULL DEFAULT '[]'`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'not_required'`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN approval_requested_at TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN approved_at TEXT`);
} catch { }

try {
  db.exec(`ALTER TABLE jobs ADD COLUMN handoff_log_json TEXT NOT NULL DEFAULT '[]'`);
} catch { }

// Migrate existing users to have a default workspace
try {
  const usersWithoutWorkspace = db.prepare(`
    SELECT id, name FROM users 
    WHERE id NOT IN (SELECT user_id FROM workspace_members)
  `).all() as { id: string, name: string }[];

  const insertWorkspace = db.prepare('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)');
  const insertMember = db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)');

  db.transaction(() => {
    const now = new Date().toISOString();
    for (const user of usersWithoutWorkspace) {
      const workspaceId = `WS-${user.id.slice(-8)}`;
      insertWorkspace.run(workspaceId, `${user.name}'s Workspace`, now);
      insertMember.run(workspaceId, user.id, 'owner', now);
    }
  })();
} catch (error) {
  console.error('Failed to migrate default workspaces:', error);
}
