import type { Skill } from '../skills/types';

export type RuntimeRouteType = 'inline_answer' | 'inline_skill' | 'delegated_skill' | 'delegated_agent';
export type RuntimeRequestContext = 'live' | 'async';

interface SkillExecutionPolicy {
  executionMode: NonNullable<Skill['executionMode']>;
  latencyClass: NonNullable<Skill['latencyClass']>;
  sideEffectLevel: NonNullable<Skill['sideEffectLevel']>;
}

function looksLikeDocumentWork(skillId: string): boolean {
  return skillId === 'notion.create-page' || skillId.startsWith('google.');
}

function isBrowserAutomationSkill(skillId: string): boolean {
  return skillId.startsWith('browser.');
}

function getDefaultSkillExecutionPolicy(skill: Skill): SkillExecutionPolicy {
  if (isBrowserAutomationSkill(skill.id) || looksLikeDocumentWork(skill.id)) {
    return {
      executionMode: 'delegated',
      latencyClass: 'slow',
      sideEffectLevel: 'high',
    };
  }

  if (skill.id === 'web.search' || skill.id === 'web.summarize-url') {
    return {
      executionMode: 'delegated',
      latencyClass: 'slow',
      sideEffectLevel: 'none',
    };
  }

  if (skill.id === 'memory.retrieve' || skill.id === 'memory.list') {
    return {
      executionMode: 'inline',
      latencyClass: 'quick',
      sideEffectLevel: 'none',
    };
  }

  return {
    executionMode: skill.executionMode ?? 'either',
    latencyClass: skill.latencyClass ?? 'quick',
    sideEffectLevel: skill.sideEffectLevel ?? 'low',
  };
}

export function resolveSkillExecutionPolicy(skill: Skill): SkillExecutionPolicy {
  const defaults = getDefaultSkillExecutionPolicy(skill);

  return {
    executionMode: skill.executionMode ?? defaults.executionMode,
    latencyClass: skill.latencyClass ?? defaults.latencyClass,
    sideEffectLevel: skill.sideEffectLevel ?? defaults.sideEffectLevel,
  };
}

export function getSkillRouteType(skill: Skill, context: RuntimeRequestContext): RuntimeRouteType {
  const policy = resolveSkillExecutionPolicy(skill);

  if (context === 'async') {
    return 'delegated_skill';
  }

  if (policy.executionMode === 'delegated' || policy.latencyClass === 'slow' || policy.sideEffectLevel === 'high') {
    return 'delegated_skill';
  }

  return 'inline_skill';
}
