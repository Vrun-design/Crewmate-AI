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
