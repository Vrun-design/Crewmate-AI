import type { Skill } from '../types';
import { createCalendarEvent, listCalendarEvents } from '../../services/calendarService';
import { createGoogleDocument, appendToGoogleDocument } from '../../services/docsService';
import { createDriveFolder, searchDriveFiles } from '../../services/driveService';
import { createGmailDraft, searchGmailMessages, sendGmailMessage } from '../../services/gmailService';
import { createGoogleSpreadsheet, appendSpreadsheetRows } from '../../services/sheetsService';
import { createGooglePresentation, addSlidesToPresentation } from '../../services/slidesService';

function requireApproval(args: Record<string, unknown>, action: string): void {
  if (args.approved !== true) {
    throw new Error(`${action} requires explicit approval. Re-run this skill with approved=true after confirming the recipients and content.`);
  }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function parseRows(value: unknown): string[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((row) => Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [String(row ?? '')]);
}

function parseSlides(value: unknown): Array<{ title: string; body?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      return {
        title: String(record.title ?? `Slide ${index + 1}`),
        body: typeof record.body === 'string' ? record.body : undefined,
      };
    }

    return {
      title: `Slide ${index + 1}`,
      body: String(item ?? ''),
    };
  });
}

function getGoogleResourceId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getScreenContextId(screenContext: unknown, pattern: RegExp): string {
  if (typeof screenContext !== 'string') {
    return '';
  }

  const match = screenContext.match(pattern);
  return match?.[1] ?? '';
}

const googleBaseFields = {
  approved: { type: 'boolean' as const, description: 'Set to true only after the user explicitly confirms this side effect.' },
};

export const googleGmailDraftEmailSkill: Skill = {
  id: 'google.gmail-draft-email',
  name: 'Draft Gmail Email',
  description: 'Create a Gmail draft in the connected Google Workspace account.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Draft an email in Gmail', 'Prepare a client email', 'Create a Gmail draft'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'array', description: 'Email recipients.', items: { type: 'string' } },
      cc: { type: 'array', description: 'Optional cc recipients.', items: { type: 'string' } },
      bcc: { type: 'array', description: 'Optional bcc recipients.', items: { type: 'string' } },
      subject: { type: 'string', description: 'Email subject line.' },
      bodyText: { type: 'string', description: 'Plain text email body.' },
    },
    required: ['to', 'subject', 'bodyText'],
  },
  handler: async (ctx, args) => {
    const result = await createGmailDraft(ctx.workspaceId, {
      to: parseStringArray(args.to),
      cc: parseStringArray(args.cc),
      bcc: parseStringArray(args.bcc),
      subject: String(args.subject ?? ''),
      bodyText: String(args.bodyText ?? ''),
    });
    return {
      success: true,
      output: result,
      message: `✅ Gmail draft saved — subject: "${String(args.subject ?? '')}" to ${parseStringArray(args.to).join(', ')}. You can review and send it from Gmail.`,
    };
  },
};

export const googleGmailSendEmailSkill: Skill = {
  id: 'google.gmail-send-email',
  name: 'Send Gmail Email',
  description: 'Send an email through Gmail after explicit approval.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Send this email now', 'Email the client', 'Send the Gmail draft'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...googleBaseFields,
      to: { type: 'array', description: 'Email recipients.', items: { type: 'string' } },
      cc: { type: 'array', description: 'Optional cc recipients.', items: { type: 'string' } },
      bcc: { type: 'array', description: 'Optional bcc recipients.', items: { type: 'string' } },
      subject: { type: 'string', description: 'Email subject line.' },
      bodyText: { type: 'string', description: 'Plain text email body.' },
    },
    required: ['to', 'subject', 'bodyText'],
  },
  handler: async (ctx, args) => {
    requireApproval(args, 'Sending Gmail email');
    const result = await sendGmailMessage(ctx.workspaceId, {
      to: parseStringArray(args.to),
      cc: parseStringArray(args.cc),
      bcc: parseStringArray(args.bcc),
      subject: String(args.subject ?? ''),
      bodyText: String(args.bodyText ?? ''),
    });
    return {
      success: true,
      output: result,
      message: `✅ Email sent via Gmail — "${String(args.subject ?? '')}" to ${parseStringArray(args.to).join(', ')}.`,
    };
  },
};

