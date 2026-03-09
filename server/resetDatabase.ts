import {db} from './db';

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

db.exec('BEGIN');

try {
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }

  db.exec('COMMIT');
  console.log('Crewmate local database reset complete.');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('Crewmate local database reset failed.');
  throw error;
}
