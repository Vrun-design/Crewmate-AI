import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';

interface DriveFileResult {
  id: string;
  name: string;
  url: string;
}

function buildDriveFileUrl(id: string): string {
  return `https://drive.google.com/open?id=${id}`;
}

export async function searchDriveFiles(workspaceId: string, query: string): Promise<DriveFileResult[]> {
  const payload = await googleWorkspaceApiRequest<{ files?: Array<{ id: string; name: string }> }>({
    workspaceId,
    moduleId: 'drive',
    url: `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name contains '${query.replace(/'/g, "\\'")}'`)}&fields=files(id,name)`,
  });

  return (payload.files ?? []).map((file) => ({
    ...file,
    url: buildDriveFileUrl(file.id),
  }));
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
