import Database from 'better-sqlite3';
import { serverConfig } from './config';
import { ensureDirectoryExists } from './dbBootstrap';
import { runDatabaseMigrations, migrateUsersToDefaultWorkspaces } from './dbMigrations';
import { DB_SCHEMA_SQL } from './dbSchema';

ensureDirectoryExists(serverConfig.databasePath);
ensureDirectoryExists(serverConfig.artifactStoragePath);

export const db = new Database(serverConfig.databasePath);

db.pragma('journal_mode = WAL');

db.exec(DB_SCHEMA_SQL);
runDatabaseMigrations(db);
migrateUsersToDefaultWorkspaces(db);
