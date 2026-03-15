import { googleWorkspaceApiRequest } from './googleWorkspaceService';

interface GmailMessageResult {
  id: string;
  threadId?: string;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildRawMessage(input: {
  to: string | string[];
  subject: string;
  bodyText: string;
  cc?: string | string[];
  bcc?: string | string[];
}): string {
  const to = Array.isArray(input.to) ? input.to.join(', ') : input.to;
  const cc = Array.isArray(input.cc) ? input.cc.join(', ') : input.cc;
  const bcc = Array.isArray(input.bcc) ? input.bcc.join(', ') : input.bcc;
  return [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.bodyText,
  ].filter(Boolean).join('\r\n');
}

export async function createGmailDraft(workspaceId: string, input: {
  to: string | string[];
  subject: string;
  bodyText: string;
  cc?: string | string[];
  bcc?: string | string[];
}): Promise<GmailMessageResult> {
  const payload = await googleWorkspaceApiRequest<{ id: string; message?: { id?: string; threadId?: string } }>({
    workspaceId,
    moduleId: 'gmail',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    method: 'POST',
    body: {
      message: {
        raw: toBase64Url(buildRawMessage(input)),
      },
    },
  });

  return {
    id: payload.id,
    threadId: payload.message?.threadId,
  };
}

export async function sendGmailMessage(workspaceId: string, input: {
  to: string | string[];
  subject: string;
  bodyText: string;
  cc?: string | string[];
  bcc?: string | string[];
}): Promise<GmailMessageResult> {
  const payload = await googleWorkspaceApiRequest<{ id: string; threadId?: string }>({
    workspaceId,
    moduleId: 'gmail',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    method: 'POST',
    body: {
      raw: toBase64Url(buildRawMessage(input)),
    },
  });

  return {
    id: payload.id,
    threadId: payload.threadId,
  };
}

export async function searchGmailMessages(workspaceId: string, query: string): Promise<Array<{ id: string; threadId?: string }>> {
  const payload = await googleWorkspaceApiRequest<{ messages?: Array<{ id: string; threadId?: string }> }>({
    workspaceId,
    moduleId: 'gmail',
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
  });

  return payload.messages ?? [];
}

export async function readGmailMessage(workspaceId: string, messageId: string): Promise<{
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  snippet: string;
}> {
  const msg = await googleWorkspaceApiRequest<{
    id: string;
    threadId: string;
    snippet?: string;
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    };
  }>({
    workspaceId,
    moduleId: 'gmail',
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
  });

  const headers = msg.payload?.headers ?? [];
  const getHeader = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  function decodeBody(data?: string): string {
    if (!data) return '';
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  }

  // Try direct body first, then parts
  let body = decodeBody(msg.payload?.body?.data);
  if (!body && msg.payload?.parts) {
    const textPart = msg.payload.parts.find((p) => p.mimeType === 'text/plain');
    body = decodeBody(textPart?.body?.data);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader('subject'),
    from: getHeader('from'),
    to: getHeader('to'),
    date: getHeader('date'),
    body: body.trim(),
    snippet: msg.snippet ?? '',
  };
}
