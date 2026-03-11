import type { UiObservation } from './uiNavigatorTypes';

function summarizeElements(observation: UiObservation): string {
  return observation.elements.slice(0, 20).map((element, index) => (
    `${index + 1}. selector=${element.selector}; text="${element.text}"; role=${element.role}; clickable=${element.isClickable}; editable=${element.isEditable}`
  )).join('\n');
}

export function buildUiNavigatorPlanningPrompt(intent: string, observation: UiObservation): string {
  return [
    'You are Crewmate UI Navigator.',
    'Interpret the current screenshot and element candidates, then emit a single next-step JSON action.',
    'Prefer the provided selectors over guessing coordinates.',
    'If the action appears destructive or irreversible, emit request_confirmation.',
    'Respond with JSON only matching the UI plan schema.',
    '',
    `User intent: ${intent}`,
    `Current URL: ${observation.url}`,
    `Page title: ${observation.title}`,
    'Visible element candidates:',
    summarizeElements(observation),
  ].join('\n');
}
