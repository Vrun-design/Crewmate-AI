import {
  ActivityHandling,
  Modality,
  StartSensitivity,
  type FunctionDeclaration,
  type LiveConnectConfig,
  type Tool,
} from '@google/genai';

const LIVE_CONTEXT_COMPRESSION_TRIGGER_TOKENS = '98304';
const LIVE_CONTEXT_COMPRESSION_TARGET_TOKENS = '65536';

export function buildLiveToolset(functionDeclarations: FunctionDeclaration[]): Tool[] {
  const tools: Tool[] = [{ googleSearch: {} }];

  if (functionDeclarations.length > 0) {
    tools.push({ functionDeclarations });
  }

  return tools;
}

export function buildLiveConnectConfig(input: {
  systemInstruction: string;
  voiceName: string;
  functionDeclarations: FunctionDeclaration[];
  resumptionHandle?: string | null;
}): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: input.systemInstruction,
    tools: buildLiveToolset(input.functionDeclarations),
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        prefixPaddingMs: 120,
        silenceDurationMs: 400,
      },
    },
    contextWindowCompression: {
      triggerTokens: LIVE_CONTEXT_COMPRESSION_TRIGGER_TOKENS,
      slidingWindow: {
        targetTokens: LIVE_CONTEXT_COMPRESSION_TARGET_TOKENS,
      },
    },
    sessionResumption: {
      handle: input.resumptionHandle ?? undefined,
    },
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: input.voiceName,
        },
      },
    },
  };
}