export const googleGmailSearchSkill: Skill = {
  id: 'google.gmail-search',
  name: 'Search Gmail',
  description: 'Search Gmail messages in the connected Google Workspace account.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Search Gmail', 'Find that email', 'Look up messages in Gmail'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Gmail search query string.' },
    },
    required: ['query'],
  },
  handler: async (ctx, args) => {
    const results = await searchGmailMessages(ctx.workspaceId, String(args.query ?? ''));
    return {
      success: true,
      output: results,
      message: `Found ${Array.isArray(results) ? results.length : 0} Gmail message(s) matching "${String(args.query ?? '')}".`,
    };
  },
};

export const googleDocsCreateDocumentSkill: Skill = {
  id: 'google.docs-create-document',
  name: 'Create Google Doc',
  description: 'Create a Google Doc and optionally seed it with content.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Google Doc', 'Save this as a doc', 'Write this into Docs'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Document title.' },
      content: { type: 'string', description: 'Optional initial document text.' },
      folderId: { type: 'string', description: 'Optional Drive folder override.' },
    },
    required: ['title'],
  },
  handler: async (ctx, args) => {
    const result = await createGoogleDocument(ctx.workspaceId, {
      title: String(args.title ?? ''),
      content: typeof args.content === 'string' ? args.content : undefined,
      folderId: typeof args.folderId === 'string' ? args.folderId : undefined,
    });
    const docUrl = typeof result.url === 'string' ? result.url : (typeof result.id === 'string' ? `https://docs.google.com/document/d/${result.id}/edit` : undefined);
    return {
      success: true,
      output: result,
      message: `✅ Google Doc "${String(args.title ?? '')}" created successfully!${docUrl ? ` Open it here: ${docUrl}` : ''}`,
    };
  },
};

export const googleDocsAppendContentSkill: Skill = {
  id: 'google.docs-append-content',
  name: 'Append Google Doc Content',
  description: 'Append text content to an existing Google Doc.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Append to the doc', 'Add this to Google Docs'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      documentId: { type: 'string', description: 'Google Document ID. Extract from the URL: /document/d/DOCUMENT_ID/edit' },
      content: { type: 'string', description: 'Text to append.' },
      screenContext: { type: 'string', description: 'Optional: pass the visible URL from screen if the user is looking at a doc. The skill will extract the document ID automatically.' },
    },
    required: ['content'],
  },
  handler: async (ctx, args) => {
    let documentId = getGoogleResourceId(args.documentId);
    if (!documentId) {
      documentId = getScreenContextId(args.screenContext, /\/document\/d\/([a-zA-Z0-9_-]+)/);
    }

    if (!documentId) {
      throw new Error('documentId is required. Provide the Google Doc ID (from the URL: /document/d/DOCUMENT_ID/edit) or share your screen while looking at the doc.');
    }
    const result = await appendToGoogleDocument(ctx.workspaceId, {
      documentId,
      content: String(args.content ?? ''),
    });
    return {
      success: true,
      output: result,
      message: `✅ Content appended to Google Doc ${documentId}.`,
    };
  },
};

export const googleSheetsCreateSpreadsheetSkill: Skill = {
  id: 'google.sheets-create-spreadsheet',
  name: 'Create Google Sheet',
  description: 'Create a Google Sheet and optionally populate initial rows.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Google Sheet', 'Make a spreadsheet', 'Create a leads sheet'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Spreadsheet title.' },
      rows: { type: 'array', description: 'Optional 2D array of rows.', items: { type: 'array' } },
      folderId: { type: 'string', description: 'Optional Drive folder override.' },
    },
    required: ['title'],
  },
  handler: async (ctx, args) => {
    const result = await createGoogleSpreadsheet(ctx.workspaceId, {
      title: String(args.title ?? ''),
      rows: parseRows(args.rows),
      folderId: typeof args.folderId === 'string' ? args.folderId : undefined,
    });
    const sheetUrl = typeof result.url === 'string' ? result.url : (typeof result.id === 'string' ? `https://docs.google.com/spreadsheets/d/${result.id}/edit` : undefined);
    return {
      success: true,
      output: result,
      message: `✅ Google Sheet "${String(args.title ?? '')}" created!${sheetUrl ? ` Open it here: ${sheetUrl}` : ''}`,
    };
  },
};

