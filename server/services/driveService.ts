import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';

export interface DriveFileResult {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
}

interface DriveSearchOptions {
  exactName?: boolean;
  mimeType?: string;
  limit?: number;
}

function buildDriveFileUrl(id: string): string {
  return `https://drive.google.com/open?id=${id}`;
}

function normalizeDriveSearchQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return '';
  }

  const fieldMatch = trimmed.match(/^(?:title|name)\s*:\s*['"](.+?)['"]$/i);
  if (fieldMatch?.[1]) {
    return fieldMatch[1].trim();
  }

  const wrappedMatch = trimmed.match(/^['"](.+?)['"]$/);
  if (wrappedMatch?.[1]) {
    return wrappedMatch[1].trim();
  }

  return trimmed;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildDriveSearchExpression(query: string, options?: DriveSearchOptions): string {
  const normalizedQuery = normalizeDriveSearchQuery(query);
  const clauses = ['trashed = false'];

  if (normalizedQuery) {
    const escapedQuery = escapeDriveQueryValue(normalizedQuery);
    clauses.push(options?.exactName ? `name = '${escapedQuery}'` : `name contains '${escapedQuery}'`);
  }

  if (options?.mimeType) {
    clauses.push(`mimeType = '${escapeDriveQueryValue(options.mimeType)}'`);
  }

  return clauses.join(' and ');
}

export async function searchDriveFiles(workspaceId: string, query: string, options?: DriveSearchOptions): Promise<DriveFileResult[]> {
  const payload = await googleWorkspaceApiRequest<{ files?: Array<{ id: string; name: string; mimeType?: string }> }>({
    workspaceId,
    moduleId: 'drive',
    url: `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(buildDriveSearchExpression(query, options))}&pageSize=${options?.limit ?? 10}&fields=files(id,name,mimeType)`,
  });

  return (payload.files ?? []).map((file) => ({
    ...file,
    url: buildDriveFileUrl(file.id),
  }));
}

export async function findDriveFileByName(
  workspaceId: string,
  query: string,
  options?: { mimeType?: string },
): Promise<DriveFileResult | null> {
  const exactMatches = await searchDriveFiles(workspaceId, query, {
    exactName: true,
    mimeType: options?.mimeType,
    limit: 5,
  });
  if (exactMatches[0]) {
    return exactMatches[0];
  }

  const partialMatches = await searchDriveFiles(workspaceId, query, {
    mimeType: options?.mimeType,
    limit: 5,
  });
  return partialMatches[0] ?? null;
}

export async function createDriveFolder(workspaceId: string, input: {
  name: string;
  parentFolderId?: string;
}): Promise<DriveFileResult> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);
  const payload = await googleWorkspaceApiRequest<{ id: string; name: string }>({
    workspaceId,
    moduleId: 'drive',
    url: 'https://www.googleapis.com/drive/v3/files',
    method: 'POST',
    body: {
      name: input.name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(input.parentFolderId || defaults.defaultDriveFolderId
        ? { parents: [input.parentFolderId || defaults.defaultDriveFolderId] }
        : {}),
    },
  });

  return {
    ...payload,
    url: buildDriveFileUrl(payload.id),
  };
}

export async function moveDriveFileToFolder(workspaceId: string, input: {
  fileId: string;
  folderId: string;
}): Promise<void> {
  await googleWorkspaceApiRequest({
    workspaceId,
    moduleId: 'drive',
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?addParents=${encodeURIComponent(input.folderId)}`,
    method: 'PATCH',
    body: {},
  });
}
