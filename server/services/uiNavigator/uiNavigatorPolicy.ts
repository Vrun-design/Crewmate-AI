import type { UiAction, UiNavigatorSafetyLevel } from './uiNavigatorTypes';

const CONFIRMATION_KEYWORDS = ['delete', 'remove', 'submit', 'purchase', 'pay', 'logout', 'disconnect'];
const BLOCKED_KEYWORDS = ['wipe', 'format', 'destroy', 'drop database'];

function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function getActionTargetText(action: UiAction): string {
  switch (action.type) {
    case 'open_url':
      return action.url;
    case 'type':
    case 'clear_and_type':
      return `${action.selector} ${action.value}`;
    case 'select_option':
      return `${action.selector} ${action.value}`;
    case 'check':
    case 'click':
      return action.selector;
    default:
      return '';
  }
}

export function getUiActionSafety(action: UiAction): UiNavigatorSafetyLevel {
  if (action.type === 'fail') {
    return 'blocked';
  }

  if (
    action.type === 'finish' ||
    action.type === 'request_confirmation' ||
    action.type === 'extract_text' ||
    action.type === 'wait_for' ||
    action.type === 'wait_for_url' ||
    action.type === 'dismiss_overlay' ||
    action.type === 'scroll' ||
    action.type === 'hover' ||
    action.type === 'press_key'
  ) {
    return 'safe';
  }

  const targetText = getActionTargetText(action);

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
