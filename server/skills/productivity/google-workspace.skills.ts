import type { Skill } from '../types';
import { parseStringMatrixArgument, requireExplicitApproval } from '../framework';
import { createCalendarEvent, listCalendarEvents } from '../../services/calendarService';
import { createGoogleDocument, appendToGoogleDocument, readGoogleDocument } from '../../services/docsService';
import { createDriveFolder, searchDriveFiles } from '../../services/driveService';
import { inferAutoImageQuery } from '../../services/autoVisuals';
import { resolveGoogleResourceId } from '../../services/googleResourceResolver';
import { createGmailDraft, searchGmailMessages, sendGmailMessage } from '../../services/gmailService';
import { createGoogleSpreadsheet, appendSpreadsheetRows, readGoogleSpreadsheet } from '../../services/sheetsService';
import { createGooglePresentation, addSlidesToPresentation } from '../../services/slidesService';
import { searchStockImage } from '../../services/imageSearchService';

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function parseRows(value: unknown): string[][] {
  if (typeof value === 'undefined') {
    return [];
  }

  return parseStringMatrixArgument(value, 'rows');
}

function parseSlides(value: unknown): Array<{ title: string; body?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      return {
        title: String(record.title ?? `Slide ${index + 1}`),
        body: typeof record.body === 'string' ? record.body : undefined,
      };
    }

    return {
      title: `Slide ${index + 1}`,
      body: String(item ?? ''),
    };
  });
}

type ImageInput = { url: string; altText?: string };
type SlideInput = { title: string; body?: string; imageUrl?: string; imageQuery?: string };

function parseImageInputs(value: unknown): ImageInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    if (!url) {
      return [];
    }

    return [{
      url,
      altText: typeof record.altText === 'string' ? record.altText : undefined,
    }];
  });
}

function parseSlidesWithImages(value: unknown): SlideInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      return {
        title: String(record.title ?? `Slide ${index + 1}`),
        body: typeof record.body === 'string' ? record.body : undefined,
        imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : undefined,
        imageQuery: typeof record.imageQuery === 'string' ? record.imageQuery : undefined,
      };
    }

    return {
      title: `Slide ${index + 1}`,
      body: String(item ?? ''),
    };
  });
}

async function resolveImageInputs(images: ImageInput[], imageQuery?: string): Promise<ImageInput[]> {
  if (images.length > 0) {
    return images;
  }

  if (!imageQuery?.trim()) {
    return [];
  }

  const image = await searchStockImage(imageQuery);
  return image ? [{ url: image.url, altText: image.altText }] : [];
}

async function resolveSlidesWithImages(slides: SlideInput[]): Promise<Array<{ title: string; body?: string; imageUrl?: string }>> {
  return Promise.all(slides.map(async (slide) => {
    if (slide.imageUrl?.trim()) {
      return {
        title: slide.title,
        body: slide.body,
        imageUrl: slide.imageUrl.trim(),
      };
    }

    if (!slide.imageQuery?.trim()) {
      return {
        title: slide.title,
        body: slide.body,
      };
    }

    const image = await searchStockImage(slide.imageQuery);
    return {
      title: slide.title,
      body: slide.body,
      imageUrl: image?.url,
    };
  }));
}

type GoogleWorkspaceFileKind = 'document' | 'presentation' | 'spreadsheet';

function getGoogleWorkspaceFileUrl(
  result: { id?: unknown; url?: unknown },
  kind: GoogleWorkspaceFileKind,
): string | undefined {
  if (typeof result.url === 'string') {
    return result.url;
  }

  if (typeof result.id !== 'string') {
    return undefined;
  }

  if (kind === 'document') {
    return `https://docs.google.com/document/d/${result.id}/edit`;
  }

  if (kind === 'spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${result.id}/edit`;
  }

  return `https://docs.google.com/presentation/d/${result.id}/edit`;
}

function buildEmptyCreateNote(itemCount: number, itemLabel: string, followUpSkillId: string): string {
  if (itemCount > 0) {
    return '';
  }

  return ` Note: no ${itemLabel} data was provided - the file was created empty. Use ${followUpSkillId} to populate it.`;
}

