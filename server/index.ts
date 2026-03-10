import 'dotenv/config';
import { serverConfig } from './config';
import { createApp } from './app';
import { attachMcpServer } from './mcp/mcpProtocolServer';
import { processPendingJobs } from './services/delegationService';
import { researchAgentApp } from './services/agents/researchAgent';
import { discoverAgent } from './services/agents/agentDiscovery';
import { runMemorySummarizationPass } from './services/memorySummaryWorker';
import './skills/index'; // Register all built-in skills on startup

const app = createApp();

const jobInterval = setInterval(() => {
  void processPendingJobs();
}, 5000);

const memoryInterval = setInterval(() => {
  void runMemorySummarizationPass();
}, 60 * 60 * 1000); // 1 hour

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
  clearInterval(jobInterval);
  clearInterval(memoryInterval);
  server.close(() => {
    process.exit(0);
  });
}


process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
