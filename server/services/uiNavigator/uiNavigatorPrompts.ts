import type { UiObservation } from './uiNavigatorTypes';

function describeHistoryAction(step: UiObservation['history'][number]): string {
  switch (step.action.type) {
    case 'open_url':
      return `Navigate to ${step.action.url}`;
    case 'click':
      return `Click ${step.action.selector}`;
    case 'type':
      return `Type "${step.action.value}" into ${step.action.selector}`;
    case 'clear_and_type':
      return `Clear + type "${step.action.value}" into ${step.action.selector}`;
    case 'select_option':
      return `Select "${step.action.value}" in ${step.action.selector}`;
    case 'check':
      return `${step.action.checked ? 'Check' : 'Uncheck'} ${step.action.selector}`;
    case 'hover':
      return `Hover over ${step.action.selector}`;
    case 'press_key':
      return `Press ${step.action.key}`;
    case 'scroll':
      return `Scroll ${step.action.direction}`;
    case 'wait_for':
      return `Wait for ${step.action.selector}`;
    case 'wait_for_url':
      return `Wait for URL matching ${step.action.urlPattern}`;
    case 'dismiss_overlay':
      return 'Dismiss overlay/popup';
    case 'extract_text':
      return `Extract text from ${step.action.selector}`;
    case 'finish':
      return `FINISH: ${step.action.summary}`;
    case 'request_confirmation':
      return `REQUEST CONFIRMATION: ${step.action.summary}`;
    case 'fail':
      return `FAILED: ${step.action.error}`;
  }
}

function summarizeHistory(history: UiObservation['history']): string {
  if (history.length === 0) return 'No actions taken yet — this is the first step.';
  const recentHistory = history.slice(-6);

  return history
    .slice(-6)
    .map((step, index) => {
      const stepNumber = history.length - recentHistory.length + index + 1;
      return `  Step ${stepNumber}: [${step.status.toUpperCase()}] ${describeHistoryAction(step)} → ${step.detail}`;
    })
    .join('\n');
}

function summarizeElements(observation: UiObservation): string {
  const elements = observation.elements.slice(0, 25);
  if (elements.length === 0) return '(no interactive elements detected)';

  return elements.map((el, i) => {
    const parts = [`${i + 1}.`, `[${el.tagName}]`, `sel="${el.selector}"`];
    if (el.text) parts.push(`text="${el.text.slice(0, 60)}"`);
    if (el.ariaLabel) parts.push(`aria="${el.ariaLabel}"`);
    if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
    if (el.isEditable) parts.push('✏️editable');
    if (el.isClickable) parts.push('👆clickable');
    return parts.join(' ');
  }).join('\n');
}

export function buildUiNavigatorPlanningPrompt(intent: string, observation: UiObservation): string {
  const historyText = summarizeHistory(observation.history);
  const elementsText = summarizeElements(observation);
  const a11ySection = observation.accessibilityTree
    ? `\n## Accessibility Tree (structured element data)\n${observation.accessibilityTree}\n`
    : '';

  return `You are the Crewmate UI Navigator — the world's most capable autonomous browser operator.

Your mission: complete the following task by controlling a real web browser one step at a time.

## Task
${intent}

## Current State
- URL: ${observation.url}
- Page title: ${observation.title}
- Step: ${observation.history.length + 1}

## Step History
${historyText}

## Interactive Elements on Screen
${elementsText}
${a11ySection}
## Decision Framework
Think before acting. Ask yourself:
1. What is the EXACT next action that moves me closer to the goal?
2. Is there an overlay, cookie banner, or popup blocking progress? If yes → emit dismiss_overlay.
3. If I need to fill an email or text field → use clear_and_type (not type) to avoid appending to pre-filled values.
4. If I just submitted a form, wait for the page to change before deciding it succeeded.
5. If a step failed previously, try a different selector or approach — never repeat the exact same failing action.
6. Only emit finish when the task is TRULY complete, not just when the form was submitted.
7. If you see a confirmation message, success banner, or URL change confirming completion → emit finish.

## Available Actions
- open_url: { url } — navigate to a URL
- click: { selector } — click an element; add alternativeSelectors for fallbacks
- type: { selector, value } — type into a field (appends to existing value)
- clear_and_type: { selector, value } — clear any existing text then type (preferred for forms)
- select_option: { selector, value } — choose from a <select> dropdown
- check: { selector, checked: true|false } — toggle checkbox or radio
- hover: { selector } — hover over element to reveal sub-menus
- press_key: { key } — press a keyboard key (e.g. "Enter", "Tab", "Escape")
- scroll: { direction: "up"|"down", amount? } — scroll the page
- wait_for: { selector, timeoutMs? } — wait for an element to appear
- wait_for_url: { urlPattern, timeoutMs? } — wait for URL to change (useful after form submit)
- dismiss_overlay: {} — auto-dismiss cookie banners, GDPR popups, newsletter modals
- extract_text: { selector } — read text from an element and include it in results
- finish: { summary } — ONLY when the task is completely done
- request_confirmation: { summary } — ONLY for irreversible or high-risk actions (purchases, deletions)
- fail: { error } — ONLY when truly blocked with no alternative approaches

## Selector Tips
- Prefer id selectors: #email, #submit-btn
- Use name attr: input[name="email"]
- Use aria: [aria-label="Subscribe"]
- Use text: button:has-text("Sign up") 
- Provide alternativeSelectors array for clicks/types as fallback options

## Output
Respond with ONLY valid JSON matching this schema exactly:
{
  "goal": "one-line description of what you're trying to accomplish this step",
  "confidence": 0.0-1.0,
  "action": {
    "type": "<action_type>",
    "reasoning": "why this action",
    "safety": "safe|confirmation_required|blocked",
    ...action-specific fields...
  }
}

CRITICAL OUTPUT RULES:
- Return JSON only. No markdown. No code fences. No explanation before or after the JSON.
- Do not say things like "I have already..." or "The user appears to...".
- If the task is already complete, emit a finish action in JSON.
- If the task cannot proceed, emit a fail or request_confirmation action in JSON.
- Never output prose outside the JSON object.}`;
}
