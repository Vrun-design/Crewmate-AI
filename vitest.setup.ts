import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

function getVitestWorkerSuffix(): string {
  return process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? '0';
}

function ensureVitestPaths(): void {
  const suffix = getVitestWorkerSuffix();

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  if (!process.env.CREWMATE_DB_PATH) {
    process.env.CREWMATE_DB_PATH = `data/crewmate.test.${suffix}.db`;
  }

  if (!process.env.CREWMATE_ARTIFACTS_PATH) {
    process.env.CREWMATE_ARTIFACTS_PATH = `data/test-artifacts/${suffix}`;
  }
}

ensureVitestPaths();

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
