/**
 * Gmail Skills — updated to use real gmailService (Phase 3)
 */
import type { Skill } from '../types';
import { sendGmail, draftGmail, readGmailInbox } from '../../services/gmailService';

export const gmailSendSkill: Skill = {
    id: 'gmail.send',
    name: 'Send Gmail',
    description: 'Send an email via Gmail. Use when the user asks to email someone, reply to a thread, or send a message.',
    version: '2.0.0',
    category: 'communication',
    personas: ['sales', 'marketer', 'founder', 'developer'],
    requiresIntegration: ['gmail'],
    triggerPhrases: [
        'Send an email to Sarah',
        'Reply to this email thread',
        'Email the team about this',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject line' },
            body: { type: 'string', description: 'Email body — plain text' },
            replyToThreadId: { type: 'string', description: 'Optional: Gmail thread ID if replying to existing thread' },
        },
        required: ['to', 'subject', 'body'],
    },
    handler: async (ctx, args) => {
        const result = await sendGmail(ctx.workspaceId, {
            to: String(args.to ?? ''),
            subject: String(args.subject ?? ''),
            body: String(args.body ?? ''),
            replyToThreadId: typeof args.replyToThreadId === 'string' ? args.replyToThreadId : undefined,
        });
        return {
            success: true,
            output: result,
            message: `✅ Email sent to ${String(args.to ?? '')} (message ID: ${result.messageId})`,
        };
    },
};

export const gmailDraftSkill: Skill = {
    id: 'gmail.draft',
    name: 'Draft Gmail',
    description: 'Create a Gmail draft without sending. Use when the user wants to prepare an email for review before sending.',
    version: '2.0.0',
    category: 'communication',
    personas: ['sales', 'marketer', 'founder'],
    requiresIntegration: ['gmail'],
    triggerPhrases: [
        'Draft an email to this person',
        'Prepare an email I can review',
        'Write an email draft',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body' },
        },
        required: ['to', 'subject', 'body'],
    },
    handler: async (ctx, args) => {
        const result = await draftGmail(ctx.workspaceId, {
            to: String(args.to ?? ''),
            subject: String(args.subject ?? ''),
            body: String(args.body ?? ''),
        });
        return {
            success: true,
            output: result,
            message: `✅ Draft saved in Gmail (${result.url})`,
        };
    },
};

export const gmailReadInboxSkill: Skill = {
    id: 'gmail.read-inbox',
    name: 'Read Gmail Inbox',
    description: 'Fetch recent emails from Gmail inbox. Use when the user asks about unread emails, recent messages, or wants to know what needs a reply.',
    version: '2.0.0',
    category: 'communication',
    personas: ['sales', 'marketer', 'founder', 'developer'],
    requiresIntegration: ['gmail'],
    triggerPhrases: [
        'What emails do I have?',
        'Any urgent emails?',
        'Check my inbox',
        'What needs a reply?',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Gmail search query (e.g. "is:unread", "from:sarah")' },
            maxResults: { type: 'number', description: 'Max number of emails to return (default: 10)' },
        },
    },
    handler: async (ctx, args) => {
        const messages = await readGmailInbox(ctx.workspaceId, {
            query: typeof args.query === 'string' ? args.query : 'is:inbox',
            maxResults: typeof args.maxResults === 'number' ? args.maxResults : 10,
        });

        if (messages.length === 0) {
            return { success: true, output: [], message: 'No emails found matching the query.' };
        }

        const summary = messages.map((m, i) =>
            `${i + 1}. **${m.subject || '(no subject)'}**\n   From: ${m.from}\n   ${m.snippet}`
        ).join('\n\n');

        return {
            success: true,
            output: messages,
            message: `📧 Found ${messages.length} emails:\n\n${summary}`,
        };
    },
};
