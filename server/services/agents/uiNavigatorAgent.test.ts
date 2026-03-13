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

describe('runUiNavigatorAgent', () => {
    beforeEach(() => {
        generateContent.mockReset();
        runSkill.mockReset();
        isFeatureEnabled.mockReset();
    });

    test('passes structured UI navigator inputs through to browser.ui-navigate', async () => {
        const { runUiNavigatorAgent } = await import('./uiNavigatorAgent');

        isFeatureEnabled.mockReturnValue(true);
        generateContent.mockResolvedValue({ text: '1. Open page\n2. Click signup\n3. Finish' });
        runSkill.mockResolvedValue({
            result: {
                success: true,
                output: { status: 'completed', summary: 'Done' },
                message: 'Done',
            },
        });

        const emitStep = vi.fn<EmitStep>();
        const result = await runUiNavigatorAgent(
            'Use UI Navigator.\nStart URL: https://example.com\nTask: Click the signup button',
            { userId: 'user-1', workspaceId: 'workspace-1' },
            emitStep,
        );

        expect(runSkill).toHaveBeenNthCalledWith(
            1,
            'browser.inspect-visible-ui',
            { userId: 'user-1', workspaceId: 'workspace-1' },
            { url: 'https://example.com' },
        );
        expect(runSkill).toHaveBeenNthCalledWith(
            2,
            'browser.ui-navigate',
            { userId: 'user-1', workspaceId: 'workspace-1' },
            expect.objectContaining({
                intent: expect.stringContaining('Click the signup button'),
                startUrl: 'https://example.com',
                maxSteps: 30,
            }),
        );
        expect(result).toEqual(expect.objectContaining({
            success: true,
            output: { status: 'completed', summary: 'Done' },
            summary: 'Done',
            executionPlan: '1. Open page\n2. Click signup\n3. Finish',
        }));
        expect(result.durationMs).toEqual(expect.any(Number));
    });

    test('fails fast when the feature flag is disabled', async () => {
        const { runUiNavigatorAgent } = await import('./uiNavigatorAgent');

        isFeatureEnabled.mockReturnValue(false);

        await expect(runUiNavigatorAgent(
            'Click the signup button',
            { userId: 'user-1', workspaceId: 'workspace-1' },
            vi.fn<EmitStep>(),
        )).rejects.toThrow(/FEATURE_UI_NAVIGATOR/);
    });
});
