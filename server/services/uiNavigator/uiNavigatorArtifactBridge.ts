import type { SkillRunContext } from '../../skills/types';
import { saveScreenshotArtifact } from '../screenshotArtifactService';

const UI_NAVIGATOR_STEP_TITLE_PREFIX = 'UI Navigator Step';

export function createUiNavigatorStepScreenshotHandler(
  ctx: Pick<SkillRunContext, 'userId' | 'workspaceId' | 'taskId' | 'taskRunId'>,
): ((base64: string, mimeType: string, currentUrl: string, stepIndex: number) => void) | undefined {
  if (!ctx.taskRunId) {
    return undefined;
  }

  return (base64: string, mimeType: string, currentUrl: string, stepIndex: number): void => {
    saveScreenshotArtifact({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      taskId: ctx.taskId,
      taskRunId: ctx.taskRunId,
      mimeType,
      data: base64,
      title: `${UI_NAVIGATOR_STEP_TITLE_PREFIX} ${stepIndex + 1}`,
      caption: currentUrl,
      internalOnly: true,
    });
  };
}

export function getUiNavigatorArtifactUrl(caption?: string | null): string | null {
  if (!caption) {
    return null;
  }

  const trimmedCaption = caption.trim();
  return trimmedCaption.startsWith('http://') || trimmedCaption.startsWith('https://')
    ? trimmedCaption
    : null;
}
