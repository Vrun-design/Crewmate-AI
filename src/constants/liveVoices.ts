export interface LiveVoiceOption {
  value: string;
  label: string;
  description: string;
}

export const DEFAULT_LIVE_VOICE = 'Aoede';

export const LIVE_VOICE_OPTIONS: LiveVoiceOption[] = [
  { value: 'Aoede', label: 'Aoede', description: 'Warm and expressive' },
  { value: 'Charon', label: 'Charon', description: 'Deep and authoritative' },
  { value: 'Fenrir', label: 'Fenrir', description: 'Clear and energetic' },
  { value: 'Kore', label: 'Kore', description: 'Calm and confident' },
  { value: 'Puck', label: 'Puck', description: 'Lively and playful' },
];
