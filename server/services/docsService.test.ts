import { afterEach, describe, expect, test, vi } from 'vitest';

const googleWorkspaceApiRequest = vi.fn();

vi.mock('./googleWorkspaceService', () => ({
  getGoogleWorkspaceDefaults: vi.fn(() => ({})),
  googleWorkspaceApiRequest,
}));

vi.mock('./driveService', () => ({
  moveDriveFileToFolder: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('docsService', () => {
  test('adds inline image requests when images are provided', async () => {
    googleWorkspaceApiRequest
      .mockResolvedValueOnce({
        documentId: 'doc-123',
        title: 'Launch Brief',
        body: { content: [{ endIndex: 1 }] },
      })
      .mockResolvedValueOnce({});

    const { appendToGoogleDocument } = await import('./docsService');

    await appendToGoogleDocument('WS-1', {
      documentId: 'doc-123',
      content: 'Launch summary',
      images: [{ url: 'https://images.example.com/launch.png', altText: 'Launch visual' }],
    });

    expect(googleWorkspaceApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      workspaceId: 'WS-1',
      moduleId: 'docs',
      method: 'POST',
      url: 'https://docs.googleapis.com/v1/documents/doc-123:batchUpdate',
      body: {
        requests: expect.arrayContaining([
          expect.objectContaining({
            insertInlineImage: expect.objectContaining({
              uri: 'https://images.example.com/launch.png',
            }),
          }),
        ]),
      },
    }));
  });
});
