import { describe, expect, test, vi } from 'vitest';
import { googleCalendarCreateEventSkill, googleGmailSendEmailSkill } from './google-workspace.skills';

vi.mock('../../services/gmailService', () => ({
  sendGmailMessage: vi.fn(async () => ({ id: 'msg-1', threadId: 'thread-1' })),
  createGmailDraft: vi.fn(),
  searchGmailMessages: vi.fn(),
}));

vi.mock('../../services/calendarService', () => ({
  createCalendarEvent: vi.fn(async () => ({ id: 'evt-1', summary: 'Review', htmlLink: 'https://calendar.google.com/event?evt-1' })),
  listCalendarEvents: vi.fn(),
}));

vi.mock('../../services/docsService', () => ({
  createGoogleDocument: vi.fn(),
  appendToGoogleDocument: vi.fn(),
}));

vi.mock('../../services/driveService', () => ({
  createDriveFolder: vi.fn(),
  searchDriveFiles: vi.fn(),
}));

vi.mock('../../services/sheetsService', () => ({
  createGoogleSpreadsheet: vi.fn(),
  appendSpreadsheetRows: vi.fn(),
}));

vi.mock('../../services/slidesService', () => ({
  createGooglePresentation: vi.fn(),
  addSlidesToPresentation: vi.fn(),
}));

const ctx = {
  userId: 'USR-1',
  workspaceId: 'WS-1',
};

describe('googleWorkspace skills', () => {
  test('blocks Gmail send without explicit approval', async () => {
    await expect(googleGmailSendEmailSkill.handler(ctx, {
      to: ['client@example.com'],
      subject: 'Launch update',
      bodyText: 'Status attached.',
    })).rejects.toThrow(/explicit approval/i);
  });

  test('blocks calendar creation without explicit approval', async () => {
    await expect(googleCalendarCreateEventSkill.handler(ctx, {
      summary: 'Launch review',
      start: '2026-03-14T10:00:00.000Z',
      end: '2026-03-14T10:30:00.000Z',
    })).rejects.toThrow(/explicit approval/i);
  });
});
