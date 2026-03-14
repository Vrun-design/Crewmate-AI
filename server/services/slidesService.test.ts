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

describe('slidesService', () => {
  test('maps title and body placeholders when adding slides', async () => {
    googleWorkspaceApiRequest.mockResolvedValueOnce({});
    const { addSlidesToPresentation } = await import('./slidesService');

    await addSlidesToPresentation('WS-1', {
      presentationId: 'deck-123',
      slides: [{ title: 'Market Overview', body: 'Top 10 NSE stocks' }],
    });

    expect(googleWorkspaceApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      moduleId: 'slides',
      workspaceId: 'WS-1',
      method: 'POST',
      url: 'https://slides.googleapis.com/v1/presentations/deck-123:batchUpdate',
      body: {
        requests: expect.arrayContaining([
          expect.objectContaining({
            createSlide: expect.objectContaining({
              placeholderIdMappings: expect.arrayContaining([
                expect.objectContaining({
                  layoutPlaceholder: { type: 'TITLE', index: 0 },
                }),
                expect.objectContaining({
                  layoutPlaceholder: { type: 'BODY', index: 0 },
                }),
              ]),
            }),
          }),
          expect.objectContaining({
            insertText: expect.objectContaining({
              text: 'Market Overview',
              insertionIndex: 0,
            }),
          }),
          expect.objectContaining({
            insertText: expect.objectContaining({
              text: 'Top 10 NSE stocks',
              insertionIndex: 0,
            }),
          }),
        ]),
      },
    }));
  });

  test('adds slide images when image urls are provided', async () => {
    googleWorkspaceApiRequest.mockResolvedValueOnce({});
    const { addSlidesToPresentation } = await import('./slidesService');

    await addSlidesToPresentation('WS-1', {
      presentationId: 'deck-123',
      slides: [{ title: 'Market Overview', body: 'Top 10 NSE stocks', imageUrl: 'https://images.example.com/chart.png' }],
    });

    expect(googleWorkspaceApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        requests: expect.arrayContaining([
          expect.objectContaining({
            createImage: expect.objectContaining({
              url: 'https://images.example.com/chart.png',
            }),
          }),
        ]),
      },
    }));
  });
});
