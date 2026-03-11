import { Behavior } from '@google/genai';
import { describe, expect, test } from 'vitest';
import { registerTool, getToolDeclarations } from '../mcp/mcpServer';
import { registerSkill, getSkillDeclarations } from './registry';
import type { Skill } from './types';

describe('live declaration filtering', () => {
  test('returns only live-exposed MCP tools when liveOnly is enabled', () => {
    registerTool({
      name: 'test_live_tool_visible',
      description: 'Visible in live mode',
      exposeInLiveSession: true,
      behavior: Behavior.NON_BLOCKING,
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
      },
      handler: async () => ({ ok: true }),
    });

    registerTool({
      name: 'test_live_tool_hidden',
      description: 'Hidden in live mode',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => ({ ok: true }),
    });

    const liveDeclarations = getToolDeclarations({ liveOnly: true });
    expect(liveDeclarations.some((tool) => tool.name === 'test_live_tool_visible')).toBe(true);
    expect(liveDeclarations.some((tool) => tool.name === 'test_live_tool_hidden')).toBe(false);
  });

  test('returns only live-exposed skills and preserves behavior', () => {
    const visibleSkill: Skill = {
      id: 'test.live-visible',
      name: 'Live Visible',
      description: 'Visible in Gemini Live',
      version: '1.0.0',
      category: 'productivity',
      personas: [],
      requiresIntegration: [],
      triggerPhrases: [],
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title' },
        },
      },
      exposeInLiveSession: true,
      liveFunctionBehavior: Behavior.NON_BLOCKING,
      handler: async () => ({ success: true }),
    };

    const hiddenSkill: Skill = {
      ...visibleSkill,
      id: 'test.live-hidden',
      name: 'Live Hidden',
      exposeInLiveSession: false,
      liveFunctionBehavior: undefined,
    };

    registerSkill(visibleSkill);
    registerSkill(hiddenSkill);

    const liveDeclarations = getSkillDeclarations({ liveOnly: true });
    const visibleDeclaration = liveDeclarations.find((skill) => skill.name === 'test_live-visible');
    const hiddenDeclaration = liveDeclarations.find((skill) => skill.name === 'test_live-hidden');

    expect(visibleDeclaration?.behavior).toBe(Behavior.NON_BLOCKING);
    expect(hiddenDeclaration).toBeUndefined();
  });
});
