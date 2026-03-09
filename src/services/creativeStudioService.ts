import {api} from '../lib/api';
import type {CreativeArtifact} from '../types';

interface CreativePromptInput {
  prompt: string;
  context?: string;
  outputStyle?: string;
}

export const creativeStudioService = {
  generate(input: CreativePromptInput): Promise<CreativeArtifact> {
    return api.post('/api/creative/generate', input);
  },
};
