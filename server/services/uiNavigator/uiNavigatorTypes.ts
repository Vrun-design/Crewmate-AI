export type UiNavigatorSafetyLevel = 'safe' | 'confirmation_required' | 'blocked';

export type UiActionType =
  | 'open_url'
  | 'click'
  | 'type'
  | 'clear_and_type'
  | 'select_option'
  | 'check'
  | 'hover'
  | 'press_key'
  | 'scroll'
  | 'wait_for'
  | 'wait_for_url'
  | 'dismiss_overlay'
  | 'extract_text'
  | 'finish'
  | 'request_confirmation'
  | 'fail';

export interface UiElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiElementCandidate {
  selector: string;
  tagName: string;
  role: string;
  text: string;
  ariaLabel: string;
  placeholder: string;
  bounds: UiElementBounds;
  isVisible: boolean;
  isClickable: boolean;
  isEditable: boolean;
}

export interface UiObservation {
  url: string;
  title: string;
  screenshotBase64?: string;
  screenshotMimeType?: string;
  elements: UiElementCandidate[];
  accessibilityTree?: string;
  history: UiExecutionResult[];
}

interface UiActionBase {
  type: UiActionType;
  reasoning: string;
  safety: UiNavigatorSafetyLevel;
  /** Optional alternative selectors the executor should try if the primary fails */
  alternativeSelectors?: string[];
}

export interface UiOpenUrlAction extends UiActionBase {
  type: 'open_url';
  url: string;
}

export interface UiClickAction extends UiActionBase {
  type: 'click';
  selector: string;
}

export interface UiTypeAction extends UiActionBase {
  type: 'type';
  selector: string;
  value: string;
}

/** Clears any existing value in the field before typing — prevents appending to pre-filled inputs */
export interface UiClearAndTypeAction extends UiActionBase {
  type: 'clear_and_type';
  selector: string;
  value: string;
}

/** Select a value from a native <select> dropdown element */
export interface UiSelectOptionAction extends UiActionBase {
  type: 'select_option';
  selector: string;
  value: string;
}

/** Toggle a checkbox or radio button */
export interface UiCheckAction extends UiActionBase {
  type: 'check';
  selector: string;
  /** true = check, false = uncheck */
  checked: boolean;
}

/** Hover over an element (to reveal dropdown menus, tooltips, etc.) */
export interface UiHoverAction extends UiActionBase {
  type: 'hover';
  selector: string;
}

export interface UiPressKeyAction extends UiActionBase {
  type: 'press_key';
  key: string;
}

export interface UiScrollAction extends UiActionBase {
  type: 'scroll';
  direction: 'up' | 'down';
  amount?: number;
}

export interface UiWaitForAction extends UiActionBase {
  type: 'wait_for';
  selector: string;
  timeoutMs?: number;
}

/** Wait until the page URL changes (e.g., after a form submit redirect) */
export interface UiWaitForUrlAction extends UiActionBase {
  type: 'wait_for_url';
  urlPattern: string;
  timeoutMs?: number;
}

/**
 * Best-effort dismissal of cookie banners, GDPR overlays, newsletter popups.
 * The executor tries a list of known dismiss patterns and silently continues.
 */
export interface UiDismissOverlayAction extends UiActionBase {
  type: 'dismiss_overlay';
}

export interface UiExtractTextAction extends UiActionBase {
  type: 'extract_text';
  selector: string;
}

export interface UiFinishAction extends UiActionBase {
  type: 'finish';
  summary: string;
}

export interface UiRequestConfirmationAction extends UiActionBase {
  type: 'request_confirmation';
  summary: string;
}

export interface UiFailAction extends UiActionBase {
  type: 'fail';
  error: string;
}

export type UiAction =
  | UiOpenUrlAction
  | UiClickAction
  | UiTypeAction
  | UiClearAndTypeAction
  | UiSelectOptionAction
  | UiCheckAction
  | UiHoverAction
  | UiPressKeyAction
  | UiScrollAction
  | UiWaitForAction
  | UiWaitForUrlAction
  | UiDismissOverlayAction
  | UiExtractTextAction
  | UiFinishAction
  | UiRequestConfirmationAction
  | UiFailAction;

export interface UiPlan {
  goal: string;
  confidence: number;
  action: UiAction;
}

export interface UiExecutionResult {
  action: UiAction;
  status: 'completed' | 'failed' | 'blocked' | 'retried';
  url: string;
  detail: string;
}

export interface UiNavigatorRunResult {
  status: 'completed' | 'blocked' | 'failed' | 'max_steps';
  steps: UiExecutionResult[];
  finalUrl: string;
  finalObservation?: UiObservation;
  summary: string;
}
