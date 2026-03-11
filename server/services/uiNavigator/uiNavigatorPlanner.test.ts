import { describe, expect, test, vi } from 'vitest';
import { buildUiPlannerRequest, createUiNavigatorPlanner, parseUiPlannerResponse } from './uiNavigatorPlanner';
import type { UiObservation } from './uiNavigatorTypes';

const observation: UiObservation = {
  url: 'https://example.com',
  title: 'Example',
  screenshotBase64: 'ZmFrZS1pbWFnZQ==',
  screenshotMimeType: 'image/jpeg',
  elements: [
    {
      selector: '#signup',
      tagName: 'button',
      role: 'button',
      text: 'Sign up',
      ariaLabel: '',
      placeholder: '',
      bounds: { x: 10, y: 20, width: 100, height: 40 },
      isVisible: true,
      isClickable: true,
      isEditable: false,
    },
  ],
  history: [],
};

describe('uiNavigatorPlanner', () => {
  test('builds a multimodal planning request when screenshot data is present', () => {
    const request = buildUiPlannerRequest('Click the signup button', observation);

    expect(request.contents[0].parts).toHaveLength(2);
    expect(request.contents[0].parts[1]).toEqual({
      inlineData: {
        data: 'ZmFrZS1pbWFnZQ==',
        mimeType: 'image/jpeg',
      },
    });
  });

  test('parses fenced JSON and derives safe action policy', () => {
    const plan = parseUiPlannerResponse({
      text: '```json\n{"goal":"Click signup","confidence":0.9,"action":{"type":"click","selector":"#signup","reasoning":"The visible CTA matches the task.","safety":"blocked"}}\n```',
    });

    expect(plan.action.type).toBe('click');
    expect(plan.action.safety).toBe('safe');
  });

  test('plans the next action through the Gemini client dependency', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: '{"goal":"Click signup","confidence":0.82,"action":{"type":"click","selector":"#signup","reasoning":"The call to action is the visible target.","safety":"safe"}}',
    });

    const planner = createUiNavigatorPlanner({
      createClient: () => ({
        models: { generateContent },
      }),
    });

    const plan = await planner.planNextAction('Click the signup button', observation);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(plan.goal).toBe('Click signup');
    expect(plan.action.type).toBe('click');
  });
});
