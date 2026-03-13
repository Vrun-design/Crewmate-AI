import Database from 'better-sqlite3';
import { serverConfig } from './config';
import { ensureDirectoryExists } from './dbBootstrap';
import { runDatabaseMigrations, migrateUsersToDefaultWorkspaces } from './dbMigrations';
import { DB_SCHEMA_SQL } from './dbSchema';

function getVitestWorkerSuffix(): string {
  return process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? '0';
}

function getResolvedDatabasePath(): string {
  if (process.env.CREWMATE_DB_PATH?.trim()) {
    return process.env.CREWMATE_DB_PATH.trim();
  }

  if (process.env.VITEST) {
    return `data/crewmate.test.${getVitestWorkerSuffix()}.db`;
  }

  return serverConfig.databasePath;
}

function getResolvedArtifactStoragePath(): string {
  if (process.env.CREWMATE_ARTIFACTS_PATH?.trim()) {
    return process.env.CREWMATE_ARTIFACTS_PATH.trim();
  }

  if (process.env.VITEST) {
    return `data/test-artifacts/${getVitestWorkerSuffix()}`;
  }

  return serverConfig.artifactStoragePath;
}

const databasePath = getResolvedDatabasePath();
const artifactStoragePath = getResolvedArtifactStoragePath();

ensureDirectoryExists(databasePath);
ensureDirectoryExists(artifactStoragePath);

export const db = new Database(databasePath);

db.pragma('journal_mode = WAL');

db.exec(DB_SCHEMA_SQL);
runDatabaseMigrations(db);
migrateUsersToDefaultWorkspaces(db);
