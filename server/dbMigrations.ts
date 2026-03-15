import type Database from 'better-sqlite3';

interface Migration {
  id: string;
  apply: (db: Database.Database) => void;
}

function hasTable(db: Database.Database, tableName: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName);
  return Boolean(row);
}

function hasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  if (!hasTable(db, tableName)) {
    return false;
  }

  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function addColumnIfMissing(db: Database.Database, tableName: string, definition: string): void {
  const columnName = definition.trim().split(/\s+/)[0] ?? '';
  if (!columnName || hasColumn(db, tableName, columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

const MIGRATIONS: Migration[] = [
  {
    id: '001-runtime-columns',
    apply: (db) => {
      addColumnIfMissing(db, 'sessions', 'user_id TEXT');
      addColumnIfMissing(db, 'sessions', `provider TEXT NOT NULL DEFAULT 'local'`);
      addColumnIfMissing(db, 'activities', `user_id TEXT NOT NULL DEFAULT '__system__'`);
      addColumnIfMissing(db, 'notifications', `user_id TEXT NOT NULL DEFAULT '__system__'`);
      addColumnIfMissing(db, 'tasks', `user_id TEXT NOT NULL DEFAULT '__system__'`);
      addColumnIfMissing(db, 'tasks', 'description TEXT');
      addColumnIfMissing(db, 'tasks', 'url TEXT');
      addColumnIfMissing(db, 'tasks', 'linked_agent_task_id TEXT');
      addColumnIfMissing(db, 'tasks', `source_kind TEXT NOT NULL DEFAULT 'manual'`);
      addColumnIfMissing(db, 'tasks', 'current_run_id TEXT');
      addColumnIfMissing(db, 'tasks', 'linked_session_id TEXT');
      addColumnIfMissing(db, 'tasks', `artifact_count INTEGER NOT NULL DEFAULT 0`);
      addColumnIfMissing(db, 'screenshot_artifacts', `access_token TEXT NOT NULL DEFAULT ''`);
    },
  },
  {
    id: '002-production-hardening-columns',
    apply: (db) => {
      addColumnIfMissing(db, 'users', 'auth_provider TEXT');
      addColumnIfMissing(db, 'users', 'auth_subject TEXT');
      addColumnIfMissing(db, 'users', `email_verified INTEGER NOT NULL DEFAULT 0`);
      addColumnIfMissing(db, 'screenshot_artifacts', 'access_expires_at TEXT');
      addColumnIfMissing(db, 'screenshot_artifacts', 'revoked_at TEXT');
    },
  },
  {
    id: '003-soul-identity-columns',
    apply: (db) => {
      addColumnIfMissing(db, 'onboarding_profiles', `user_name TEXT NOT NULL DEFAULT ''`);
      addColumnIfMissing(db, 'onboarding_profiles', `custom_soul TEXT NOT NULL DEFAULT ''`);
    },
  },
];

export function runDatabaseMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    (db.prepare(`SELECT id FROM schema_migrations`).all() as Array<{ id: string }>).map((row) => row.id),
  );
  const markApplied = db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`);

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }

    db.transaction(() => {
      migration.apply(db);
      markApplied.run(migration.id, new Date().toISOString());
    })();
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_records_user_created ON memory_records(user_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_records_user_kind ON memory_records(user_id, kind, active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_screenshot_artifacts_user_created ON screenshot_artifacts(user_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_screenshot_artifacts_session_created ON screenshot_artifacts(session_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_auth_subject ON users(auth_provider, auth_subject)`);
}

export function migrateUsersToDefaultWorkspaces(db: Database.Database): void {
  try {
    const usersWithoutWorkspace = db.prepare(`
      SELECT id, name FROM users
      WHERE id NOT IN (SELECT user_id FROM workspace_members)
    `).all() as Array<{ id: string; name: string }>;

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
}
