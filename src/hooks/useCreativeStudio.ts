import {useState} from 'react';
import {creativeStudioService} from '../services/creativeStudioService';
import type {CreativeArtifact} from '../types';

interface UseCreativeStudioResult {
  artifact: CreativeArtifact | null;
  isGenerating: boolean;
  error: string | null;
  generateArtifact: (input: {prompt: string; context?: string; outputStyle?: string}) => Promise<void>;
}

export function useCreativeStudio(): UseCreativeStudioResult {
  const [artifact, setArtifact] = useState<CreativeArtifact | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateArtifact(input: {prompt: string; context?: string; outputStyle?: string}): Promise<void> {
    setIsGenerating(true);
    setError(null);

    try {
      const nextArtifact = await creativeStudioService.generate(input);
      setArtifact(nextArtifact);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unable to generate creative artifact');
    } finally {
      setIsGenerating(false);
    }
  }

  return {artifact, isGenerating, error, generateArtifact};
}
