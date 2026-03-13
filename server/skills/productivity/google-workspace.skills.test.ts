import { afterEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../db';
import { googleCalendarCreateEventSkill, googleGmailSendEmailSkill, googleSheetsAppendRowsSkill } from './google-workspace.skills';

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
  findDriveFileByName: vi.fn(),
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

db.exec(`
  CREATE TABLE IF NOT EXISTS skill_runs (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    args_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    run_at TEXT NOT NULL
  )
`);

afterEach(() => {
  db.prepare(`DELETE FROM skill_runs WHERE user_id = ?`).run(ctx.userId);
  vi.clearAllMocks();
});

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

  test('recovers from placeholder spreadsheet ids by reusing the latest created sheet', async () => {
    const { appendSpreadsheetRows } = await import('../../services/sheetsService');
    vi.mocked(appendSpreadsheetRows).mockResolvedValue({
      id: 'sheet-123',
      title: 'Sheet1!A1:B2',
      url: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
    });

    db.prepare(`
      INSERT INTO skill_runs (id, skill_id, user_id, args_json, result_json, duration_ms, run_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'run-sheet-create',
      'google.sheets-create-spreadsheet',
      ctx.userId,
      JSON.stringify({ title: 'Top 10 NSE Stocks Analysis' }),
      JSON.stringify({
        success: true,
        output: {
          id: 'sheet-123',
          title: 'Top 10 NSE Stocks Analysis',
          url: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
        },
      }),
      1200,
      new Date().toISOString(),
    );

    await googleSheetsAppendRowsSkill.handler(ctx, {
      spreadsheetId: '12345_placeholder',
      rows: [['Ticker', 'Price'], ['RELIANCE', '1380.70']],
    });

    expect(appendSpreadsheetRows).toHaveBeenCalledWith(ctx.workspaceId, {
      spreadsheetId: 'sheet-123',
      rows: [['Ticker', 'Price'], ['RELIANCE', '1380.70']],
      range: undefined,
    });
  });
});
