import type { AudioChunk } from '../types/live';

function decodeBase64(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function getSampleRate(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 24000;
}

export function createAudioBuffer(audioContext: AudioContext, chunk: AudioChunk): AudioBuffer {
  const pcmBytes = decodeBase64(chunk.data);
  const pcm = new Int16Array(pcmBytes);
  const sampleRate = getSampleRate(chunk.mimeType);
  const buffer = audioContext.createBuffer(1, pcm.length, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < pcm.length; index += 1) {
    channel[index] = pcm[index] / 0x8000;
  }

  return buffer;
}

export function stopAudioSource(source: AudioBufferSourceNode | null): void {
  if (!source) {
    return;
  }

  try {
    source.stop();
  } catch {
    // Ignore stop races during interruption and teardown.
  }
}
