import { describe, expect, test } from 'vitest';
import type { LiveSession, TranscriptMessage } from '../types/live';
import {
  getElapsedLabel,
  getErrorMessage,
  mergeSessionState,
  mergeStreamingText,
  normalizeText,
  upsertTranscript,
} from './liveSessionUtils';

describe('liveSessionUtils', () => {
  test('normalizes whitespace in transcript text', () => {
    expect(normalizeText('  hello   world  ')).toBe('hello world');
  });

  test('merges streaming text without duplicating overlap', () => {
    expect(mergeStreamingText('hello world', 'hello world from crewmate')).toBe('hello world from crewmate');
    expect(mergeStreamingText('hello world from crewmate', 'world from')).toBe('hello world from crewmate');
  });

  test('upserts transcript messages by role', () => {
    const transcript: TranscriptMessage[] = [
      { id: 'live-user', role: 'user', text: 'hello', status: 'complete' },
    ];

    expect(upsertTranscript(transcript, 'agent', ' hi there ', 'streaming')).toEqual([
      { id: 'live-user', role: 'user', text: 'hello', status: 'complete' },
      { id: 'live-agent', role: 'agent', text: 'hi there', status: 'streaming' },
    ]);

    expect(upsertTranscript(transcript, 'user', ' updated ', 'complete')).toEqual([
      { id: 'live-user', role: 'user', text: 'updated', status: 'complete' },
    ]);
  });

  test('merges matching session state while preserving provider fallback', () => {
    const initialSession: LiveSession = {
      id: 'SES-1',
      status: 'live',
      startedAt: '2026-03-10T10:00:00.000Z',
      transcript: [],
      provider: 'gemini-live',
    };
    const currentSession: LiveSession = {
      id: 'SES-1',
      status: 'live',
      startedAt: '2026-03-10T10:00:00.000Z',
      transcript: [{ id: 'live-user', role: 'user', text: 'hello' }],
      provider: 'local',
    };

    expect(mergeSessionState(initialSession, currentSession)?.provider).toBe('gemini-live');
    expect(mergeSessionState(null, currentSession)).toEqual(currentSession);
  });

  test('formats errors and elapsed labels safely', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage('nope', 'fallback')).toBe('fallback');
    expect(getElapsedLabel(new Date(Date.now() - 65_000).toISOString())).toBe('01:05');
  });
});
