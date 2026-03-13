import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { AGENT_MANIFESTS } from '../services/orchestratorAgents';
import { ALL_SKILLS } from './index';

describe('skill quality catalog', () => {
  test('hydrates every registered skill with explicit runtime metadata', () => {
    expect(ALL_SKILLS.length).toBeGreaterThanOrEqual(51);

    for (const skill of ALL_SKILLS) {
      expect(typeof skill.handler).toBe('function');
      expect(skill.preferredModel).toBeTruthy();
      expect(skill.executionMode).toBeTruthy();
      expect(skill.latencyClass).toBeTruthy();
      expect(skill.sideEffectLevel).toBeTruthy();
      expect(typeof skill.exposeInLiveSession).toBe('boolean');
      expect(skill.usageExamples?.length).toBeGreaterThan(0);
      expect(skill.invokingMessage).toBeTruthy();
      expect(skill.invokedMessage).toBeTruthy();
      expect(typeof skill.readOnlyHint).toBe('boolean');
      expect(typeof skill.destructiveHint).toBe('boolean');
      expect(typeof skill.openWorldHint).toBe('boolean');
      expect(skill.inputSchema.type).toBe('object');
    }
  });

  test('uses structured schemas for rich object and array inputs', () => {
    const browserFillForm = ALL_SKILLS.find((skill) => skill.id === 'browser.fill-form');
    const notionRecord = ALL_SKILLS.find((skill) => skill.id === 'notion.create-database-record');
    const zapierTrigger = ALL_SKILLS.find((skill) => skill.id === 'zapier.trigger');
    const sheetsAppendRows = ALL_SKILLS.find((skill) => skill.id === 'google.sheets-append-rows');
    const slidesAddSlides = ALL_SKILLS.find((skill) => skill.id === 'google.slides-add-slides');

    expect(browserFillForm?.inputSchema.properties.fields?.type).toBe('object');
    expect(notionRecord?.inputSchema.properties.properties?.type).toBe('object');
    expect(zapierTrigger?.inputSchema.properties.data?.type).toBe('object');
    expect(sheetsAppendRows?.inputSchema.properties.rows?.items?.type).toBe('array');
    expect(slidesAddSlides?.inputSchema.properties.slides?.items?.type).toBe('object');
  });

  test('agent manifests only reference registered skills', () => {
    const skillIds = new Set(ALL_SKILLS.map((skill) => skill.id));

    for (const agent of AGENT_MANIFESTS) {
      for (const skillId of agent.skills) {
        expect(skillIds.has(skillId), `${agent.id} references missing skill ${skillId}`).toBe(true);
      }
    }
  });

  test('high-impact live skills declare destructive hints', () => {
    const riskyLiveSkills = ALL_SKILLS.filter((skill) => skill.exposeInLiveSession && skill.sideEffectLevel === 'high');
    expect(riskyLiveSkills.length).toBeGreaterThan(0);

    for (const skill of riskyLiveSkills) {
      expect(skill.destructiveHint, `${skill.id} should be marked as destructive`).toBe(true);
      expect(skill.executionMode).toBeTruthy();
      expect(skill.latencyClass).toBeTruthy();
    }
  });

  test('README counts stay aligned with the runtime catalog', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
    const skillsCount = ALL_SKILLS.length;
    const agentCount = AGENT_MANIFESTS.length;

    expect(readme).toContain(`**${skillsCount} Skills**`);
    expect(readme).toContain(`discover Crewmate's ${agentCount} agents`);
    expect(readme).toContain(`REG[Skill Registry\\n${skillsCount} Skills]`);
    expect(readme).toContain(`## 🤖 Specialist Agents — ${agentCount} World-Class Domain Experts`);
  });
});
