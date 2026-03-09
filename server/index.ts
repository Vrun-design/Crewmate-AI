import cors from 'cors';
import express from 'express';
import {serverConfig} from './config';
import './db';
import {registerRoutes} from './routes';
import {processPendingJobs} from './services/delegationService';

const app = express();

app.use(
  cors({
    origin: serverConfig.corsOrigin,
  }),
);
app.use(express.json());

registerRoutes(app);

const jobInterval = setInterval(() => {
  void processPendingJobs();
}, 5000);

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
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
