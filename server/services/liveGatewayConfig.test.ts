import { Behavior } from '@google/genai';
import { describe, expect, test } from 'vitest';
import { buildLiveConnectConfig, buildLiveToolset } from './liveGatewayConfig';

describe('liveGatewayConfig', () => {
  test('builds a live toolset with Google Search plus function declarations', () => {
    const tools = buildLiveToolset([
      {
        name: 'create_workspace_task',
        description: 'Create a task',
        parametersJsonSchema: {
          type: 'object',
          properties: { title: { type: 'string' } },
        },
        behavior: Behavior.NON_BLOCKING,
      },
    ]);

    expect(tools).toHaveLength(2);
    expect(tools[0]).toEqual({ googleSearch: {} });
    expect(tools[1]?.functionDeclarations?.[0]?.behavior).toBe(Behavior.NON_BLOCKING);
  });

  test('enables compression and session resumption in the live connect config', () => {
    const config = buildLiveConnectConfig({
      systemInstruction: 'You are Crewmate.',
      voiceName: 'Aoede',
      functionDeclarations: [],
      resumptionHandle: 'resume-handle-1',
    });

    expect(config.sessionResumption).toEqual({
      handle: 'resume-handle-1',
    });
    expect(config.contextWindowCompression).toEqual({
      triggerTokens: '98304',
      slidingWindow: { targetTokens: '65536' },
    });
    expect(config.realtimeInputConfig?.activityHandling).toBe('START_OF_ACTIVITY_INTERRUPTS');
  });
});
