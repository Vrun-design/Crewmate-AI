import 'dotenv/config';
import { serverConfig } from './config';
import { createApp } from './app';
import { researchAgentApp } from './services/agents/researchAgent';
import { discoverAgent } from './services/agents/agentDiscovery';
import { runMemorySummarizationPass } from './services/memorySummaryWorker';
import { runMonitoringPass } from './services/monitoringWorker';
import { validateStartupConfig } from './services/startupValidation';
import { db } from './db';
import './skills/index'; // Register all built-in skills on startup

validateStartupConfig();

/**
 * Startup cleanup: mark any task_runs and workspace tasks that were left in
 * running/queued/in_progress state from a previous process as failed.
 * This prevents permanently-stuck "Working on it" spinners in the UI.
 */
function cleanupOrphanedTasks(): void {
  const now = new Date().toISOString();
  const staleRunResult = db.prepare(`
    UPDATE task_runs
    SET status = 'failed',
        error = 'Server restarted while task was in progress.',
        completed_at = ?
    WHERE status IN ('running', 'queued')
  `).run(now);

  // Sync the parent workspace task status for any tasks whose runs are all done
  // but the task itself was left as in_progress
  db.prepare(`
    UPDATE tasks
    SET status = 'failed'
    WHERE status = 'in_progress'
      AND id NOT IN (
        SELECT DISTINCT task_id FROM task_runs WHERE status IN ('running', 'queued') AND task_id IS NOT NULL
      )
  `).run();

  if (staleRunResult.changes > 0) {
    console.log(`[startup] Marked ${staleRunResult.changes} orphaned task run(s) as failed (server was restarted).`);
  }
}

cleanupOrphanedTasks();

const app = createApp();

const memoryInterval = setInterval(() => {
  void runMemorySummarizationPass();
}, 60 * 60 * 1000); // 1 hour

const monitoringInterval = setInterval(() => {
  void runMonitoringPass();
}, 5 * 60 * 1000); // 5 minutes

const server = app.listen(serverConfig.port, () => {
  console.log(`Crewmate local API listening on http://localhost:${serverConfig.port}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${serverConfig.port} is already in use. Stop the old backend process or change PORT in .env before starting a new one.`,
    );
    process.exit(1);
  }

  throw error;
});

function shutdown() {
  clearInterval(memoryInterval);
  clearInterval(monitoringInterval);
  server.close(() => {
    process.exit(0);
  });
}


process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
