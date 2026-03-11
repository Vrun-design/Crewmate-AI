import type { UiAction, UiNavigatorSafetyLevel } from './uiNavigatorTypes';

const CONFIRMATION_KEYWORDS = ['delete', 'remove', 'submit', 'purchase', 'pay', 'logout', 'disconnect'];
const BLOCKED_KEYWORDS = ['wipe', 'format', 'destroy', 'drop database'];

function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function getUiActionSafety(action: UiAction): UiNavigatorSafetyLevel {
  if (action.type === 'fail') {
    return 'blocked';
  }

  if (action.type === 'finish' || action.type === 'request_confirmation' || action.type === 'extract_text' || action.type === 'wait_for') {
    return 'safe';
  }

  const targetText = action.type === 'open_url'
    ? action.url
    : action.type === 'type'
      ? `${action.selector} ${action.value}`
      : action.type === 'press_key'
        ? action.key
        : action.type === 'scroll'
          ? action.direction
          : action.selector;

  if (containsKeyword(targetText, BLOCKED_KEYWORDS)) {
    return 'blocked';
  }

  if (containsKeyword(targetText, CONFIRMATION_KEYWORDS)) {
    return 'confirmation_required';
  }

  return 'safe';
}

export function withDerivedUiActionSafety(action: UiAction): UiAction {
  return {
    ...action,
    safety: getUiActionSafety(action),
  };
}
