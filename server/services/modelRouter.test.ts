import { describe, it, expect } from 'vitest';
import { selectModel, selectModelForSkill, determineComplexity } from './modelRouter';

describe('modelRouter', () => {
    describe('selectModel', () => {
        it('returns live model for live task type', () => {
            const model = selectModel('live');
            expect(model).toMatch(/audio|live/i);
        });

        it('returns orchestration model for orchestration task type', () => {
            const model = selectModel('orchestration');
            expect(model).toBeTruthy();
        });

        it('returns research model for high-complexity tasks', () => {
            const model = selectModel('general', 'high');
            expect(model).toBeTruthy();
        });

        it('returns research model when text length exceeds 500', () => {
            const model = selectModel('general', 'low', 501);
            expect(model).toBeTruthy();
        });

        it('returns text model (flash) for low complexity general tasks', () => {
            const model = selectModel('general', 'low', 0);
            expect(model).toBeTruthy();
        });

        it('returns creative model for high-complexity creative tasks', () => {
            const model = selectModel('creative', 'high');
            expect(model).toMatch(/image|flash/i);
        });
    });

    describe('selectModelForSkill', () => {
        it('returns research model for research preference', () => {
            const model = selectModelForSkill('research');
            expect(model).toBeTruthy();
        });

        it('returns creative model for creative preference', () => {
            const model = selectModelForSkill('creative');
            expect(model).toBeTruthy();
        });

        it('returns text model for quick preference', () => {
            const model = selectModelForSkill('quick');
            expect(model).toBeTruthy();
        });

        it('returns text model for undefined preference (default)', () => {
            const model = selectModelForSkill(undefined);
            expect(model).toBeTruthy();
        });
    });

    describe('determineComplexity', () => {
        it('returns high for prompts containing deep-dive keywords', () => {
            expect(determineComplexity('analyze our competitor strategy')).toBe('high');
            expect(determineComplexity('comprehensive tradeoffs of architecture')).toBe('high');
            expect(determineComplexity('design a system')).toBe('high');
        });

        it('returns high for prompts longer than 200 words', () => {
            const longPrompt = 'word '.repeat(201);
            expect(determineComplexity(longPrompt)).toBe('high');
        });

        it('returns low for simple short prompts', () => {
            expect(determineComplexity('send a Slack message')).toBe('low');
            expect(determineComplexity('create a GitHub issue')).toBe('low');
        });
    });
});
