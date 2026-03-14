import { serverConfig } from '../config';

export interface StockImageResult {
  url: string;
  photographer?: string;
  altText?: string;
  source: 'pexels';
  sourcePageUrl?: string;
}

interface PexelsPhotoVariant {
  landscape?: string;
  large2x?: string;
  large?: string;
  original?: string;
}

interface PexelsPhoto {
  alt?: string;
  photographer?: string;
  photographer_url?: string;
  src?: PexelsPhotoVariant;
  url?: string;
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
}

function requirePexelsConfig(): string {
  const apiKey = serverConfig.pexelsApiKey.trim();
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY is not configured on the server.');
  }

  return apiKey;
}

function mapPexelsPhoto(photo: PexelsPhoto | undefined): StockImageResult | null {
  const imageUrl = photo?.src?.landscape
    ?? photo?.src?.large2x
    ?? photo?.src?.large
    ?? photo?.src?.original;

  if (!imageUrl) {
    return null;
  }

  return {
    url: imageUrl,
    photographer: photo?.photographer,
    altText: photo?.alt,
    source: 'pexels',
    sourcePageUrl: photo?.url ?? photo?.photographer_url,
  };
}

export async function searchStockImage(query: string): Promise<StockImageResult | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error('Image search query is required.');
  }

  const apiKey = requirePexelsConfig();
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(normalizedQuery)}&per_page=1&orientation=landscape`, {
    headers: {
      Authorization: apiKey,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Pexels image search failed (${response.status}): ${message || 'Unknown error'}`);
  }

  const payload = await response.json() as PexelsSearchResponse;
  return mapPexelsPhoto(payload.photos?.[0]);
}