const googleBaseFields = {
  approved: { type: 'boolean' as const, description: 'Set to true only after the user explicitly confirms this side effect.' },
};

export const googleGmailDraftEmailSkill: Skill = {
  id: 'google.gmail-draft-email',
  name: 'Draft Gmail Email',
  description: 'Create a Gmail draft in the connected Google Workspace account.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Draft an email in Gmail', 'Prepare a client email', 'Create a Gmail draft'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'array', description: 'Email recipients.', items: { type: 'string', description: 'Recipient email address.' } },
      cc: { type: 'array', description: 'Optional cc recipients.', items: { type: 'string', description: 'CC recipient email address.' } },
      bcc: { type: 'array', description: 'Optional bcc recipients.', items: { type: 'string', description: 'BCC recipient email address.' } },
      subject: { type: 'string', description: 'Email subject line.' },
      bodyText: { type: 'string', description: 'Plain text email body.' },
    },
    required: ['to', 'subject', 'bodyText'],
  },
  handler: async (ctx, args) => {
    const result = await createGmailDraft(ctx.workspaceId, {
      to: parseStringArray(args.to),
      cc: parseStringArray(args.cc),
      bcc: parseStringArray(args.bcc),
      subject: String(args.subject ?? ''),
      bodyText: String(args.bodyText ?? ''),
    });
    return {
      success: true,
      output: result,
      message: `✅ Gmail draft saved — subject: "${String(args.subject ?? '')}" to ${parseStringArray(args.to).join(', ')}. You can review and send it from Gmail.`,
    };
  },
};

export const googleGmailSendEmailSkill: Skill = {
  id: 'google.gmail-send-email',
  name: 'Send Gmail Email',
  description: 'Send an email through Gmail after explicit approval.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Send this email now', 'Email the client', 'Send the Gmail draft'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...googleBaseFields,
      to: { type: 'array', description: 'Email recipients.', items: { type: 'string', description: 'Recipient email address.' } },
      cc: { type: 'array', description: 'Optional cc recipients.', items: { type: 'string', description: 'CC recipient email address.' } },
      bcc: { type: 'array', description: 'Optional bcc recipients.', items: { type: 'string', description: 'BCC recipient email address.' } },
      subject: { type: 'string', description: 'Email subject line.' },
      bodyText: { type: 'string', description: 'Plain text email body.' },
    },
    required: ['to', 'subject', 'bodyText'],
  },
  handler: async (ctx, args) => {
    requireExplicitApproval(args, 'Sending Gmail email');
    const result = await sendGmailMessage(ctx.workspaceId, {
      to: parseStringArray(args.to),
      cc: parseStringArray(args.cc),
      bcc: parseStringArray(args.bcc),
      subject: String(args.subject ?? ''),
      bodyText: String(args.bodyText ?? ''),
    });
    return {
      success: true,
      output: result,
      message: `✅ Email sent via Gmail — "${String(args.subject ?? '')}" to ${parseStringArray(args.to).join(', ')}.`,
    };
  },
};

export const googleGmailSearchSkill: Skill = {
  id: 'google.gmail-search',
  name: 'Search Gmail',
  description: 'Search Gmail messages in the connected Google Workspace account.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Search Gmail', 'Find that email', 'Look up messages in Gmail'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Gmail search query string.' },
    },
    required: ['query'],
  },
  handler: async (ctx, args) => {
    const results = await searchGmailMessages(ctx.workspaceId, String(args.query ?? ''));
    return {
      success: true,
      output: results,
      message: `Found ${Array.isArray(results) ? results.length : 0} Gmail message(s) matching "${String(args.query ?? '')}".`,
    };
  },
};

