export type UiNavigatorSafetyLevel = 'safe' | 'confirmation_required' | 'blocked';

export type UiActionType =
  | 'open_url'
  | 'click'
  | 'type'
  | 'press_key'
  | 'scroll'
  | 'wait_for'
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
  history: UiExecutionResult[];
}

interface UiActionBase {
  type: UiActionType;
  reasoning: string;
  safety: UiNavigatorSafetyLevel;
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
  | UiPressKeyAction
  | UiScrollAction
  | UiWaitForAction
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
  status: 'completed' | 'failed' | 'blocked';
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
