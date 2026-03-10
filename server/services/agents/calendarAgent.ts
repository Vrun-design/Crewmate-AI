/**
 * Calendar Agent — Phase 11 (Inline, with step streaming)
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const CALENDAR_AGENT_MANIFEST = {
    id: 'crewmate-calendar-agent',
    name: 'Calendar Agent',
    department: 'Ops',
    description: 'Find free time, create calendar events, agenda briefings, smart scheduling.',
    capabilities: ['scheduling', 'free_time_finding', 'agenda', 'conflict_detection'],
    skills: ['calendar.schedule', 'calendar.find-free-time', 'calendar.list-events'],
    model: serverConfig.geminiTextModel,
    emoji: '📅',
};

export async function runCalendarAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { attendees?: string[]; durationMinutes?: number; windowDays?: number; autoSchedule?: boolean } = {},
): Promise<{ recommendation: string; freeSlots: unknown[]; scheduledEvent?: unknown }> {
    const { attendees, durationMinutes = 30, windowDays = 5, autoSchedule = false } = options;
    const ai = createGeminiClient();

    // Find free slots
    emitStep('skill_call', 'Checking calendar for free time...', { skillId: 'calendar.find-free-time', detail: `${durationMinutes}min window over ${windowDays} days` });
    let freeSlots: unknown[] = [];
    try {
        const t0 = Date.now();
        const freeRun = await runSkill('calendar.find-free-time', ctx, { durationMinutes, windowDays });
        freeSlots = (freeRun.result as { output?: unknown[] }).output ?? [];
        emitStep('skill_result', `Found ${freeSlots.length} available slots`, { skillId: 'calendar.find-free-time', durationMs: Date.now() - t0, success: true });
    } catch {
        emitStep('skill_result', 'Calendar not connected — using business hours heuristic', { skillId: 'calendar.find-free-time', success: false });
    }

    // AI scheduling recommendation
    emitStep('generating', 'Building scheduling recommendation...');
    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `You are a smart scheduling assistant.
Goal: ${intent}
${attendees ? `Attendees: ${attendees.join(', ')}` : ''}
Duration needed: ${durationMinutes} minutes
${freeSlots.length > 0 ? `Available slots:\n${JSON.stringify(freeSlots, null, 2)}` : 'Calendar not connected — suggest times based on standard business hours (9am-5pm Mon-Fri).'}

Provide a clear, specific scheduling recommendation (day + time). Be concise.`,
    });
    const recommendation = response.text ?? '';
    emitStep('skill_result', 'Recommendation ready', { success: true });

    // Auto-schedule if requested
    let scheduledEvent: unknown | undefined;
    if (autoSchedule && Array.isArray(freeSlots) && freeSlots.length > 0) {
        const firstSlot = freeSlots[0] as { startTime: string; endTime: string };
        emitStep('skill_call', 'Creating calendar event...', { skillId: 'calendar.schedule', detail: firstSlot.startTime });
        try {
            const t0 = Date.now();
            const schedRun = await runSkill('calendar.schedule', ctx, {
                title: intent.slice(0, 80),
                startTime: firstSlot.startTime,
                endTime: firstSlot.endTime,
                attendees: attendees?.join(',') ?? '',
                description: `Auto-scheduled by Calendar Agent.\n\nGoal: ${intent}`,
            });
            scheduledEvent = schedRun.result;
            emitStep('skill_result', 'Event created', { skillId: 'calendar.schedule', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Could not create event — please schedule manually', { skillId: 'calendar.schedule', success: false });
        }
    }

    emitStep('done', scheduledEvent ? 'Meeting scheduled' : 'Scheduling recommendation ready', { success: true });
    return { recommendation, freeSlots, scheduledEvent };
}

export const calendarAgentApp = express();
calendarAgentApp.use(express.json());
calendarAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(CALENDAR_AGENT_MANIFEST));