export const googleDocsCreateDocumentSkill: Skill = {
  id: 'google.docs-create-document',
  name: 'Create Google Doc',
  description: 'Create a Google Doc and immediately populate it when content is provided.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Google Doc', 'Save this as a doc', 'Write this into Docs'],
  usageExamples: [
    'Create a Google Doc called Q2 Launch Brief and add the summary inside it',
    'Make a Google Doc for meeting notes and put this outline in it',
  ],
  invokingMessage: 'Creating the Google Doc and filling in the first draft.',
  invokedMessage: 'Google Doc created and ready.',
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Document title.' },
      content: { type: 'string', description: 'Optional initial document text.' },
      imageQuery: { type: 'string', description: 'Optional stock-image query to add one relevant image to the doc.' },
      images: {
        type: 'array',
        description: 'Optional explicit image URLs to insert into the document.',
        items: {
          type: 'object',
          description: 'A single image definition.',
          properties: {
            url: { type: 'string', description: 'Public image URL.' },
            altText: { type: 'string', description: 'Optional accessible alt text.' },
          },
          required: ['url'],
        },
      },
      folderId: { type: 'string', description: 'Optional Drive folder override.' },
    },
    required: ['title'],
  },
  handler: async (ctx, args) => {
    const title = String(args.title ?? '');
    const imageQuery = typeof args.imageQuery === 'string' && args.imageQuery.trim()
      ? args.imageQuery
      : inferAutoImageQuery({
          target: 'docs',
          title,
          content: typeof args.content === 'string' ? args.content : undefined,
        });
    const images = await resolveImageInputs(
      parseImageInputs(args.images),
      imageQuery,
    );
    const result = await createGoogleDocument(ctx.workspaceId, {
      title,
      content: typeof args.content === 'string' ? args.content : undefined,
      images,
      folderId: typeof args.folderId === 'string' ? args.folderId : undefined,
    });
    const docUrl = getGoogleWorkspaceFileUrl(result, 'document');
    return {
      success: true,
      output: result,
      message: `✅ Google Doc "${title}" created successfully!${docUrl ? ` Open it here: ${docUrl}` : ''}`,
    };
  },
};

export const googleDocsAppendContentSkill: Skill = {
  id: 'google.docs-append-content',
  name: 'Append Google Doc Content',
  description: 'Append text content to an existing Google Doc, using a doc ID, visible URL, or document title.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Append to the doc', 'Add this to Google Docs'],
  usageExamples: [
    'Add this section to the Google Doc that is open on screen',
    'Append this research summary to the Google Doc named Product Notes',
  ],
  invokingMessage: 'Adding the new content to Google Docs.',
  invokedMessage: 'Google Doc updated.',
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      documentId: { type: 'string', description: 'Google Document ID or full Google Docs URL.' },
      documentTitle: { type: 'string', description: 'Optional document title fallback if the ID is missing.' },
      content: { type: 'string', description: 'Text to append.' },
      screenContext: { type: 'string', description: 'Optional: pass the visible URL from screen if the user is looking at a doc. The skill will extract the document ID automatically.' },
    },
    required: ['content'],
  },
  handler: async (ctx, args) => {
    const documentId = await resolveGoogleResourceId({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      explicitId: args.documentId,
      screenContext: args.screenContext,
      title: args.documentTitle,
      urlPattern: /\/document\/d\/([a-zA-Z0-9_-]+)/,
      mimeType: 'application/vnd.google-apps.document',
      label: 'documentId',
      recentCreateSkillId: 'google.docs-create-document',
    });
    const result = await appendToGoogleDocument(ctx.workspaceId, {
      documentId,
      content: String(args.content ?? ''),
    });
    return {
      success: true,
      output: result,
      message: `✅ Content appended to Google Doc ${documentId}.`,
    };
  },
};

