import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextValue {
  requestId: string;
}

const requestContext = new AsyncLocalStorage<RequestContextValue>();

export function withRequestContext<T>(value: RequestContextValue, callback: () => T): T {
  return requestContext.run(value, callback);
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
