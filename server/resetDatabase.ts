import { db } from './db';

const tables = [
  'auth_sessions',
  'auth_codes',
  'session_messages',
  'sessions',
  'notifications',
  'integration_connections',
  'user_preferences',
  'jobs',
  'activities',
  'tasks',
  'memory_nodes',
  'integrations',
  'users',
] as const;

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN');

try {
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  db.prepare('DELETE FROM workspace_members').run();
  db.prepare('DELETE FROM workspaces').run();

  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('Crewmate local database reset complete.');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('Crewmate local database reset failed.');
  throw error;
}
