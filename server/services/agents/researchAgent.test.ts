import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { EmitStep } from '../../types/agentEvents';

const generateContent = vi.fn();
const runSkill = vi.fn();
const isFeatureEnabled = vi.fn();

vi.mock('../geminiClient', () => ({
    createGeminiClient: () => ({
        models: {
            generateContent,
        },
    }),
}));

vi.mock('../../skills/registry', () => ({
    runSkill,
}));

vi.mock('../featureFlagService', () => ({
    isFeatureEnabled,
}));

describe('runResearchAgent', () => {
    beforeEach(() => {
        generateContent.mockReset();
        runSkill.mockReset();
        isFeatureEnabled.mockReset();
    });

    test('uses retrieved sources when research grounding is enabled', async () => {
        const { runResearchAgent } = await import('./researchAgent');

        isFeatureEnabled.mockReturnValue(true);
        runSkill.mockResolvedValue({
            result: {
                success: true,
                output: [
                    { title: 'Source A', url: 'https://example.com/a', content: 'Alpha evidence' },
                    { title: 'Source B', url: 'https://example.com/b', content: 'Beta evidence' },
                ],
                message: 'search message',
            },
        });
        generateContent
            .mockResolvedValueOnce({ text: 'Plan text' })
            .mockResolvedValueOnce({ text: 'Findings text' })
            .mockResolvedValueOnce({ text: 'Brief text' });

        const emitStep = vi.fn<EmitStep>();
        const result = await runResearchAgent('Research Acme', {
            userId: 'user-1',
            workspaceId: 'workspace-1',
        }, emitStep);

        expect(result.grounded).toBe(true);
        expect(result.sources).toHaveLength(2);
        expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({
            contents: expect.stringContaining('Use ONLY the supplied evidence.'),
        }));
        expect(generateContent).toHaveBeenNthCalledWith(3, expect.objectContaining({
            contents: expect.stringContaining('Sources:\n1. **Source A**'),
        }));
    });

    test('falls back to limited-evidence guidance when search fails', async () => {
        const { runResearchAgent } = await import('./researchAgent');

        isFeatureEnabled.mockReturnValue(true);
        runSkill.mockRejectedValue(new Error('search offline'));
        generateContent
            .mockResolvedValueOnce({ text: 'Plan text' })
            .mockResolvedValueOnce({ text: 'Findings text' })
            .mockResolvedValueOnce({ text: 'Brief text' });

        const emitStep = vi.fn<EmitStep>();
        const result = await runResearchAgent('Research Acme', {
            userId: 'user-1',
            workspaceId: 'workspace-1',
        }, emitStep);

        expect(result.grounded).toBe(false);
        expect(result.sources).toEqual([]);
        expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({
            contents: expect.stringContaining('External evidence is limited. Be explicit about uncertainty.'),
        }));
        expect(generateContent).toHaveBeenNthCalledWith(3, expect.objectContaining({
            contents: expect.stringContaining('Note: Limited web sources — flag knowledge boundaries clearly.'),
        }));
    });
});
