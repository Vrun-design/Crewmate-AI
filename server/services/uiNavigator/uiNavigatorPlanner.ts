/**
 * @deprecated
 * The Gemini-based planner is **no longer used in production**.
 * Stagehand (stagehandExecutor.ts) now owns the AI planning and action loop
 * for multi-step browser navigation.
 *
 * This file is retained only because uiNavigatorPlanner.test.ts imports from
 * it directly. Do not add new features here.
 */
import { createGeminiClient } from '../geminiClient';
import { selectModel } from '../modelRouter';
import { buildUiNavigatorPlanningPrompt } from './uiNavigatorPrompts';
import { withDerivedUiActionSafety } from './uiNavigatorPolicy';
import { parseUiPlan } from './uiNavigatorSchema';
import type { UiObservation, UiPlan } from './uiNavigatorTypes';

interface GenerateContentResponse {
  text?: string;
}

interface GenerateContentRequest {
  model: string;
  contents: Array<{
    role: 'user';
    parts: Array<
      | { text: string }
      | { inlineData: { data: string; mimeType: string } }
    >;
  }>;
  config?: {
    responseMimeType?: string;
    responseJsonSchema?: unknown;
  };
}

interface GeminiPlannerClient {
  models: {
    generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse>;
  };
}

interface UiNavigatorPlannerDeps {
  createClient?: () => GeminiPlannerClient;
}

const UI_ACTION_TYPES = [
  'open_url',
  'click',
  'type',
  'clear_and_type',
  'select_option',
  'check',
  'hover',
  'press_key',
  'scroll',
  'wait_for',
  'wait_for_url',
  'dismiss_overlay',
  'extract_text',
  'finish',
  'request_confirmation',
  'fail',
] as const;

const UI_NAVIGATOR_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['goal', 'confidence', 'action'],
  properties: {
    goal: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    action: {
      type: 'object',
      required: ['type', 'reasoning', 'safety'],
      properties: {
        type: {
          type: 'string',
          enum: [...UI_ACTION_TYPES],
        },
        reasoning: { type: 'string' },
        safety: { type: 'string', enum: ['safe', 'confirmation_required', 'blocked'] },
        alternativeSelectors: {
          type: 'array',
          items: { type: 'string' },
        },
        url: { type: 'string' },
        selector: { type: 'string' },
        value: { type: 'string' },
        checked: { type: 'boolean' },
        key: { type: 'string' },
        direction: { type: 'string', enum: ['up', 'down'] },
        amount: { type: 'number' },
        timeoutMs: { type: 'number' },
        urlPattern: { type: 'string' },
        summary: { type: 'string' },
        error: { type: 'string' },
      },
    },
  },
};

function stripCodeFences(text: string): string {
  return text.replace(/```json\s*|\s*```/g, '').trim();
}

function extractPlannerText(response: GenerateContentResponse): string {
  return stripCodeFences(response.text ?? '');
}

function extractJsonObject(text: string): string {
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return text;
  }

  return text.slice(startIndex, endIndex + 1);
}

function getPlannerResponsePreview(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function buildPlannerRequestParts(observation: UiObservation, prompt: string): GenerateContentRequest['contents'][number]['parts'] {
  const parts: GenerateContentRequest['contents'][number]['parts'] = [{ text: prompt }];

  if (observation.screenshotBase64 && observation.screenshotMimeType) {
    parts.push({
      inlineData: {
        data: observation.screenshotBase64,
        mimeType: observation.screenshotMimeType,
      },
    });
  }

  return parts;
}

export function buildUiPlannerRequest(intent: string, observation: UiObservation): GenerateContentRequest {
  const prompt = buildUiNavigatorPlanningPrompt(intent, observation);

  return {
    model: selectModel('orchestration', 'low', prompt.length),
    contents: [
      {
        role: 'user',
        parts: buildPlannerRequestParts(observation, prompt),
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: UI_NAVIGATOR_PLAN_SCHEMA,
    },
  };
}

export function parseUiPlannerResponse(response: GenerateContentResponse): UiPlan {
  const text = extractPlannerText(response);

  if (!text) {
    throw new Error('UI planner returned an empty response');
  }

  const candidateJson = extractJsonObject(text);

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(candidateJson) as unknown;
  } catch {
    throw new Error(`UI planner returned non-JSON output: ${getPlannerResponsePreview(text)}`);
  }

  const plan = parseUiPlan(parsedPayload);
  return {
    ...plan,
    action: withDerivedUiActionSafety(plan.action),
  };
}

export function createUiNavigatorPlanner(deps: UiNavigatorPlannerDeps = {}): {
  planNextAction(intent: string, observation: UiObservation): Promise<UiPlan>;
} {
  const createClient = deps.createClient ?? (() => createGeminiClient() as GeminiPlannerClient);

  return {
    async planNextAction(intent: string, observation: UiObservation): Promise<UiPlan> {
      const client = createClient();
      const request = buildUiPlannerRequest(intent, observation);
      const response = await client.models.generateContent(request);
      return parseUiPlannerResponse(response);
    },
  };
}
