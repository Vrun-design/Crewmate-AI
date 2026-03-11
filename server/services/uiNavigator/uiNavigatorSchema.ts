import type { UiAction, UiNavigatorSafetyLevel, UiPlan } from './uiNavigatorTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasValidSafety(value: unknown): value is UiNavigatorSafetyLevel {
  return value === 'safe' || value === 'confirmation_required' || value === 'blocked';
}

function parseAction(input: unknown): UiAction {
  if (!isRecord(input) || !isString(input.type) || !isString(input.reasoning) || !hasValidSafety(input.safety)) {
    throw new Error('Invalid UI action payload');
  }

  switch (input.type) {
    case 'open_url':
      if (!isString(input.url)) throw new Error('open_url action requires url');
      return { type: 'open_url', url: input.url, reasoning: input.reasoning, safety: input.safety };
    case 'click':
      if (!isString(input.selector)) throw new Error('click action requires selector');
      return { type: 'click', selector: input.selector, reasoning: input.reasoning, safety: input.safety };
    case 'type':
      if (!isString(input.selector) || typeof input.value !== 'string') {
        throw new Error('type action requires selector and value');
      }
      return { type: 'type', selector: input.selector, value: input.value, reasoning: input.reasoning, safety: input.safety };
    case 'press_key':
      if (!isString(input.key)) throw new Error('press_key action requires key');
      return { type: 'press_key', key: input.key, reasoning: input.reasoning, safety: input.safety };
    case 'scroll':
      if (input.direction !== 'up' && input.direction !== 'down') {
        throw new Error('scroll action requires direction');
      }
      if (input.amount !== undefined && !isNumber(input.amount)) {
        throw new Error('scroll action amount must be a number');
      }
      return {
        type: 'scroll',
        direction: input.direction,
        amount: input.amount as number | undefined,
        reasoning: input.reasoning,
        safety: input.safety,
      };
    case 'wait_for':
      if (!isString(input.selector)) throw new Error('wait_for action requires selector');
      if (input.timeoutMs !== undefined && !isNumber(input.timeoutMs)) {
        throw new Error('wait_for timeoutMs must be a number');
      }
      return {
        type: 'wait_for',
        selector: input.selector,
        timeoutMs: input.timeoutMs as number | undefined,
        reasoning: input.reasoning,
        safety: input.safety,
      };
    case 'extract_text':
      if (!isString(input.selector)) throw new Error('extract_text action requires selector');
      return { type: 'extract_text', selector: input.selector, reasoning: input.reasoning, safety: input.safety };
    case 'finish':
      if (!isString(input.summary)) throw new Error('finish action requires summary');
      return { type: 'finish', summary: input.summary, reasoning: input.reasoning, safety: input.safety };
    case 'request_confirmation':
      if (!isString(input.summary)) throw new Error('request_confirmation action requires summary');
      return { type: 'request_confirmation', summary: input.summary, reasoning: input.reasoning, safety: input.safety };
    case 'fail':
      if (!isString(input.error)) throw new Error('fail action requires error');
      return { type: 'fail', error: input.error, reasoning: input.reasoning, safety: input.safety };
    default:
      throw new Error(`Unsupported UI action type: ${input.type}`);
  }
}

export function parseUiPlan(input: unknown): UiPlan {
  if (!isRecord(input) || !isString(input.goal) || !isNumber(input.confidence)) {
    throw new Error('Invalid UI plan payload');
  }

  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error('UI plan confidence must be between 0 and 1');
  }

  return {
    goal: input.goal,
    confidence: input.confidence,
    action: parseAction(input.action),
  };
}
