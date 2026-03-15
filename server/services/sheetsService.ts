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

async function formatSpreadsheetHeader(workspaceId: string, spreadsheetId: string, totalRows: number): Promise<void> {
  if (totalRows < 1) return;
  try {
    await googleWorkspaceApiRequest({
      workspaceId,
      moduleId: 'sheets',
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      method: 'POST',
      body: {
        requests: [
          // Bold header row with dark blue background + white text
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.11, green: 0.306, blue: 0.714 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    fontSize: 11,
                  },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // Alternating row colors for readability (light blue tint on even rows)
          ...(totalRows > 1 ? [{
            addConditionalFormatRule: {
              rule: {
                ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: totalRows }],
                booleanRule: {
                  condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=ISEVEN(ROW())' }] },
                  format: { backgroundColor: { red: 0.937, green: 0.953, blue: 0.996 } },
                },
              },
              index: 0,
            },
          }] : []),
          // Freeze the header row
          {
            updateSheetProperties: {
              properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // Auto-resize all columns
          {
            autoResizeDimensions: {
              dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 26 },
            },
          },
          // Set a minimum row height for header
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 40 },
              fields: 'pixelSize',
            },
          },
        ],
      },
    });
  } catch {
    // Formatting is best-effort — sheet content is already saved
  }
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
    await formatSpreadsheetHeader(workspaceId, payload.spreadsheetId, input.rows.length);
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

export async function readGoogleSpreadsheet(workspaceId: string, spreadsheetId: string): Promise<{
  id: string;
  title: string;
  url: string;
  sheets: Array<{ name: string; rows: string[][] }>;
}> {
  const meta = await googleWorkspaceApiRequest<{
    spreadsheetId: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  }>({
    workspaceId,
    moduleId: 'sheets',
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
  });

  const sheetNames = (meta.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((n): n is string => Boolean(n));

  const sheets: Array<{ name: string; rows: string[][] }> = [];
  for (const name of sheetNames.slice(0, 5)) {
    const range = encodeURIComponent(`${name}!A1:Z200`);
    try {
      const data = await googleWorkspaceApiRequest<{ values?: string[][] }>({
        workspaceId,
        moduleId: 'sheets',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
      });
      sheets.push({ name, rows: data.values ?? [] });
    } catch {
      sheets.push({ name, rows: [] });
    }
  }

  return {
    id: meta.spreadsheetId,
    title: meta.properties?.title ?? spreadsheetId,
    url: buildSheetsUrl(meta.spreadsheetId),
    sheets,
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
