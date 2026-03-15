/**
 * agentWorkspaceOutput.ts
 *
 * Shared helper that converts an agent's markdown/text output into a
 * structured Google Workspace file (Sheets, Slides, or Docs).
 *
 * Used by research, finance, and data agents when the user requests
 * a compound intent such as "analyse X and put it in a Google Sheet".
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { inferAutoImageQuery } from '../autoVisuals';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';

export type WorkspaceOutputTarget =
  | 'google.sheets-create-spreadsheet'
  | 'google.slides-create-presentation'
  | 'google.docs-create-document';

interface SheetConversion {
  title: string;
  rows: string[][];
}

interface SlidesConversion {
  title: string;
  slides: Array<{ title: string; body?: string }>;
}

interface WorkspaceSkillRunOptions {
  args: Record<string, unknown>;
  ctx: SkillRunContext;
  emitStep: EmitStep;
  startMessage: string;
  successMessage: (url: string | undefined) => string;
  target: WorkspaceOutputTarget;
}

function extractUrl(output: unknown): string | undefined {
  if (!output || typeof output !== 'object') return undefined;
  const o = output as Record<string, unknown>;
  if (typeof o.url === 'string') return o.url;
  if (typeof o.id === 'string') {
    // Infer URL from ID based on MIME type hints in the output
    if ('spreadsheetId' in o || String(o.id).length === 44) {
      return `https://docs.google.com/spreadsheets/d/${o.id}/edit`;
    }
    if ('presentationId' in o) {
      return `https://docs.google.com/presentation/d/${o.id}/edit`;
    }
    if ('documentId' in o) {
      return `https://docs.google.com/document/d/${o.id}/edit`;
    }
  }
  return undefined;
}

function parseStructuredResponse<T>(text: string): T | null {
  const normalized = text.trim().replace(/^```json\n?|\n?```$/g, '').trim();
  if (!normalized) {
    return null;
  }

  return JSON.parse(normalized) as T;
}

function getWorkspaceTargetLabel(target: WorkspaceOutputTarget): string {
  if (target === 'google.docs-create-document') {
    return 'Google Doc';
  }

  if (target === 'google.sheets-create-spreadsheet') {
    return 'Google Sheet';
  }

  return 'Google Slides';
}

function buildWorkspaceTitle(intent: string): string {
  return intent.slice(0, 80).replace(/[^\w\s-]/g, '').trim() || 'Research Output';
}

async function runWorkspaceCreateSkill({
  args,
  ctx,
  emitStep,
  startMessage,
  successMessage,
  target,
}: WorkspaceSkillRunOptions): Promise<{ url?: string } | null> {
  emitStep('skill_call', startMessage, { skillId: target });

  try {
    const startedAt = Date.now();
    const runRecord = await runSkill(target, ctx, args);
    const succeeded = runRecord.result.success !== false;
    if (!succeeded) {
      const errMsg = (runRecord.result as { error?: string }).error ?? 'Unknown error';
      emitStep('skill_result', `${getWorkspaceTargetLabel(target)} creation failed — ${errMsg}`, {
        skillId: target,
        durationMs: Date.now() - startedAt,
        success: false,
      });
      return null;
    }
    const url = extractUrl((runRecord.result as { output?: unknown }).output);
    emitStep('skill_result', successMessage(url), {
      skillId: target,
      durationMs: Date.now() - startedAt,
      success: true,
      url,
    });
    return { url };
  } catch (error) {
    emitStep('skill_result', `${getWorkspaceTargetLabel(target)} creation failed — ${error instanceof Error ? error.message : String(error)}`, {
      skillId: target,
      success: false,
    });
    return null;
  }
}

async function convertToSheets(
  content: string,
  intent: string,
  ai: ReturnType<typeof createGeminiClient>,
): Promise<SheetConversion | null> {
  const sheetPrompt = [
    'Convert the following research/analysis output into a Google Spreadsheet.',
    '',
    'OUTPUT FORMAT: Return ONLY valid JSON — no markdown, no explanation, no code fences.',
    'Shape: {"title":"<title>","rows":[["Header1","Header2"],["val","val"],...]}',
    '',
    'RULES:',
    '- First row MUST be column headers',
    '- Every subsequent row is one data record',
    '- Keep each cell under 120 characters',
    '- Maximum 200 rows',
    '- If the text contains a clear table or list, extract it directly',
    '- If not, create a "Category | Key Finding | Detail | Source" structure from the key points',
    '- The title should reflect the topic and date context',
    '',
    `Research intent: "${intent.slice(0, 120)}"`,
    '',
    'Content to convert:',
    content.slice(0, 12000),
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: serverConfig.geminiTextModel,
      contents: sheetPrompt,
    });

    const parsed = parseStructuredResponse<SheetConversion>(response.text ?? '');
    if (!parsed) return null;
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function convertToSlides(
  content: string,
  intent: string,
  ai: ReturnType<typeof createGeminiClient>,
): Promise<SlidesConversion | null> {
  const slidesPrompt = [
    'Convert the following research/analysis output into a professional Google Slides presentation.',
    '',
    'OUTPUT FORMAT: Return ONLY valid JSON — no markdown, no explanation, no code fences.',
    'Shape: {"title":"<deck title>","slides":[{"title":"Slide Title","body":"bullet 1\\nbullet 2\\nbullet 3\\nbullet 4"},...]}',
    '',
    'RULES:',
    '- Create one slide per major section, theme, or key finding',
    '- Minimum 4 slides, maximum 14 slides',
    '- Each body MUST have 4-6 substantive bullet points — not vague summaries',
    '- Include specific data points, statistics, or concrete facts in bullet points wherever available',
    '- No markdown inside slide body — plain text only, each bullet on its own line',
    '- First slide: overview / executive summary of the entire presentation',
    '- Last slide: key recommendations, action items, or next steps',
    '- Slide titles should be short (5 words max) and punchy — state the finding, not the topic',
    '',
    `Research intent: "${intent.slice(0, 120)}"`,
    '',
    'Content to convert (use ALL the content below — do not truncate your analysis):',
    content.slice(0, 14000),
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: serverConfig.geminiTextModel,
      contents: slidesPrompt,
    });

    const parsed = parseStructuredResponse<SlidesConversion>(response.text ?? '');
    if (!parsed) return null;
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Converts agent output text to a structured Google Workspace file and
 * calls the appropriate skill to create it.
 *
 * Returns the file URL on success, or null if the conversion or skill call fails.
 * Always gracefully degrades — the caller should still return its text output.
 */
