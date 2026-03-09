import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import {serverConfig} from '../config';

function getKey(): Buffer {
  if (!serverConfig.encryptionKey) {
    throw new Error('Missing CREWMATE_ENCRYPTION_KEY. Set it before saving integration credentials.');
  }

  return createHash('sha256').update(serverConfig.encryptionKey).digest();
}

export function encryptJson(payload: Record<string, string>): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptJson(payload: string): Record<string, string> {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split('.');

  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Stored integration configuration is invalid.');
  }

  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as Record<string, string>;
}