export const googleSheetsAppendRowsSkill: Skill = {
  id: 'google.sheets-append-rows',
  name: 'Append Google Sheet Rows',
  description: 'Append rows into an existing Google Sheet.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Append rows to the sheet', 'Add these rows to Sheets'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'Spreadsheet ID. Extract from the URL: /spreadsheets/d/SPREADSHEET_ID/edit' },
      rows: { type: 'array', description: '2D array of rows to append.', items: { type: 'array' } },
      range: { type: 'string', description: 'Optional A1 range.' },
      screenContext: { type: 'string', description: 'Optional: pass the visible URL from screen if the user is looking at a sheet. The skill will extract the spreadsheet ID automatically.' },
    },
    required: ['rows'],
  },
  handler: async (ctx, args) => {
    let spreadsheetId = getGoogleResourceId(args.spreadsheetId);
    if (!spreadsheetId) {
      spreadsheetId = getScreenContextId(args.screenContext, /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    }

    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required. Provide the Google Sheets ID (from the URL: /spreadsheets/d/SPREADSHEET_ID/edit) or share your screen while looking at the sheet.');
    }
    const result = await appendSpreadsheetRows(ctx.workspaceId, {
      spreadsheetId,
      rows: parseRows(args.rows),
      range: typeof args.range === 'string' ? args.range : undefined,
    });
    return {
      success: true,
      output: result,
      message: `✅ ${parseRows(args.rows).length} row(s) appended to Google Sheet ${spreadsheetId}.`,
    };
  },
};

export const googleSlidesCreatePresentationSkill: Skill = {
  id: 'google.slides-create-presentation',
  name: 'Create Google Slides Presentation',
  description: 'Create a Google Slides presentation from a title and optional outline.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Slides deck', 'Make a presentation', 'Build a pitch deck'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Presentation title.' },
      slides: { type: 'array', description: 'Optional slide objects with title/body.', items: { type: 'string' } },
      folderId: { type: 'string', description: 'Optional Drive folder override.' },
    },
    required: ['title'],
  },
  handler: async (ctx, args) => {
    const result = await createGooglePresentation(ctx.workspaceId, {
      title: String(args.title ?? ''),
      slides: parseSlides(args.slides),
      folderId: typeof args.folderId === 'string' ? args.folderId : undefined,
    });
    const slideUrl = typeof result.url === 'string' ? result.url : (typeof result.id === 'string' ? `https://docs.google.com/presentation/d/${result.id}/edit` : undefined);
    return {
      success: true,
      output: result,
      message: `✅ Google Slides presentation "${String(args.title ?? '')}" created with ${parseSlides(args.slides).length || 0} slides!${slideUrl ? ` Open it here: ${slideUrl}` : ''}`,
    };
  },
};

export const googleSlidesAddSlidesSkill: Skill = {
  id: 'google.slides-add-slides',
  name: 'Add Slides To Presentation',
  description: 'Append slides to an existing Google Slides presentation.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Add slides to the deck', 'Append slides to the presentation'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      presentationId: { type: 'string', description: 'Presentation ID. Extract from the URL: /presentation/d/PRESENTATION_ID/edit' },
      slides: { type: 'array', description: 'Slide objects with title/body.', items: { type: 'string' } },
      screenContext: { type: 'string', description: 'Optional: pass the visible URL from screen if the user is looking at a presentation. The skill will extract the presentation ID automatically.' },
    },
    required: ['slides'],
  },
  handler: async (ctx, args) => {
    let presentationId = getGoogleResourceId(args.presentationId);
    if (!presentationId) {
      presentationId = getScreenContextId(args.screenContext, /\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    }

    if (!presentationId) {
      throw new Error('presentationId is required. Provide the Google Slides ID or share your screen while looking at the presentation.');
    }
    const result = await addSlidesToPresentation(ctx.workspaceId, {
      presentationId,
      slides: parseSlides(args.slides),
    });
    return {
      success: true,
      output: result,
      message: `✅ ${parseSlides(args.slides).length} slide(s) added to presentation ${presentationId}.`,
    };
  },
};

