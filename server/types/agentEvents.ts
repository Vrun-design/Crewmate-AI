/**
 * Agent Step Events — Phase 11 (Transparency)
 *
 * Typed event system for real-time sub-step streaming.
 * Every agent emits these events as it works, giving the user
 * full visibility into what's happening inside each task.
 */

export type AgentStepType =
    | 'routing'      // Orchestrator decided which agent to call
    | 'thinking'     // Agent is reasoning / planning
    | 'skill_call'   // Agent is calling a skill
    | 'skill_result' // Skill returned a result
    | 'generating'   // Agent is calling the LLM
    | 'saving'       // Agent is persisting output
    | 'done'         // Agent completed
    | 'error';       // Something went wrong

export interface AgentStepEvent {
    taskId: string;
    taskRunId?: string;
    stepIndex: number;
    type: AgentStepType;
    timestamp: string;
    label: string;          // Short human-readable label e.g. "Searching the web..."
    detail?: string;        // Optional extra context e.g. query used, result summary
    skillId?: string;       // Which skill was called (for skill_call / skill_result)
    durationMs?: number;    // How long this step took
    success?: boolean;      // For skill_result / done / error
    /** Browser session: public URL of the screenshot taken at this step */
    screenshotUrl?: string;
    /** Browser session: URL the browser was on when this step occurred */
    currentUrl?: string;
    /** Output URL to surface to the user (e.g. Notion page, Google Doc) */
    url?: string;
}

/** Function signature for the emitStep callback passed to all agents */
export type EmitStep = (
    type: AgentStepType,
    label: string,
    options?: {
        detail?: string;
        skillId?: string;
        durationMs?: number;
        success?: boolean;
        screenshotUrl?: string;
        currentUrl?: string;
        url?: string;
    }
) => void;
