import { createGeminiClient } from './geminiClient';
import { getEffectiveIntegrationConfig } from './integrationConfigService';
import { selectModel } from './modelRouter';
import { registerTool } from '../mcp/mcpServer';

interface PostTelegramMessageInput {
  chatId?: string;
  text: string;
}

interface TelegramApiResponse<TResult> {
  ok: boolean;
  result?: TResult;
  description?: string;
}

interface TelegramFileResponse {
  file_path?: string;
  file_size?: number;
}

interface TelegramMessageResponse {
  message_id: number;
  chat: { id: number };
}

interface TelegramVoiceTranscriptInput {
  fileId: string;
  mimeType?: string;
}

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TELEGRAM_FILE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024;

interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
  webhookSecret: string;
}

function getTelegramConfig(workspaceId: string): TelegramConfig {
  const config = getEffectiveIntegrationConfig(workspaceId, 'telegram');
  return {
    botToken: config.botToken ?? '',
    defaultChatId: config.defaultChatId ?? '',
    webhookSecret: config.webhookSecret ?? '',
  };
}

function getApiUrl(botToken: string, method: string): string {
  return `${TELEGRAM_API_BASE}/bot${botToken}/${method}`;
}

function getTelegramFileMimeType(filePath: string): string {
  if (filePath.endsWith('.mp3')) {
    return 'audio/mpeg';
  }

  if (filePath.endsWith('.mp4')) {
    return 'audio/mp4';
  }

  return 'audio/ogg';
}

async function callTelegramApi<TResult>(
  workspaceId: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<TResult> {
  const config = getTelegramConfig(workspaceId);
  if (!config.botToken) {
    throw new Error('Telegram integration is not configured. Save a bot token first.');
  }

  const response = await fetch(getApiUrl(config.botToken, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as TelegramApiResponse<TResult>;

  if (!response.ok || !data.ok || !data.result) {
    throw new Error(`Telegram API ${method} failed: ${data.description ?? response.statusText}`);
  }

  return data.result;
}

async function getTelegramFileBase64(
  workspaceId: string,
  fileId: string,
): Promise<{ base64: string; mimeType: string }> {
  const config = getTelegramConfig(workspaceId);
  if (!config.botToken) {
    throw new Error('Telegram integration is not configured.');
  }

  const file = await callTelegramApi<TelegramFileResponse>(workspaceId, 'getFile', { file_id: fileId });
  if (!file.file_path) {
    throw new Error('Telegram did not return a file path for the voice note.');
  }

  if (typeof file.file_size === 'number' && file.file_size > TELEGRAM_FILE_SIZE_LIMIT_BYTES) {
    throw new Error('Telegram voice note is too large to transcribe.');
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/file/bot${config.botToken}/${file.file_path}`);
  if (!response.ok) {
    throw new Error(`Telegram file download failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    base64: Buffer.from(arrayBuffer).toString('base64'),
    mimeType: getTelegramFileMimeType(file.file_path),
  };
}

export function isTelegramConfigured(workspaceId: string): boolean {
  const config = getTelegramConfig(workspaceId);
  return Boolean(config.botToken && config.defaultChatId);
}

export function getTelegramDefaultChatId(workspaceId: string): string {
  return getTelegramConfig(workspaceId).defaultChatId;
}

export function getTelegramWebhookSecret(workspaceId: string): string {
  return getTelegramConfig(workspaceId).webhookSecret;
}

export async function postTelegramMessage(
  workspaceId: string,
  input: PostTelegramMessageInput,
): Promise<{ chatId: string; messageId: number }> {
  const config = getTelegramConfig(workspaceId);
  if (!isTelegramConfigured(workspaceId)) {
    throw new Error('Telegram integration is not configured. Save a bot token and default chat ID.');
  }

  const result = await callTelegramApi<TelegramMessageResponse>(workspaceId, 'sendMessage', {
    chat_id: input.chatId ?? config.defaultChatId,
    text: input.text,
    disable_web_page_preview: true,
  });

  return {
    chatId: String(result.chat.id),
    messageId: result.message_id,
  };
}

export async function transcribeTelegramVoiceMessage(
  workspaceId: string,
  input: TelegramVoiceTranscriptInput,
): Promise<string> {
  const file = await getTelegramFileBase64(workspaceId, input.fileId);
  const ai = createGeminiClient();
  const response = await ai.models.generateContent({
    model: selectModel('general'),
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Transcribe this voice command exactly. Return only the spoken command as plain text with no commentary.',
          },
          {
            inlineData: {
              data: file.base64,
              mimeType: input.mimeType ?? file.mimeType,
            },
          },
        ],
      },
    ],
  });

  const transcript = (response.text ?? '').trim();
  if (!transcript) {
    throw new Error('Voice note transcription returned an empty response.');
  }

  return transcript;
}

registerTool({
  name: 'post_telegram_message',
  description: 'Send a message to the configured Telegram chat when the user asks to notify them on Telegram or deliver a result there.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string' },
      chatId: { type: 'string', description: 'Optional chat ID override. Defaults to the workspace chat.' },
    },
  },
  handler: async (context, args) => {
    return postTelegramMessage(context.workspaceId, {
      text: typeof args.text === 'string' ? args.text : '',
      chatId: typeof args.chatId === 'string' ? args.chatId : undefined,
    });
  },
});
