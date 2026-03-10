/**
 * Gmail Service — Phase 3: Real Google OAuth2 integration
 * 
 * OAuth flow:
 *   1. User visits GET /api/auth/gmail  → redirects to Google consent screen
 *   2. Google redirects to GET /api/auth/gmail/callback?code=...
 *   3. We exchange code for tokens, store encrypted in integration_connections
 *   4. All subsequent calls use the stored refresh_token to get fresh access_token
 * 
 * Scopes requested:
 *   - gmail.readonly  (read inbox)
 *   - gmail.send      (send emails)
 *   - gmail.compose   (create drafts)
 */
import { getEffectiveIntegrationConfig, saveIntegrationConfig } from './integrationConfigService';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
].join(' ');

export interface GmailMessage {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    isRead: boolean;
    labels: string[];
}

export interface GmailSendResult {
    messageId: string;
    threadId: string;
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function buildGmailAuthUrl(workspaceId: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:8787/api/auth/gmail/callback';

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GMAIL_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: workspaceId, // pass workspaceId through OAuth state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailCode(workspaceId: string, code: string): Promise<void> {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:8787/api/auth/gmail/callback';

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gmail OAuth token exchange failed: ${text}`);
    }

    const tokens = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
    };

    // Store tokens encrypted in integration_connections
    await saveIntegrationConfig(workspaceId, 'gmail', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? '',
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });
}

async function getGmailAccessToken(workspaceId: string): Promise<string> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'gmail');
    const accessToken = config.accessToken as string ?? '';
    const refreshToken = config.refreshToken as string ?? '';
    const expiresAt = config.expiresAt as string ?? '';

    if (!refreshToken) {
        throw new Error('Gmail not connected. Visit Settings > Integrations to connect Gmail.');
    }

    // Check if token is still valid (with 60s buffer)
    if (accessToken && expiresAt && new Date(expiresAt).getTime() > Date.now() + 60000) {
        return accessToken;
    }

    // Refresh the token
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh Gmail token. Reconnect Gmail in Settings > Integrations.');
    }

    const tokens = await response.json() as {
        access_token: string;
        expires_in: number;
    };

    await saveIntegrationConfig(workspaceId, 'gmail', {
        accessToken: tokens.access_token,
        refreshToken,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });

    return tokens.access_token;
}

// ── Gmail API calls ───────────────────────────────────────────────────────────

export function isGmailConfigured(workspaceId: string): boolean {
    const config = getEffectiveIntegrationConfig(workspaceId, 'gmail');
    return Boolean(config.refreshToken);
}

export async function readGmailInbox(
    workspaceId: string,
    options: { query?: string; maxResults?: number } = {}
): Promise<GmailMessage[]> {
    const token = await getGmailAccessToken(workspaceId);
    const query = options.query ?? 'is:inbox';
    const maxResults = options.maxResults ?? 10;

    // List messages
    const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listResponse.ok) {
        throw new Error(`Gmail list failed: ${listResponse.status}`);
    }

    const listData = await listResponse.json() as { messages?: Array<{ id: string; threadId: string }> };
    const messageIds = listData.messages ?? [];

    // Fetch message details in parallel (up to 5 at a time for perf)
    const messages = await Promise.all(
        messageIds.slice(0, maxResults).map(async (msg) => {
            const msgResponse = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From,Subject,Date`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const msgData = await msgResponse.json() as {
                id: string;
                threadId: string;
                snippet: string;
                labelIds: string[];
                payload: {
                    headers: Array<{ name: string; value: string }>;
                };
            };

            const getHeader = (name: string) =>
                msgData.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

            return {
                id: msgData.id,
                threadId: msgData.threadId,
                from: getHeader('From'),
                subject: getHeader('Subject'),
                snippet: msgData.snippet ?? '',
                date: getHeader('Date'),
                isRead: !(msgData.labelIds ?? []).includes('UNREAD'),
                labels: msgData.labelIds ?? [],
            };
        })
    );

    return messages;
}

export async function sendGmail(
    workspaceId: string,
    options: { to: string; subject: string; body: string; replyToThreadId?: string }
): Promise<GmailSendResult> {
    const token = await getGmailAccessToken(workspaceId);

    // Build RFC 2822 email
    const emailLines = [
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        options.body,
    ];
    const rawEmail = Buffer.from(emailLines.join('\n')).toString('base64url');

    const body: Record<string, string> = { raw: rawEmail };
    if (options.replyToThreadId) {
        body.threadId = options.replyToThreadId;
    }

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gmail send failed: ${response.status} ${text}`);
    }

    const result = await response.json() as { id: string; threadId: string };
    return { messageId: result.id, threadId: result.threadId };
}

export async function draftGmail(
    workspaceId: string,
    options: { to: string; subject: string; body: string }
): Promise<{ draftId: string; url: string }> {
    const token = await getGmailAccessToken(workspaceId);

    const emailLines = [
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        options.body,
    ];
    const rawEmail = Buffer.from(emailLines.join('\n')).toString('base64url');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: { raw: rawEmail } }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gmail draft failed: ${response.status} ${text}`);
    }

    const result = await response.json() as { id: string };
    return {
        draftId: result.id,
        url: `https://mail.google.com/mail/u/0/#drafts/${result.id}`,
    };
}
