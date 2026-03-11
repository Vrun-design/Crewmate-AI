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
}

interface GeminiPlannerClient {
  models: {
    generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse>;
  };
}

interface UiNavigatorPlannerDeps {
  createClient?: () => GeminiPlannerClient;
}

function stripCodeFences(text: string): string {
  return text.replace(/```json\s*|\s*```/g, '').trim();
}

function extractPlannerText(response: GenerateContentResponse): string {
  return stripCodeFences(response.text ?? '');
}

export function buildUiPlannerRequest(intent: string, observation: UiObservation): GenerateContentRequest {
  const prompt = buildUiNavigatorPlanningPrompt(intent, observation);
  const parts: GenerateContentRequest['contents'][number]['parts'] = [{ text: prompt }];

  if (observation.screenshotBase64 && observation.screenshotMimeType) {
    parts.push({
      inlineData: {
        data: observation.screenshotBase64,
        mimeType: observation.screenshotMimeType,
      },
    });
  }

  return {
    model: selectModel('orchestration', 'low', prompt.length),
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
  };
}

export function parseUiPlannerResponse(response: GenerateContentResponse): UiPlan {
  const text = extractPlannerText(response);

  if (!text) {
    throw new Error('UI planner returned an empty response');
  }

  const plan = parseUiPlan(JSON.parse(text) as unknown);
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
