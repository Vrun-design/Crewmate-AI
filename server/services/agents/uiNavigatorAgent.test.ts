import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { EmitStep } from '../../types/agentEvents';

const runSkill = vi.fn();
const isFeatureEnabled = vi.fn();

vi.mock('../../skills/registry', () => ({
    runSkill,
}));

vi.mock('../featureFlagService', () => ({
    isFeatureEnabled,
}));

describe('runUiNavigatorAgent', () => {
    beforeEach(() => {
        runSkill.mockReset();
        isFeatureEnabled.mockReset();
    });

    test('passes structured UI navigator inputs through to browser.ui-navigate', async () => {
        const { runUiNavigatorAgent } = await import('./uiNavigatorAgent');

        isFeatureEnabled.mockReturnValue(true);
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

        expect(runSkill).toHaveBeenCalledWith(
            'browser.ui-navigate',
            { userId: 'user-1', workspaceId: 'workspace-1' },
            {
                intent: 'Click the signup button',
                startUrl: 'https://example.com',
                maxSteps: 8,
            },
        );
        expect(result).toEqual({ status: 'completed', summary: 'Done' });
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
