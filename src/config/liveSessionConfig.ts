const DEFAULT_CONSERVATIVE_TURN_TAKING = true;

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value !== 'false';
}

export const liveSessionConfig = {
  conservativeTurnTaking: parseBooleanEnv(
    import.meta.env.VITE_ENABLE_CONSERVATIVE_LIVE_TURN_TAKING,
    DEFAULT_CONSERVATIVE_TURN_TAKING,
  ),
  speechLevelThreshold: 0.035,
  silenceWindowMs: 800,
  minSpeechWindowMs: 250,
} as const;
