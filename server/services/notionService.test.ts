import { afterEach, describe, expect, test, vi } from 'vitest';
import { __private__, appendScreenshotToNotionPage, appendToNotionPage, createNotionDatabaseRecord, searchNotionPages, updateNotionPage } from './notionService';

vi.mock('./integrationOAuthService', () => ({
  getStoredIntegrationConfig: () => ({
    token: 'notion-test-token',
    defaultParentId: '11111111-2222-3333-4444-555555555555',
  }),
  createOAuthState: vi.fn(),
  consumeOAuthState: vi.fn(),
  deleteStoredIntegrationConfig: vi.fn(),
  saveStoredIntegrationConfig: vi.fn(),
}));

vi.mock('./screenshotArtifactService', () => ({
  resolveRecentScreenshotArtifact: vi.fn(() => ({
    id: 'SCR-TEST',
    publicUrl: 'https://assets.example.com/screenshot.jpg',
    title: 'Captured screen',
    caption: 'A captured screen',
  })),
}));

describe('notionService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('builds rich blocks from markdown-like content', () => {
    const blocks = __private__.buildBlocksFromContent([
      '# Launch Summary',
      '## Risks',
      '- Item one',
      '1. Numbered item',
      '- [x] Done item',
      '> Call this out',
      'https://example.com/reference',
      'https://example.com/image.png',
      'Paragraph with [linked text](https://notion.so)',
    ].join('\n'));

    expect(blocks.map((block) => block.type)).toEqual([
      'heading_1',
      'heading_2',
      'bulleted_list_item',
      'numbered_list_item',
      'to_do',
      'quote',
      'bookmark',
      'image',
      'paragraph',
    ]);
  });

  test('adds an image block when a screenshot url is provided explicitly', () => {
    const blocks = __private__.buildBlocksFromContent('Summary text', {
      screenshotUrl: 'https://assets.example.com/screenshot.jpg',
      screenshotCaption: 'Captured screen',
    });

    expect(blocks.at(-1)).toMatchObject({
      type: 'image',
      image: {
        external: {
          url: 'https://assets.example.com/screenshot.jpg',
        },
      },
    });
  });

  test('extracts a page id from a Notion URL', () => {
    expect(__private__.extractPageId('https://www.notion.so/My-Page-123456781234123412341234567890ab')).toBe(
      '12345678-1234-1234-1234-1234567890ab',
    );
  });

  test('appends blocks to an existing notion page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 'blk_1' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await appendToNotionPage('WS-1', 'USR-1', {
      pageIdOrUrl: 'https://www.notion.so/My-Page-123456781234123412341234567890ab',
      content: '- Add this later',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/blocks/12345678-1234-1234-1234-1234567890ab/children',
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
    expect(result.url).toContain('123456781234123412341234567890ab');
  });

  test('updates a notion page title and cover', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '12345678-1234-1234-1234-1234567890ab',
        url: 'https://www.notion.so/123456781234123412341234567890ab',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateNotionPage('WS-1', 'USR-1', {
      pageIdOrUrl: '12345678-1234-1234-1234-1234567890ab',
      title: 'Renamed page',
      coverUrl: 'https://example.com/cover.png',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/pages/12345678-1234-1234-1234-1234567890ab',
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
    expect(result.title).toBe('Renamed page');
  });

  test('appends a recent screenshot to a notion page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 'blk_1' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await appendScreenshotToNotionPage(
      'WS-1',
      'USR-1',
      {
        pageIdOrUrl: 'https://www.notion.so/My-Page-123456781234123412341234567890ab',
      },
      { sessionId: 'SES-1' },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/blocks/12345678-1234-1234-1234-1234567890ab/children',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('https://assets.example.com/screenshot.jpg'),
      }),
    );
    expect(result.url).toContain('123456781234123412341234567890ab');
  });

  test('searches notion pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            object: 'page',
            id: '12345678-1234-1234-1234-1234567890ab',
            url: 'https://www.notion.so/123456781234123412341234567890ab',
            properties: {
              Name: {
                type: 'title',
                title: [{ plain_text: 'Launch Review' }],
              },
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchNotionPages('WS-1', { query: 'Launch' });

    expect(results[0]?.title).toBe('Launch Review');
  });

  test('maps structured notion database properties and creates a record', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            Name: { id: 'title', type: 'title', name: 'Name' },
            Status: { id: 'status', type: 'select', name: 'Status' },
            Tags: { id: 'tags', type: 'multi_select', name: 'Tags' },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '12345678-1234-1234-1234-1234567890ab',
          url: 'https://www.notion.so/123456781234123412341234567890ab',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createNotionDatabaseRecord('WS-1', {
      databaseIdOrUrl: '87654321-1234-1234-1234-1234567890ab',
      title: 'Launch item',
      properties: {
        Status: 'In Progress',
        Tags: ['Launch', 'Q2'],
      },
    });

    expect(result.title).toBe('Launch item');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