export async function saveAgentOutputToWorkspace(
  content: string,
  intent: string,
  target: WorkspaceOutputTarget,
  ctx: SkillRunContext,
  emitStep: EmitStep,
): Promise<{ url?: string } | null> {
  if (!content || content.trim().length < 50) return null;

  const ai = createGeminiClient();

  if (target === 'google.docs-create-document') {
    // Docs can accept the full research output — no truncation needed
    return runWorkspaceCreateSkill({
      target,
      ctx,
      emitStep,
      args: {
        title: buildWorkspaceTitle(intent),
        content: content.slice(0, 40000),
        imageQuery: inferAutoImageQuery({
          target: 'docs',
          title: buildWorkspaceTitle(intent),
          content,
          intent,
        }),
      },
      startMessage: 'Creating Google Doc with research output...',
      successMessage: (url) => `Google Doc created${url ? '' : ' (no URL returned)'}`,
    });
  }

  if (target === 'google.sheets-create-spreadsheet') {
    emitStep('thinking', 'Structuring data for Google Sheets...', { skillId: target });
    const converted = await convertToSheets(content, intent, ai);
    if (!converted) {
      emitStep('skill_result', 'Could not structure data for Google Sheets — output available in Notion/inline', {
        skillId: target,
        success: false,
      });
      return null;
    }
    return runWorkspaceCreateSkill({
      target,
      ctx,
      emitStep,
      args: { title: converted.title, rows: converted.rows },
      startMessage: `Creating Google Sheet: "${converted.title}"...`,
      successMessage: (url) => `Google Sheet created with ${converted.rows.length - 1} data rows${url ? '' : ' (no URL returned)'}`,
    });
  }

  if (target === 'google.slides-create-presentation') {
    emitStep('thinking', 'Structuring slides for Google Slides...', { skillId: target });
    const converted = await convertToSlides(content, intent, ai);
    if (!converted) {
      emitStep('skill_result', 'Could not structure slides — output available in Notion/inline', {
        skillId: target,
        success: false,
      });
      return null;
    }
    return runWorkspaceCreateSkill({
      target,
      ctx,
      emitStep,
      args: {
        title: converted.title,
        slides: converted.slides.map((slide) => ({
          ...slide,
          imageQuery: inferAutoImageQuery({
            target: 'slides',
            title: slide.title,
            content: slide.body,
            intent,
          }),
        })),
      },
      startMessage: `Creating Google Slides: "${converted.title}" (${converted.slides.length} slides)...`,
      successMessage: (url) => `Slides deck created with ${converted.slides.length} slides${url ? '' : ' (no URL returned)'}`,
    });
  }

  return null;
}

export async function maybeSaveAgentOutputToWorkspace(
  content: string,
  intent: string,
  target: WorkspaceOutputTarget | undefined,
  ctx: SkillRunContext,
  emitStep: EmitStep,
): Promise<string | undefined> {
  if (!target || !content) {
    return undefined;
  }

  const result = await saveAgentOutputToWorkspace(content, intent, target, ctx, emitStep);
  return result?.url;
}
