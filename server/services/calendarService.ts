import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';

interface CalendarEventResult {
  id: string;
  summary: string;
  htmlLink: string;
}

export async function createCalendarEvent(workspaceId: string, input: {
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  calendarId?: string;
}): Promise<CalendarEventResult> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);
  const calendarId = input.calendarId || defaults.defaultCalendarId || 'primary';
  return googleWorkspaceApiRequest<CalendarEventResult>({
    workspaceId,
    moduleId: 'calendar',
    url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    method: 'POST',
    body: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      attendees: (input.attendees ?? []).map((email) => ({ email })),
    },
  });
}

export async function listCalendarEvents(workspaceId: string, input?: {
  calendarId?: string;
  timeMin?: string;
  maxResults?: number;
}): Promise<Array<{ id: string; summary?: string; htmlLink?: string; start?: { dateTime?: string; date?: string } }>> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);
  const calendarId = input?.calendarId || defaults.defaultCalendarId || 'primary';
  const params = new URLSearchParams({
    timeMin: input?.timeMin ?? new Date().toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(input?.maxResults ?? 10),
  });
  const payload = await googleWorkspaceApiRequest<{ items?: Array<{ id: string; summary?: string; htmlLink?: string; start?: { dateTime?: string; date?: string } }> }>({
    workspaceId,
    moduleId: 'calendar',
    url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  });

  return payload.items ?? [];
}