export const googleSheetsCreateSpreadsheetSkill: Skill = {
  id: 'google.sheets-create-spreadsheet',
  name: 'Create Google Sheet',
  description: 'Create a Google Sheet and immediately populate it when rows are provided.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Google Sheet', 'Make a spreadsheet', 'Create a leads sheet'],
  usageExamples: [
    'Create a Google Sheet called Top 10 NSE Stocks Analysis and add the table rows',
    'Make a spreadsheet for leads and include headers plus the first records',
  ],
  invokingMessage: 'Creating the Google Sheet and preparing the rows.',
  invokedMessage: 'Google Sheet created and ready.',
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Spreadsheet title.' },
      rows: {
        type: 'array',
        description: 'Optional 2D array of rows.',
        items: {
          type: 'array',
          description: 'A single row of cells.',
          items: { type: 'string', description: 'Cell value.' },
        },
      },
      folderId: { type: 'string', description: 'Optional Drive folder override.' },
    },
    required: ['title'],
  },
  handler: async (ctx, args) => {
    const rows = parseRows(args.rows);
    const title = String(args.title ?? '');
    const emptyNote = buildEmptyCreateNote(rows.length, 'row', 'google.sheets-append-rows');
    const result = await createGoogleSpreadsheet(ctx.workspaceId, {
      title,
      rows,
      folderId: typeof args.folderId === 'string' ? args.folderId : undefined,
    });
    const sheetUrl = getGoogleWorkspaceFileUrl(result, 'spreadsheet');
    return {
      success: true,
      output: result,
      message: `✅ Google Sheet "${title}" created!${sheetUrl ? ` Open it here: ${sheetUrl}` : ''}${emptyNote}`,
    };
  },
};

export const googleSheetsAppendRowsSkill: Skill = {
  id: 'google.sheets-append-rows',
  name: 'Append Google Sheet Rows',
  description: 'Append rows into an existing Google Sheet, using a spreadsheet ID, visible URL, or sheet title.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Append rows to the sheet', 'Add these rows to Sheets'],
  usageExamples: [
    'Add these rows to the Google Sheet that is open on screen',
    'Append this data to the sheet named Weekly KPI Tracker',
  ],
  invokingMessage: 'Appending rows to Google Sheets.',
  invokedMessage: 'Google Sheet updated.',
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'Spreadsheet ID or full Google Sheets URL.' },
      spreadsheetTitle: { type: 'string', description: 'Optional spreadsheet title fallback if the ID is missing.' },
      rows: {
        type: 'array',
        description: '2D array of rows to append.',
        items: {
          type: 'array',
          description: 'A single row of cells.',
          items: { type: 'string', description: 'Cell value.' },
        },
      },
      range: { type: 'string', description: 'Optional A1 range.' },
      screenContext: { type: 'string', description: 'Optional: pass the visible URL from screen if the user is looking at a sheet. The skill will extract the spreadsheet ID automatically.' },
    },
    required: ['rows'],
  },
  handler: async (ctx, args) => {
    const spreadsheetId = await resolveGoogleResourceId({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      explicitId: args.spreadsheetId,
      screenContext: args.screenContext,
      title: args.spreadsheetTitle,
      urlPattern: /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      label: 'spreadsheetId',
      recentCreateSkillId: 'google.sheets-create-spreadsheet',
    });
    const result = await appendSpreadsheetRows(ctx.workspaceId, {
      spreadsheetId,
      rows: parseRows(args.rows),
      range: typeof args.range === 'string' ? args.range : undefined,
    });
    return {
      success: true,
      output: result,
      message: `✅ ${parseRows(args.rows).length} row(s) appended to Google Sheet ${spreadsheetId}.`,
    };
  },
};

