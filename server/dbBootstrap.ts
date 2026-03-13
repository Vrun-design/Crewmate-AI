import fs from 'node:fs';
import path from 'node:path';

export function ensureDirectoryExists(filePath: string): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}
