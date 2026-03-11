import type { Express, Request, Response } from 'express';
import { dispatchCommand, findCommandTargetByWorkspaceId } from '../services/commandIngressService';
import {
  getTelegramDefaultChatId,
  getTelegramWebhookSecret,
  isTelegramConfigured,
  postTelegramMessage,
  transcribeTelegramVoiceMessage,
} from '../services/telegramService';

interface TelegramVoicePayload {
  file_id?: string;
  mime_type?: string;
}

interface TelegramMessagePayload {
  chat?: { id?: number | string };
  from?: { first_name?: string; username?: string };
  message_id?: number;
  text?: string;
  voice?: TelegramVoicePayload;
}

interface TelegramUpdatePayload {
  message?: TelegramMessagePayload;
}

interface TelegramCommandContext {
  workspaceId: string;
  chatId: string;
  message: TelegramMessagePayload;
  target: NonNullable<ReturnType<typeof findCommandTargetByWorkspaceId>>;
}

type TelegramDispatchResult = Awaited<ReturnType<typeof dispatchCommand>>;

const TELEGRAM_HELP_MESSAGE = [
  'Crewmate Telegram control is active.',
  'Send a plain text command to start work immediately.',
  'Prefix with /async or /later to queue background execution.',
  'Voice notes are also accepted and will be transcribed when possible.',
].join('\n');

function buildTelegramReply(result: TelegramDispatchResult): string {
  const lines = [
    result.message,
    `${result.kind === 'job' ? 'Job' : 'Task'} ID: ${result.id}`,
  ];

  if (result.kind === 'agent_task') {
    lines.push(`Open: ${(process.env.CORS_ORIGIN ?? 'http://localhost:3000')}/agents?task=${encodeURIComponent(result.id)}`);
  }

  return lines.join('\n');
}

function extractCommandText(message: TelegramMessagePayload): string | null {
  const text = message.text?.trim();
  return text ? text : null;
}

function extractSenderName(message: TelegramMessagePayload): string | undefined {
  if (message.from?.username?.trim()) {
    return `@${message.from.username.trim()}`;
  }

  if (message.from?.first_name?.trim()) {
    return message.from.first_name.trim();
  }

  return undefined;
}

function parseModeAndText(text: string): { mode: 'sync' | 'async'; text: string } {
  if (text.startsWith('/async ')) {
    return { mode: 'async', text: text.slice(7).trim() };
  }

  if (text.startsWith('/later ')) {
    return { mode: 'async', text: text.slice(7).trim() };
  }

  return { mode: 'sync', text };
}

async function sendTelegramText(
  workspaceId: string,
  chatId: string,
  text: string,
): Promise<void> {
  await postTelegramMessage(workspaceId, { chatId, text });
}

async function postTelegramCommandAck(
  workspaceId: string,
  chatId: string,
  text: string,
): Promise<void> {
  try {
    await sendTelegramText(workspaceId, chatId, text);
  } catch (error) {
    console.error('[telegram] Failed to send acknowledgement:', error);
  }
}

function buildCommandAckMessage(mode: 'sync' | 'async'): string {
  if (mode === 'async') {
    return 'Command received. Queueing background execution now.';
  }

  return 'Command received. Routing it to the right Crewmate agent now.';
}

async function processTelegramCommand({
  workspaceId,
  chatId,
  message,
  target,
}: TelegramCommandContext): Promise<void> {
  const rawText = extractCommandText(message);
  if ((rawText === '/start') || (rawText === '/help')) {
    await sendTelegramText(workspaceId, chatId, TELEGRAM_HELP_MESSAGE);
    return;
  }

  let commandText = rawText;
  if (!commandText && message.voice?.file_id) {
    await postTelegramCommandAck(workspaceId, chatId, 'Voice note received. Transcribing your command now.');

    try {
      commandText = await transcribeTelegramVoiceMessage(workspaceId, {
        fileId: message.voice.file_id,
        mimeType: message.voice.mime_type,
      });
    } catch (error) {
      await sendTelegramText(
        workspaceId,
        chatId,
        error instanceof Error ? `Voice note could not be transcribed: ${error.message}` : 'Voice note could not be transcribed.',
      );
      return;
    }
  }

  if (!commandText) {
    await sendTelegramText(workspaceId, chatId, 'Send a text command or voice note for Crewmate to act on.');
    return;
  }

  const command = parseModeAndText(commandText);
  if (!command.text) {
    await sendTelegramText(workspaceId, chatId, 'Command was empty after parsing. Please try again.');
    return;
  }

  await postTelegramCommandAck(
    workspaceId,
    chatId,
    buildCommandAckMessage(command.mode),
  );

  try {
    const result = await dispatchCommand(
      target,
      {
        channel: 'telegram',
        senderName: extractSenderName(message),
        sourceRef: `${chatId}:${message.message_id ?? 'unknown'}`,
      },
      {
        mode: command.mode,
        text: command.text,
      },
    );
    await sendTelegramText(workspaceId, chatId, buildTelegramReply(result));
  } catch (error) {
    await sendTelegramText(
      workspaceId,
      chatId,
      error instanceof Error ? `Command failed: ${error.message}` : 'Command failed.',
    );
  }
}

export function registerTelegramRoutes(app: Express): void {
  app.post('/api/telegram/webhook/:workspaceId', async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId;
    if (!isTelegramConfigured(workspaceId)) {
      res.status(404).json({ message: 'Telegram is not configured for this workspace' });
      return;
    }

    const webhookSecret = getTelegramWebhookSecret(workspaceId);
    if (webhookSecret) {
      const headerSecret = req.header('x-telegram-bot-api-secret-token')?.trim() ?? '';
      if (headerSecret !== webhookSecret) {
        res.status(401).json({ message: 'Invalid Telegram webhook secret' });
        return;
      }
    }

    const update = req.body as TelegramUpdatePayload;
    const message = update.message;
    if (!message?.chat?.id) {
      res.status(200).json({ ok: true });
      return;
    }

    const chatId = String(message.chat.id);
    if (chatId !== getTelegramDefaultChatId(workspaceId)) {
      res.status(200).json({ ok: true });
      return;
    }

    const target = findCommandTargetByWorkspaceId(workspaceId);
    if (!target) {
      res.status(200).json({ ok: true });
      void sendTelegramText(workspaceId, chatId, 'Crewmate could not find a target user for this workspace.').catch((error) => {
        console.error('[telegram] Failed to notify missing workspace target:', error);
      });
      return;
    }

    res.status(200).json({ ok: true });
    void processTelegramCommand({ workspaceId, chatId, message, target }).catch((error) => {
      console.error('[telegram] Failed to process Telegram command:', error);
    });
  });
}
