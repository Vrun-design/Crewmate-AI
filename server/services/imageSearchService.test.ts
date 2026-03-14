import { afterEach, describe, expect, test, vi } from 'vitest';

describe('imageSearchService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('returns the first mapped stock image from Pexels', async () => {
    vi.stubEnv('PEXELS_API_KEY', 'pexels-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        photos: [{
          alt: 'Team collaborating in office',
          photographer: 'Ava Lens',
          url: 'https://www.pexels.com/photo/123',
          src: {
            landscape: 'https://images.pexels.com/photos/123/landscape.jpeg',
          },
        }],
      }),
    }));

    const { searchStockImage } = await import('./imageSearchService');
    const result = await searchStockImage('team collaboration');

    expect(result).toEqual({
      url: 'https://images.pexels.com/photos/123/landscape.jpeg',
      photographer: 'Ava Lens',
      altText: 'Team collaborating in office',
      source: 'pexels',
      sourcePageUrl: 'https://www.pexels.com/photo/123',
    });
  });
});
