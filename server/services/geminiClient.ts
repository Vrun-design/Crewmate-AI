import {GoogleGenAI} from '@google/genai';
import {serverConfig} from '../config';

export function createGeminiClient(): GoogleGenAI {
  if (!serverConfig.geminiApiKey) {
    throw new Error('Missing GOOGLE_API_KEY or GEMINI_API_KEY.');
  }

  return new GoogleGenAI({apiKey: serverConfig.geminiApiKey});
}
