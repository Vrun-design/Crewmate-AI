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

class LocalStorageMock implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function ensureLocalStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const candidate = window.localStorage;
  if (
    candidate
    && typeof candidate.getItem === 'function'
    && typeof candidate.setItem === 'function'
    && typeof candidate.removeItem === 'function'
  ) {
    return;
  }

  const storage = new LocalStorageMock();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

ensureLocalStorage();

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