export const googleSlidesCreatePresentationSkill: Skill = {
  id: 'google.slides-create-presentation',
  name: 'Create Google Slides Presentation',
  description: 'Create a Google Slides presentation and immediately populate it when slides are provided.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Slides deck', 'Make a presentation', 'Build a pitch deck'],
  usageExamples: [
    'Create a Slides deck called Top 10 NSE Stocks Analysis with one slide per stock',
    'Make a presentation for the quarterly review and include the outline as slides',
  ],
  invokingMessage: 'Creating the Slides deck and building the first slides.',
  invokedMessage: 'Google Slides deck created and ready.',
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Presentation title.' },
      slides: {
        type: 'array',
        description: 'Optional slide objects with title/body.',
        items: {
          type: 'object',
          description: 'A single slide definition.',
          properties: {
            title: { type: 'string', description: 'Slide title.' },
            body: { type: 'string', description: 'Optional slide body.' },
            imageUrl: { type: 'string', description: 'Optional explicit public image URL for this slide.' },
            imageQuery: { type: 'string', description: 'Optional stock-image query for this slide.' },
          },
          required: ['title'],
        },
      },
      folderId: { type: 'string', description: 'Optional Drive folder override.' },
    },
    required: ['title'],
  },
  handler: async (ctx, args) => {
    const slides = await resolveSlidesWithImages(parseSlidesWithImages(args.slides).map((slide) => ({
      ...slide,
      imageQuery: slide.imageQuery ?? inferAutoImageQuery({
        target: 'slides',
        title: slide.title,
        content: slide.body,
      }),
    })));
    const title = String(args.title ?? '');
    const emptyNote = buildEmptyCreateNote(slides.length, 'slide', 'google.slides-add-slides');
    const result = await createGooglePresentation(ctx.workspaceId, {
      title,
      slides,
      folderId: typeof args.folderId === 'string' ? args.folderId : undefined,
    });
    const slideUrl = getGoogleWorkspaceFileUrl(result, 'presentation');
    return {
      success: true,
      output: result,
      message: `✅ Google Slides presentation "${title}" created with ${slides.length} slide(s)!${slideUrl ? ` Open it here: ${slideUrl}` : ''}${emptyNote}`,
    };
  },
};

export const googleSlidesAddSlidesSkill: Skill = {
  id: 'google.slides-add-slides',
  name: 'Add Slides To Presentation',
  description: 'Append slides to an existing Google Slides presentation, using a presentation ID, visible URL, or deck title.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Add slides to the deck', 'Append slides to the presentation'],
  usageExamples: [
    'Add these slides to the presentation that is open on screen',
    'Append two slides to the deck named Board Update',
  ],
  invokingMessage: 'Adding slides to the presentation.',
  invokedMessage: 'Slides added to the deck.',
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      presentationId: { type: 'string', description: 'Presentation ID or full Google Slides URL.' },
      presentationTitle: { type: 'string', description: 'Optional presentation title fallback if the ID is missing.' },
      slides: {
        type: 'array',
        description: 'Slide objects with title/body.',
        items: {
          type: 'object',
          description: 'A single slide definition.',
          properties: {
            title: { type: 'string', description: 'Slide title.' },
            body: { type: 'string', description: 'Optional slide body.' },
            imageUrl: { type: 'string', description: 'Optional explicit public image URL for this slide.' },
            imageQuery: { type: 'string', description: 'Optional stock-image query for this slide.' },
          },
          required: ['title'],
        },
      },
      screenContext: { type: 'string', description: 'Optional: pass the visible URL from screen if the user is looking at a presentation. The skill will extract the presentation ID automatically.' },
    },
    required: ['slides'],
  },
  handler: async (ctx, args) => {
    const presentationId = await resolveGoogleResourceId({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      explicitId: args.presentationId,
      screenContext: args.screenContext,
      title: args.presentationTitle,
      urlPattern: /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
      mimeType: 'application/vnd.google-apps.presentation',
      label: 'presentationId',
      recentCreateSkillId: 'google.slides-create-presentation',
    });
    const result = await addSlidesToPresentation(ctx.workspaceId, {
      presentationId,
      slides: await resolveSlidesWithImages(parseSlidesWithImages(args.slides).map((slide) => ({
        ...slide,
        imageQuery: slide.imageQuery ?? inferAutoImageQuery({
          target: 'slides',
          title: slide.title,
          content: slide.body,
        }),
      }))),
    });
    return {
      success: true,
      output: result,
      message: `✅ ${parseSlides(args.slides).length} slide(s) added to presentation ${presentationId}.`,
    };
  },
};

