import cors from 'cors';
import express from 'express';
import { serverConfig } from './config';
import './db';
import { registerRoutes } from './routes';
import { registerMcpRoutes } from './mcp/mcpRoutes';
import { attachMcpServer } from './mcp/mcpProtocolServer';
import { processPendingJobs } from './services/delegationService';
import { researchAgentApp } from './services/agents/researchAgent';
import { discoverAgent } from './services/agents/agentDiscovery';
import { runMemorySummarizationPass } from './services/memorySummaryWorker';
import './skills/index'; // Register all built-in skills on startup
import { loadCustomSkills } from './skills/registry'; // Load user custom skills from DB

const app = express();

app.use(
  cors({
    origin: serverConfig.corsOrigin,
  }),
);
app.use(express.json());

registerRoutes(app);
registerMcpRoutes(app);

const jobInterval = setInterval(() => {
  void processPendingJobs();
}, 5000);

const memoryInterval = setInterval(() => {
  void runMemorySummarizationPass();
}, 60 * 60 * 1000); // 1 hour

const server = app.listen(serverConfig.port, () => {
  console.log(`Crewmate local API listening on http://localhost:${serverConfig.port}`);
});

// Load any user-created custom skills from the DB and register them in the skill map
loadCustomSkills();
console.log('Custom skills loaded.');


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
  clearInterval(jobInterval);
  clearInterval(memoryInterval);
  server.close(() => {
    process.exit(0);
  });
}


process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
