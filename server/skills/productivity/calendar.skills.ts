/**
 * Calendar Skills — updated to use real calendarService (Phase 3)
 */
import type { Skill } from '../types';
import { createCalendarEvent, listCalendarEvents, findFreeTimeSlots } from '../../services/calendarService';

export const calendarScheduleSkill: Skill = {
    id: 'calendar.schedule',
    name: 'Schedule Calendar Event',
    description: 'Create a new event in Google Calendar with optional Google Meet link. Use when the user asks to schedule a meeting, block time, or set up a call.',
    version: '2.0.0',
    category: 'productivity',
    personas: ['founder', 'sales', 'developer', 'marketer'],
    requiresIntegration: ['calendar'],
    triggerPhrases: [
        'Schedule a 30-min call with Sarah tomorrow',
        'Block time for deep work Friday',
        'Set up a meeting for next week',
        'Create a calendar event',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Event title' },
            startTime: { type: 'string', description: 'Start time in ISO 8601 format (e.g. 2026-03-15T14:00:00Z)' },
            endTime: { type: 'string', description: 'End time in ISO 8601 format' },
            attendees: { type: 'string', description: 'Comma-separated list of attendee email addresses' },
            description: { type: 'string', description: 'Event description or agenda' },
            location: { type: 'string', description: 'Location or video call link' },
        },
        required: ['title', 'startTime', 'endTime'],
    },
    handler: async (ctx, args) => {
        const attendeeList = typeof args.attendees === 'string'
            ? args.attendees.split(',').map((a) => a.trim()).filter(Boolean)
            : [];

        const result = await createCalendarEvent(ctx.workspaceId, {
            title: String(args.title ?? ''),
            startTime: String(args.startTime ?? ''),
            endTime: String(args.endTime ?? ''),
            attendees: attendeeList,
            description: typeof args.description === 'string' ? args.description : undefined,
            location: typeof args.location === 'string' ? args.location : undefined,
        });

        return {
            success: true,
            output: result,
            message: `✅ Calendar event "${result.title}" created at ${result.startTime} (${result.htmlLink})`,
        };
    },
};

export const calendarFindFreeTimeSkill: Skill = {
    id: 'calendar.find-free-time',
    name: 'Find Free Time',
    description: 'Find available time slots in your calendar for meetings or focus blocks. Use when the user wants to know when they are free.',
    version: '2.0.0',
    category: 'productivity',
    personas: ['founder', 'sales', 'developer'],
    requiresIntegration: ['calendar'],
    triggerPhrases: [
        'When am I free this week?',
        'Find a 1-hour slot for a meeting',
        'What does my schedule look like tomorrow?',
        'Find free time for a call',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            durationMinutes: { type: 'number', description: 'How many minutes of free time needed (e.g. 30, 60)' },
            windowDays: { type: 'number', description: 'How many days ahead to search (default: 5)' },
        },
        required: ['durationMinutes'],
    },
    handler: async (ctx, args) => {
        const slots = await findFreeTimeSlots(ctx.workspaceId, {
            durationMinutes: typeof args.durationMinutes === 'number' ? args.durationMinutes : 30,
            windowDays: typeof args.windowDays === 'number' ? args.windowDays : 5,
        });

        if (slots.length === 0) {
            return { success: true, output: [], message: 'No free slots found in the requested window.' };
        }

        const formatted = slots.map((s, i) => {
            const start = new Date(s.startTime).toLocaleString();
            return `${i + 1}. ${start} (${s.durationMinutes} min)`;
        }).join('\n');

        return {
            success: true,
            output: slots,
            message: `📅 Free time slots (${args.durationMinutes}min):\n${formatted}`,
        };
    },
};

export const calendarListEventsSkill: Skill = {
    id: 'calendar.list-events',
    name: 'List Calendar Events',
    description: 'List upcoming events from Google Calendar. Use when the user asks what meetings they have, agenda for the day, or upcoming schedule.',
    version: '2.0.0',
    category: 'productivity',
    personas: ['founder', 'sales', 'developer', 'marketer'],
    requiresIntegration: ['calendar'],
    triggerPhrases: [
        'What meetings do I have today?',
        'Show me my agenda',
        'What is on my calendar this week?',
        'Any meetings coming up?',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            daysAhead: { type: 'number', description: 'How many days ahead to list events (default: 7)' },
            maxResults: { type: 'number', description: 'Max number of events to return (default: 20)' },
        },
    },
    handler: async (ctx, args) => {
        const events = await listCalendarEvents(ctx.workspaceId, {
            daysAhead: typeof args.daysAhead === 'number' ? args.daysAhead : 7,
            maxResults: typeof args.maxResults === 'number' ? args.maxResults : 20,
        });

        if (events.length === 0) {
            return { success: true, output: [], message: 'No upcoming events found.' };
        }

        const formatted = events.map((e, i) => {
            const start = new Date(e.startTime).toLocaleString();
            const attendeeList = e.attendees.length > 0 ? ` · ${e.attendees.join(', ')}` : '';
            return `${i + 1}. **${e.title}** — ${start}${attendeeList}`;
        }).join('\n');

        return {
            success: true,
            output: events,
            message: `📅 Upcoming ${events.length} events:\n\n${formatted}`,
        };
    },
};
