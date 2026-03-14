import { describe, expect, test } from 'vitest';
import { inferAutoImageQuery } from './autoVisuals';

describe('autoVisuals', () => {
  test('always suggests visuals for slides', () => {
    expect(inferAutoImageQuery({
      target: 'slides',
      title: 'Q2 Launch Review',
      content: 'Overview of launch metrics',
    })).toContain('Q2 Launch Review');
  });

  test('suggests visuals for docs with report-like content', () => {
    expect(inferAutoImageQuery({
      target: 'docs',
      title: 'AI Market Research Brief',
      content: 'Executive summary and trend analysis',
    })).toContain('AI Market Research Brief');
  });

  test('does not suggest visuals for plain meeting notes docs', () => {
    expect(inferAutoImageQuery({
      target: 'docs',
      title: 'Meeting Notes',
      content: 'Agenda\nDecisions\nAction items',
    })).toBeUndefined();
  });
});
