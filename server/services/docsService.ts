import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';
import { moveDriveFileToFolder } from './driveService';

interface DocsDocumentResult {
  id: string;
  title: string;
  url: string;
}

interface DocsImageInput {
  url: string;
  altText?: string;
}

function buildDocsUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/edit`;
}

// ── Markdown → Docs batchUpdate requests ─────────────────────────────────────

type HeadingLevel = 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'NORMAL_TEXT';

function detectHeadingLevel(line: string): HeadingLevel {
  if (line.startsWith('### ')) return 'HEADING_3';
  if (line.startsWith('## ')) return 'HEADING_2';
  if (line.startsWith('# ')) return 'HEADING_1';
  return 'NORMAL_TEXT';
}

function stripMarkdownHeadingPrefix(line: string): string {
  return line.replace(/^#{1,3}\s+/, '');
}

/**
 * Convert markdown-like content into a sequence of Docs batchUpdate requests.
 *
 * Supported markdown:
 *   # H1, ## H2, ### H3  → HEADING_1/2/3 paragraph styles
 *   **bold** text         → bold updateTextStyle
 *   *italic* text         → italic updateTextStyle
 *   Plain text            → NORMAL_TEXT
 *
 * Returns [requests, totalInsertedChars] — callers need the char count to
 * compute the insertion offset for subsequent appends.
 */
function buildRichInsertRequests(
  content: string,
  startIndex: number,
): { requests: object[]; endIndex: number } {
  const lines = content.split('\n');
  const requests: object[] = [];
  let cursor = startIndex;

  for (const rawLine of lines) {
    const headingLevel = detectHeadingLevel(rawLine);
    const strippedLine = stripMarkdownHeadingPrefix(rawLine);

    // Collect inline bold/italic ranges
    const inlineRanges: Array<{ start: number; end: number; bold?: boolean; italic?: boolean }> = [];

    // Parse **bold** and *italic* patterns within the stripped line.
    // We render the plain text (without markers) and collect style ranges.
    let plainText = '';
    let i = 0;
    while (i < strippedLine.length) {
      if (strippedLine[i] === '*' && strippedLine[i + 1] === '*') {
        // Bold: **text**
        const closeIdx = strippedLine.indexOf('**', i + 2);
        if (closeIdx !== -1) {
          const boldStart = cursor + plainText.length;
          const boldContent = strippedLine.slice(i + 2, closeIdx);
          plainText += boldContent;
          inlineRanges.push({ start: boldStart, end: boldStart + boldContent.length, bold: true });
          i = closeIdx + 2;
          continue;
        }
      } else if (strippedLine[i] === '*') {
        // Italic: *text*
        const closeIdx = strippedLine.indexOf('*', i + 1);
        if (closeIdx !== -1) {
          const italicStart = cursor + plainText.length;
          const italicContent = strippedLine.slice(i + 1, closeIdx);
          plainText += italicContent;
          inlineRanges.push({ start: italicStart, end: italicStart + italicContent.length, italic: true });
          i = closeIdx + 1;
          continue;
        }
      }
      plainText += strippedLine[i];
      i += 1;
    }

    const lineText = `${plainText}\n`;
    const lineStart = cursor;
    const lineEnd = cursor + lineText.length;

    // Insert the plain text for this line
    requests.push({
      insertText: {
        location: { index: cursor },
        text: lineText,
      },
    });

    // Apply heading paragraph style if needed
    if (headingLevel !== 'NORMAL_TEXT') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: lineStart, endIndex: lineEnd },
          paragraphStyle: { namedStyleType: headingLevel },
          fields: 'namedStyleType',
        },
      });
    }

    // Apply inline styles
    for (const range of inlineRanges) {
      const fields: string[] = [];
      const textStyle: Record<string, unknown> = {};
      if (range.bold) { textStyle.bold = true; fields.push('bold'); }
      if (range.italic) { textStyle.italic = true; fields.push('italic'); }
      if (fields.length > 0) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: range.start, endIndex: range.end },
            textStyle,
            fields: fields.join(','),
          },
        });
      }
    }

    cursor = lineEnd;
  }

  return { requests, endIndex: cursor };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function readGoogleDocument(workspaceId: string, documentId: string): Promise<{
  id: string;
  title: string;
  text: string;
  url: string;
}> {
  const doc = await googleWorkspaceApiRequest<{
    documentId: string;
    title: string;
    body?: {
      content?: Array<{
        paragraph?: {
          elements?: Array<{ textRun?: { content?: string } }>;
        };
      }>;
    };
  }>({
    workspaceId,
    moduleId: 'docs',
    url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
  });

  const text = (doc.body?.content ?? [])
    .flatMap((el) => el.paragraph?.elements ?? [])
    .map((el) => el.textRun?.content ?? '')
    .join('');

  return { id: doc.documentId, title: doc.title, text: text.trim(), url: buildDocsUrl(doc.documentId) };
}

export async function createGoogleDocument(workspaceId: string, input: {
  title: string;
  content?: string;
  folderId?: string;
  images?: DocsImageInput[];
}): Promise<DocsDocumentResult> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);
  const payload = await googleWorkspaceApiRequest<{ documentId: string; title: string }>({
    workspaceId,
    moduleId: 'docs',
    url: 'https://docs.googleapis.com/v1/documents',
    method: 'POST',
    body: { title: input.title },
  });

  try {
    if (input.content?.trim() || input.images?.length) {
      await appendToGoogleDocument(workspaceId, {
        documentId: payload.documentId,
        content: input.content ?? '',
        images: input.images,
      });
    }
  } catch (err) {
    console.error(`[docsService] Failed to append content to doc ${payload.documentId}:`, err instanceof Error ? err.message : err);
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
  images?: DocsImageInput[];
}): Promise<DocsDocumentResult> {
  // Fetch current doc to find the end index
  const doc = await googleWorkspaceApiRequest<{
    documentId: string;
    title: string;
    body?: { content?: Array<{ endIndex?: number }> };
  }>({
    workspaceId,
    moduleId: 'docs',
    url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(input.documentId)}`,
  });

  // Google Docs body always ends with a newline at endIndex, so insert at endIndex-1
  const rawEndIndex = Math.max(1, ...(doc.body?.content ?? []).map((item) => item.endIndex ?? 1));
  const insertAt = Math.max(1, rawEndIndex - 1);

  const { requests } = buildRichInsertRequests(input.content, insertAt);
  let imageInsertAt = requests.length > 0 ? rawEndIndex - 1 + input.content.split('\n').join('\n').length + (input.content ? 1 : 0) : insertAt;

  if (input.images?.length) {
    for (const image of input.images) {
      const imageUrl = image.url.trim();
      if (!imageUrl) {
        continue;
      }

      requests.push({
        insertText: {
          location: { index: imageInsertAt },
          text: '\n',
        },
      });
      imageInsertAt += 1;
      requests.push({
        insertInlineImage: {
          location: { index: imageInsertAt },
          uri: imageUrl,
          objectSize: {
            width: { magnitude: 400, unit: 'PT' },
            height: { magnitude: 225, unit: 'PT' },
          },
          ...(image.altText?.trim() ? { altText: { title: image.altText.trim() } } : {}),
        },
      });
      imageInsertAt += 1;
      requests.push({
        insertText: {
          location: { index: imageInsertAt },
          text: '\n',
        },
      });
      imageInsertAt += 1;
    }
  }

  // Google Docs API batchUpdate: send requests in chunks of 50 to avoid payload limits
  const CHUNK_SIZE = 50;
  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    const chunk = requests.slice(i, i + CHUNK_SIZE);
    await googleWorkspaceApiRequest({
      workspaceId,
      moduleId: 'docs',
      url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
      method: 'POST',
      body: { requests: chunk },
    });
  }

  return {
    id: doc.documentId,
    title: doc.title,
    url: buildDocsUrl(doc.documentId),
  };
}
