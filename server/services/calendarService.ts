/**
 * Google Calendar Service — Phase 3
 * 
 * OAuth shares the same Google client as Gmail.
 * Scopes: calendar.readonly + calendar.events
 */
import { getEffectiveIntegrationConfig, saveIntegrationConfig } from './integrationConfigService';

const CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export interface CalendarEvent {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    attendees: string[];
    location?: string;
    description?: string;
    htmlLink: string;
}

export interface FreeBusySlot {
    startTime: string;
    endTime: string;
    durationMinutes: number;
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function buildCalendarAuthUrl(workspaceId: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI_CALENDAR ?? 'http://localhost:8787/api/auth/calendar/callback';

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: CALENDAR_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: workspaceId,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCalendarCode(workspaceId: string, code: string): Promise<void> {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI_CALENDAR ?? 'http://localhost:8787/api/auth/calendar/callback';

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Calendar OAuth token exchange failed: ${text}`);
    }

    const tokens = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
    };

    await saveIntegrationConfig(workspaceId, 'calendar', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? '',
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });
}

async function getCalendarAccessToken(workspaceId: string): Promise<string> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'calendar');
    const accessToken = config.accessToken as string ?? '';
    const refreshToken = config.refreshToken as string ?? '';
    const expiresAt = config.expiresAt as string ?? '';

    if (!refreshToken) {
        throw new Error('Google Calendar not connected. Visit Settings > Integrations to connect Calendar.');
    }

    if (accessToken && expiresAt && new Date(expiresAt).getTime() > Date.now() + 60000) {
        return accessToken;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh Calendar token. Reconnect Calendar in Settings > Integrations.');
    }

    const tokens = await response.json() as {
        access_token: string;
        expires_in: number;
    };

    await saveIntegrationConfig(workspaceId, 'calendar', {
        accessToken: tokens.access_token,
        refreshToken,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });

    return tokens.access_token;
}

// ── Calendar API calls ────────────────────────────────────────────────────────

export function isCalendarConfigured(workspaceId: string): boolean {
    const config = getEffectiveIntegrationConfig(workspaceId, 'calendar');
    return Boolean(config.refreshToken);
}

export async function listCalendarEvents(
    workspaceId: string,
    options: { daysAhead?: number; maxResults?: number } = {}
): Promise<CalendarEvent[]> {
    const token = await getCalendarAccessToken(workspaceId);
    const now = new Date().toISOString();
    const future = new Date(Date.now() + (options.daysAhead ?? 7) * 24 * 60 * 60 * 1000).toISOString();

    const params = new URLSearchParams({
        timeMin: now,
        timeMax: future,
        maxResults: String(options.maxResults ?? 20),
        singleEvents: 'true',
        orderBy: 'startTime',
    });

    const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
        throw new Error(`Calendar list failed: ${response.status}`);
    }

    const data = await response.json() as {
        items: Array<{
            id: string;
            summary: string;
            start: { dateTime?: string; date?: string };
            end: { dateTime?: string; date?: string };
            attendees?: Array<{ email: string }>;
            location?: string;
            description?: string;
            htmlLink: string;
        }>;
    };

    return (data.items ?? []).map((item) => ({
        id: item.id,
        title: item.summary ?? '(No title)',
        startTime: item.start.dateTime ?? item.start.date ?? '',
        endTime: item.end.dateTime ?? item.end.date ?? '',
        attendees: (item.attendees ?? []).map((a) => a.email),
        location: item.location,
        description: item.description,
        htmlLink: item.htmlLink,
    }));
}

export async function createCalendarEvent(
    workspaceId: string,
    input: {
        title: string;
        startTime: string; // ISO 8601
        endTime: string;   // ISO 8601
        attendees?: string[];
        description?: string;
        location?: string;
    }
): Promise<CalendarEvent> {
    const token = await getCalendarAccessToken(workspaceId);

    const body = {
        summary: input.title,
        start: { dateTime: input.startTime, timeZone: 'UTC' },
        end: { dateTime: input.endTime, timeZone: 'UTC' },
        attendees: (input.attendees ?? []).map((email) => ({ email })),
        description: input.description,
        location: input.location,
        conferenceData: {
            createRequest: {
                requestId: `crewmate-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        },
    };

    const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Calendar event creation failed: ${response.status} ${text}`);
    }

    const event = await response.json() as {
        id: string;
        summary: string;
        start: { dateTime?: string };
        end: { dateTime?: string };
        attendees?: Array<{ email: string }>;
        location?: string;
        description?: string;
        htmlLink: string;
    };

    return {
        id: event.id,
        title: event.summary,
        startTime: event.start.dateTime ?? input.startTime,
        endTime: event.end.dateTime ?? input.endTime,
        attendees: (event.attendees ?? []).map((a) => a.email),
        location: event.location,
        description: event.description,
        htmlLink: event.htmlLink,
    };
}

export async function findFreeTimeSlots(
    workspaceId: string,
    options: { durationMinutes: number; windowDays?: number }
): Promise<FreeBusySlot[]> {
    const token = await getCalendarAccessToken(workspaceId);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + (options.windowDays ?? 5) * 24 * 60 * 60 * 1000);

    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            timeMin: now.toISOString(),
            timeMax: windowEnd.toISOString(),
            items: [{ id: 'primary' }],
        }),
    });

    if (!response.ok) {
        throw new Error(`Calendar free/busy query failed: ${response.status}`);
    }

    const data = await response.json() as {
        calendars: {
            primary: {
                busy: Array<{ start: string; end: string }>;
            };
        };
    };

    const busy = data.calendars.primary.busy ?? [];
    const freeSlots: FreeBusySlot[] = [];

    // Find gaps between busy periods during working hours (9am-6pm)
    let cursor = new Date(now);
    cursor.setMinutes(0, 0, 0);
    if (cursor.getHours() < 9) cursor.setHours(9);

    for (const period of busy) {
        const busyStart = new Date(period.start);
        const gapMinutes = (busyStart.getTime() - cursor.getTime()) / 60000;

        if (gapMinutes >= options.durationMinutes) {
            const slotEnd = new Date(cursor.getTime() + options.durationMinutes * 60000);
            freeSlots.push({
                startTime: cursor.toISOString(),
                endTime: slotEnd.toISOString(),
                durationMinutes: options.durationMinutes,
            });
            if (freeSlots.length >= 5) break;
        }

        cursor = new Date(period.end);
    }

    return freeSlots;
}