export const googleDriveSearchFilesSkill: Skill = {
  id: 'google.drive-search-files',
  name: 'Search Google Drive Files',
  description: 'Search files in Google Drive by filename or title text.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Search Drive', 'Find a Google file'],
  usageExamples: [
    'Find the Google Sheet named Top 10 NSE Stocks Analysis',
    'Search Drive for files with Board Update in the title',
  ],
  invokingMessage: 'Searching Google Drive for the right file.',
  invokedMessage: 'Google Drive search complete.',
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Filename search query.' },
    },
    required: ['query'],
  },
  handler: async (ctx, args) => {
    const results = await searchDriveFiles(ctx.workspaceId, String(args.query ?? ''));
    return {
      success: true,
      output: results,
      message: `Found ${Array.isArray(results) ? results.length : 0} file(s) in Drive matching "${String(args.query ?? '')}".`,
    };
  },
};

export const googleDriveCreateFolderSkill: Skill = {
  id: 'google.drive-create-folder',
  name: 'Create Google Drive Folder',
  description: 'Create a folder in Google Drive.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a Drive folder', 'Make a Google Drive folder'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Folder name.' },
      parentFolderId: { type: 'string', description: 'Optional parent Drive folder ID.' },
    },
    required: ['name'],
  },
  handler: async (ctx, args) => {
    const result = await createDriveFolder(ctx.workspaceId, {
      name: String(args.name ?? ''),
      parentFolderId: typeof args.parentFolderId === 'string' ? args.parentFolderId : undefined,
    });
    const folderUrl = typeof result.url === 'string' ? result.url : (typeof result.id === 'string' ? `https://drive.google.com/drive/folders/${result.id}` : undefined);
    return {
      success: true,
      output: result,
      message: `✅ Drive folder "${String(args.name ?? '')}" created!${folderUrl ? ` Open it here: ${folderUrl}` : ''}`,
    };
  },
};

export const googleCalendarCreateEventSkill: Skill = {
  id: 'google.calendar-create-event',
  name: 'Create Google Calendar Event',
  description: 'Create a Google Calendar event after explicit approval.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Create a calendar invite', 'Schedule the meeting in Google Calendar'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      ...googleBaseFields,
      summary: { type: 'string', description: 'Event title.' },
      description: { type: 'string', description: 'Optional event description.' },
      start: { type: 'string', description: 'RFC3339 event start datetime.' },
      end: { type: 'string', description: 'RFC3339 event end datetime.' },
      attendees: { type: 'array', description: 'Optional attendee emails.', items: { type: 'string', description: 'Attendee email address.' } },
      calendarId: { type: 'string', description: 'Optional calendar ID override.' },
    },
    required: ['summary', 'start', 'end'],
  },
  handler: async (ctx, args) => {
    requireExplicitApproval(args, 'Creating a Google Calendar event');
    const result = await createCalendarEvent(ctx.workspaceId, {
      summary: String(args.summary ?? ''),
      description: typeof args.description === 'string' ? args.description : undefined,
      start: String(args.start ?? ''),
      end: String(args.end ?? ''),
      attendees: parseStringArray(args.attendees),
      calendarId: typeof args.calendarId === 'string' ? args.calendarId : undefined,
    });
    const attendeeList = parseStringArray(args.attendees);
    return {
      success: true,
      output: result,
      message: `✅ Calendar event "${String(args.summary ?? '')}" scheduled from ${String(args.start ?? '')} to ${String(args.end ?? '')}${attendeeList.length > 0 ? `. Attendees invited: ${attendeeList.join(', ')}` : ''}.`,
    };
  },
};

export const googleCalendarListEventsSkill: Skill = {
  id: 'google.calendar-list-events',
  name: 'List Google Calendar Events',
  description: 'List upcoming events from Google Calendar.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['What is on my Google Calendar?', 'List calendar events'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      calendarId: { type: 'string', description: 'Optional calendar ID override.' },
      timeMin: { type: 'string', description: 'Optional RFC3339 minimum start time.' },
      maxResults: { type: 'number', description: 'Maximum number of events to return.' },
    },
  },
  handler: async (ctx, args) => {
    const results = await listCalendarEvents(ctx.workspaceId, {
      calendarId: typeof args.calendarId === 'string' ? args.calendarId : undefined,
      timeMin: typeof args.timeMin === 'string' ? args.timeMin : undefined,
      maxResults: typeof args.maxResults === 'number' ? args.maxResults : undefined,
    });
    const count = Array.isArray(results) ? results.length : 0;
    return {
      success: true,
      output: results,
      message: count === 0
        ? 'No upcoming calendar events found.'
        : `Found ${count} upcoming event(s) on your calendar.`,
    };
  },
};

