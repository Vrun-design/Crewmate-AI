import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';
import { moveDriveFileToFolder } from './driveService';

interface DocsDocumentResult {
  id: string;
  title: string;
  url: string;
}

function buildDocsUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/edit`;
}

export async function createGoogleDocument(workspaceId: string, input: {
  title: string;
  content?: string;
  folderId?: string;
}): Promise<DocsDocumentResult> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);
  const payload = await googleWorkspaceApiRequest<{ documentId: string; title: string }>({
    workspaceId,
    moduleId: 'docs',
    url: 'https://docs.googleapis.com/v1/documents',
    method: 'POST',
    body: { title: input.title },
  });

  if (input.content?.trim()) {
    await appendToGoogleDocument(workspaceId, {
      documentId: payload.documentId,
      content: input.content,
    });
  }

  const folderId = input.folderId || defaults.defaultDocsFolderId;
  if (folderId) {
    await moveDriveFileToFolder(workspaceId, { fileId: payload.documentId, folderId });
  }

  return {
    id: payload.documentId,
    title: payload.title,
    url: buildDocsUrl(payload.documentId),
  };
}

export async function appendToGoogleDocument(workspaceId: string, input: {
  documentId: string;
  content: string;
}): Promise<DocsDocumentResult> {
  const doc = await googleWorkspaceApiRequest<{ documentId: string; title: string; body?: { content?: Array<{ endIndex?: number }> } }>({
    workspaceId,
    moduleId: 'docs',
    url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(input.documentId)}`,
  });

  const endIndex = Math.max(1, ...(doc.body?.content ?? []).map((item) => item.endIndex ?? 1));
  await googleWorkspaceApiRequest({
    workspaceId,
    moduleId: 'docs',
    url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
    method: 'POST',
    body: {
      requests: [
        {
          insertText: {
            location: { index: Math.max(1, endIndex - 1) },
            text: `${input.content}\n`,
          },
        },
      ],
    },
  });

  return {
    id: doc.documentId,
    title: doc.title,
    url: buildDocsUrl(doc.documentId),
  };
}
