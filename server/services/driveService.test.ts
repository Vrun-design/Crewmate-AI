import { afterEach, describe, expect, test, vi } from 'vitest';

const googleWorkspaceApiRequest = vi.fn();

vi.mock('./googleWorkspaceService', () => ({
  getGoogleWorkspaceDefaults: vi.fn(() => ({})),
  googleWorkspaceApiRequest,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('driveService', () => {
  test('normalizes title-style search queries before calling Drive', async () => {
    googleWorkspaceApiRequest.mockResolvedValueOnce({ files: [] });
    const { searchDriveFiles } = await import('./driveService');

    await searchDriveFiles('WS-1', `title:'Top 10 NSE Stocks Analysis'`);

    expect(googleWorkspaceApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      moduleId: 'drive',
      workspaceId: 'WS-1',
      url: expect.stringContaining(encodeURIComponent(`name contains 'Top 10 NSE Stocks Analysis'`)),
    }));
  });

  test('tries exact name first when resolving a file by title', async () => {
    googleWorkspaceApiRequest
      .mockResolvedValueOnce({ files: [{ id: 'file-1', name: 'Board Update', mimeType: 'application/vnd.google-apps.presentation' }] });

    const { findDriveFileByName } = await import('./driveService');
    const result = await findDriveFileByName('WS-1', 'Board Update', {
      mimeType: 'application/vnd.google-apps.presentation',
    });

    expect(result?.id).toBe('file-1');
    expect(googleWorkspaceApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining(encodeURIComponent(`name = 'Board Update' and mimeType = 'application/vnd.google-apps.presentation'`)),
    }));
  });
});
