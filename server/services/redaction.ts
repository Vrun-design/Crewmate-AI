const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|cookie|refresh|apikey|api_key|privatekey|private_key|code)/i;

function redactString(value: string): string {
  if (!value) {
    return value;
  }

  if (value.length <= 8) {
    return '[REDACTED]';
  }

  return `${value.slice(0, 4)}...[REDACTED]`;
}

export function redactSensitiveValue(value: unknown, keyHint = ''): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return SENSITIVE_KEY_PATTERN.test(keyHint) ? redactString(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item, keyHint));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        redactSensitiveValue(nestedValue, key),
      ]),
    );
  }

  return value;
}