export const googleDriveSearchFilesSkill: Skill = {
  id: 'google.drive-search-files',
  name: 'Search Google Drive Files',
  description: 'Search files in Google Drive.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Search Drive', 'Find a Google file'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Filename search query.' },
    },
    required: ['query'],
  },
  handler: async (ctx, args) => {
    const results = await searchDriveFiles(ctx.workspaceId, String(args.query ?? ''));
    return {
      success: true,
      output: results,
      message: `Found ${Array.isArray(results) ? results.length : 0} file(s) in Drive matching "${String(args.query ?? '')}".`,
    };
  },
};

export const googleDriveCreateFolderSkill: Skill = {
  id: 'google.drive-create-folder',
  name: 'Create Google Drive Folder',
  description: 'Create a folder in Google Drive.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Drive folder', 'Make a Google Drive folder'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Folder name.' },
      parentFolderId: { type: 'string', description: 'Optional parent Drive folder ID.' },
    },
    required: ['name'],
  },
  handler: async (ctx, args) => {
    const result = await createDriveFolder(ctx.workspaceId, {
      name: String(args.name ?? ''),
      parentFolderId: typeof args.parentFolderId === 'string' ? args.parentFolderId : undefined,
    });
    const folderUrl = typeof result.url === 'string' ? result.url : (typeof result.id === 'string' ? `https://drive.google.com/drive/folders/${result.id}` : undefined);
    return {
      success: true,
      output: result,
      message: `✅ Drive folder "${String(args.name ?? '')}" created!${folderUrl ? ` Open it here: ${folderUrl}` : ''}`,
    };
  },
};

export const googleCalendarCreateEventSkill: Skill = {
  id: 'google.calendar-create-event',
  name: 'Create Google Calendar Event',
  description: 'Create a Google Calendar event after explicit approval.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a calendar invite', 'Schedule the meeting in Google Calendar'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...googleBaseFields,
      summary: { type: 'string', description: 'Event title.' },
      description: { type: 'string', description: 'Optional event description.' },
      start: { type: 'string', description: 'RFC3339 event start datetime.' },
      end: { type: 'string', description: 'RFC3339 event end datetime.' },
      attendees: { type: 'array', description: 'Optional attendee emails.', items: { type: 'string' } },
      calendarId: { type: 'string', description: 'Optional calendar ID override.' },
    },
    required: ['summary', 'start', 'end'],
  },
  handler: async (ctx, args) => {
    requireApproval(args, 'Creating a Google Calendar event');
    const result = await createCalendarEvent(ctx.workspaceId, {
      summary: String(args.summary ?? ''),
      description: typeof args.description === 'string' ? args.description : undefined,
      start: String(args.start ?? ''),
      end: String(args.end ?? ''),
      attendees: parseStringArray(args.attendees),
      calendarId: typeof args.calendarId === 'string' ? args.calendarId : undefined,
    });
    const attendeeList = parseStringArray(args.attendees);
    return {
      success: true,
      output: result,
      message: `✅ Calendar event "${String(args.summary ?? '')}" scheduled from ${String(args.start ?? '')} to ${String(args.end ?? '')}${attendeeList.length > 0 ? `. Attendees invited: ${attendeeList.join(', ')}` : ''}.`,
    };
  },
};

export const googleCalendarListEventsSkill: Skill = {
  id: 'google.calendar-list-events',
  name: 'List Google Calendar Events',
  description: 'List upcoming events from Google Calendar.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['What is on my Google Calendar?', 'List calendar events'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      calendarId: { type: 'string', description: 'Optional calendar ID override.' },
      timeMin: { type: 'string', description: 'Optional RFC3339 minimum start time.' },
      maxResults: { type: 'number', description: 'Maximum number of events to return.' },
    },
  },
  handler: async (ctx, args) => {
    const results = await listCalendarEvents(ctx.workspaceId, {
      calendarId: typeof args.calendarId === 'string' ? args.calendarId : undefined,
      timeMin: typeof args.timeMin === 'string' ? args.timeMin : undefined,
      maxResults: typeof args.maxResults === 'number' ? args.maxResults : undefined,
    });
    const count = Array.isArray(results) ? results.length : 0;
    return {
      success: true,
      output: results,
      message: count === 0
        ? 'No upcoming calendar events found.'
        : `Found ${count} upcoming event(s) on your calendar.`,
    };
  },
};
