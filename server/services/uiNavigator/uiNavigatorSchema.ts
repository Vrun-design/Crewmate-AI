import type {
  UiAction,
  UiNavigatorSafetyLevel,
  UiPlan,
} from './uiNavigatorTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasValidSafety(value: unknown): value is UiNavigatorSafetyLevel {
  return value === 'safe' || value === 'confirmation_required' || value === 'blocked';
}

function parseAlternativeSelectors(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function getActionBase(input: Record<string, unknown>): {
  reasoning: string;
  safety: UiNavigatorSafetyLevel;
  alternativeSelectors?: string[];
} {
  if (!isString(input.reasoning) || !hasValidSafety(input.safety)) {
    throw new Error('Invalid UI action payload');
  }

  return {
    reasoning: input.reasoning,
    safety: input.safety,
    alternativeSelectors: parseAlternativeSelectors(input.alternativeSelectors),
  };
}

function parseAction(input: unknown): UiAction {
  if (!isRecord(input) || !isString(input.type)) {
    throw new Error('Invalid UI action payload');
  }

  const actionBase = getActionBase(input);

  switch (input.type) {
    case 'open_url':
      if (!isString(input.url)) throw new Error('open_url action requires url');
      return { type: 'open_url', url: input.url, ...actionBase };

    case 'click':
      if (!isString(input.selector)) throw new Error('click action requires selector');
      return { type: 'click', selector: input.selector, ...actionBase };

    case 'type':
      if (!isString(input.selector) || !isNonEmptyString(input.value)) {
        throw new Error('type action requires selector and value');
      }
      return { type: 'type', selector: input.selector, value: input.value as string, ...actionBase };

    case 'clear_and_type':
      if (!isString(input.selector) || !isNonEmptyString(input.value)) {
        throw new Error('clear_and_type action requires selector and value');
      }
      return { type: 'clear_and_type', selector: input.selector, value: input.value as string, ...actionBase };

    case 'select_option':
      if (!isString(input.selector) || !isString(input.value)) {
        throw new Error('select_option requires selector and value');
      }
      return { type: 'select_option', selector: input.selector, value: input.value, ...actionBase };

    case 'check':
      if (!isString(input.selector)) throw new Error('check action requires selector');
      return {
        type: 'check',
        selector: input.selector,
        checked: input.checked !== false,
        ...actionBase,
      };

    case 'hover':
      if (!isString(input.selector)) throw new Error('hover action requires selector');
      return { type: 'hover', selector: input.selector, ...actionBase };

    case 'press_key':
      if (!isString(input.key)) throw new Error('press_key action requires key');
      return { type: 'press_key', key: input.key, ...actionBase };

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
        ...actionBase,
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
        ...actionBase,
      };

    case 'wait_for_url':
      if (!isString(input.urlPattern)) throw new Error('wait_for_url action requires urlPattern');
      if (input.timeoutMs !== undefined && !isNumber(input.timeoutMs)) {
        throw new Error('wait_for_url timeoutMs must be a number');
      }
      return {
        type: 'wait_for_url',
        urlPattern: input.urlPattern,
        timeoutMs: input.timeoutMs as number | undefined,
        ...actionBase,
      };

    case 'dismiss_overlay':
      return { type: 'dismiss_overlay', ...actionBase };

    case 'extract_text':
      if (!isString(input.selector)) throw new Error('extract_text action requires selector');
      return { type: 'extract_text', selector: input.selector, ...actionBase };

    case 'finish':
      if (!isString(input.summary)) throw new Error('finish action requires summary');
      return { type: 'finish', summary: input.summary, ...actionBase };

    case 'request_confirmation':
      if (!isString(input.summary)) throw new Error('request_confirmation action requires summary');
      return { type: 'request_confirmation', summary: input.summary, ...actionBase };

    case 'fail':
      if (!isString(input.error)) throw new Error('fail action requires error');
      return { type: 'fail', error: input.error, ...actionBase };

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
