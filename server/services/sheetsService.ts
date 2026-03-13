import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';
import { moveDriveFileToFolder } from './driveService';

interface SheetResult {
  id: string;
  title: string;
  url: string;
}

function buildSheetsUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export async function createGoogleSpreadsheet(workspaceId: string, input: {
  title: string;
  rows?: string[][];
  folderId?: string;
}): Promise<SheetResult> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);
  const payload = await googleWorkspaceApiRequest<{ spreadsheetId: string; properties?: { title?: string } }>({
    workspaceId,
    moduleId: 'sheets',
    url: 'https://sheets.googleapis.com/v4/spreadsheets',
    method: 'POST',
    body: {
      properties: { title: input.title },
    },
  });

  if (input.rows?.length) {
    await appendSpreadsheetRows(workspaceId, {
      spreadsheetId: payload.spreadsheetId,
      rows: input.rows,
    });
  }

  const folderId = input.folderId || defaults.defaultSheetsFolderId;
  if (folderId) {
    await moveDriveFileToFolder(workspaceId, { fileId: payload.spreadsheetId, folderId });
  }

  return {
    id: payload.spreadsheetId,
    title: payload.properties?.title ?? input.title,
    url: buildSheetsUrl(payload.spreadsheetId),
  };
}

export async function appendSpreadsheetRows(workspaceId: string, input: {
  spreadsheetId: string;
  rows: string[][];
  range?: string;
}): Promise<SheetResult> {
  const encodedRange = encodeURIComponent(input.range ?? 'Sheet1!A1');
  const payload = await googleWorkspaceApiRequest<{ spreadsheetId: string; tableRange?: string; updates?: { updatedRange?: string } }>({
    workspaceId,
    moduleId: 'sheets',
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.spreadsheetId)}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`,
    method: 'POST',
    body: {
      values: input.rows,
    },
  });

  return {
    id: payload.spreadsheetId,
    title: payload.updates?.updatedRange ?? payload.tableRange ?? 'Updated spreadsheet',
    url: buildSheetsUrl(payload.spreadsheetId),
  };
}
