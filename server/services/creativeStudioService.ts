import { serverConfig } from '../config';
import { insertActivity } from './activityService';
import { createGeminiClient } from './geminiClient';
import { selectModel, determineComplexity } from './modelRouter';
import type { CreativeArtifactRecord } from '../types';

interface GenerateCreativeArtifactInput {
  prompt: string;
  context?: string;
  outputStyle?: string;
}

function extractInlineImage(response: unknown): { data?: string; mimeType?: string } {
  const candidate = (response as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> })?.candidates?.[0];
  const part = candidate?.content?.parts?.find((current) => current.inlineData?.data);
  return {
    data: part?.inlineData?.data,
    mimeType: part?.inlineData?.mimeType,
  };
}

function getText(response: unknown): string {
  return (response as { text?: string })?.text ?? '';
}

export async function generateCreativeArtifact(
  userId: string,
  input: GenerateCreativeArtifactInput,
): Promise<CreativeArtifactRecord> {
  const ai = createGeminiClient();
  const complexity = determineComplexity(input.prompt);
  const modelToUse = selectModel('creative', complexity, input.prompt.length);

  const response = await ai.models.generateContent({
    model: modelToUse,
    contents: `Create a polished creative concept with an accompanying visual.\nPrompt: ${input.prompt}\nContext: ${input.context ?? 'none'}\nStyle: ${input.outputStyle ?? 'product launch storyboard'}\nReturn concise narrative copy plus one generated image.`,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '16:9',
      },
    },
  });

  const image = extractInlineImage(response);
  const narrative = getText(response).trim();

  insertActivity(
    'Creative artifact generated',
    `Created a mixed-media artifact for "${input.prompt.slice(0, 60)}".`,
    'action',
  );

  return {
    title: input.prompt,
    narrative,
    imageData: image.data,
    imageMimeType: image.mimeType,
  };
}