export const googleDocsReadDocumentSkill: Skill = {
  id: 'google.docs-read-document',
  name: 'Read Google Doc',
  description: 'Read the full text content of a Google Doc by ID or URL. Use this when the user references a doc, wants to summarise it, or needs its content for a downstream task.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Read my Google Doc', 'Summarise this document', 'What does this doc say'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      documentId: { type: 'string', description: 'Google Doc ID or full URL.' },
    },
    required: ['documentId'],
  },
  handler: async (ctx, args) => {
    const result = await readGoogleDocument(ctx.workspaceId, String(args.documentId ?? ''));
    return {
      success: true,
      output: result,
      message: `Read "${result.title}" — ${result.text.length} characters of content.`,
    };
  },
};

export const googleSheetsReadSpreadsheetSkill: Skill = {
  id: 'google.sheets-read-spreadsheet',
  name: 'Read Google Sheet',
  description: 'Read the rows and cells of a Google Spreadsheet by ID or URL. Returns all sheets with their data. Use when the user wants to analyse, summarise, or act on spreadsheet data.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Read my Google Sheet', 'Analyse this spreadsheet', 'What data is in this sheet'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'Google Sheets ID or full URL.' },
    },
    required: ['spreadsheetId'],
  },
  handler: async (ctx, args) => {
    const id = String(args.spreadsheetId ?? '').trim();
    const urlMatch = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const resolvedId = urlMatch ? urlMatch[1] : id;
    const result = await readGoogleSpreadsheet(ctx.workspaceId, resolvedId);
    const totalRows = result.sheets.reduce((sum, s) => sum + s.rows.length, 0);
    return {
      success: true,
      output: result,
      message: `Read "${result.title}" — ${result.sheets.length} sheet(s), ${totalRows} total rows.`,
    };
  },
};

export const googleGmailReadMessageSkill: Skill = {
  id: 'google.gmail-read-message',
  name: 'Read Gmail Message',
  description: 'Read the full content of a specific Gmail message by ID. Returns subject, sender, body text, and date. Use this after searching Gmail to get the actual email content for summarising, replying, or acting on.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Read this email', 'What does this email say', 'Open this Gmail message'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      messageId: { type: 'string', description: 'Gmail message ID (from search results).' },
    },
    required: ['messageId'],
  },
  handler: async (ctx, args) => {
    const { readGmailMessage } = await import('../../services/gmailService');
    const result = await readGmailMessage(ctx.workspaceId, String(args.messageId ?? ''));
    return {
      success: true,
      output: result,
      message: `Email from ${result.from} — Subject: "${result.subject}"`,
    };
  },
};

export const googleSlidesReadPresentationSkill: Skill = {
  id: 'google.slides-read-presentation',
  name: 'Read Google Slides',
  description: 'Read the content of an existing Google Slides presentation by ID or URL. Returns all slide titles and body text. Use when the user references a deck, wants to summarise it, or needs its content for a downstream task.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['google-workspace'],
  triggerPhrases: ['Read my presentation', 'What does this deck say', 'Summarise these slides'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      presentationId: { type: 'string', description: 'Google Slides presentation ID or full URL.' },
    },
    required: ['presentationId'],
  },
  handler: async (ctx, args) => {
    const { readGooglePresentation } = await import('../../services/slidesService');
    const id = String(args.presentationId ?? '').trim();
    const urlMatch = id.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    const resolvedId = urlMatch ? urlMatch[1] : id;
    const result = await readGooglePresentation(ctx.workspaceId, resolvedId);
    return {
      success: true,
      output: result,
      message: `Read "${result.title}" — ${result.slides.length} slide(s).`,
    };
  },
};
