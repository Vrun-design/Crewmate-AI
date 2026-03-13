import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';
import { moveDriveFileToFolder } from './driveService';

interface PresentationResult {
  id: string;
  title: string;
  url: string;
}

function buildSlidesUrl(id: string): string {
  return `https://docs.google.com/presentation/d/${id}/edit`;
}

export async function createGooglePresentation(workspaceId: string, input: {
  title: string;
  slides?: Array<{ title: string; body?: string }>;
  folderId?: string;
}): Promise<PresentationResult> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);
  const payload = await googleWorkspaceApiRequest<{ presentationId: string; title: string }>({
    workspaceId,
    moduleId: 'slides',
    url: 'https://slides.googleapis.com/v1/presentations',
    method: 'POST',
    body: { title: input.title },
  });

  if (input.slides?.length) {
    await addSlidesToPresentation(workspaceId, {
      presentationId: payload.presentationId,
      slides: input.slides,
    });
  }

  const folderId = input.folderId || defaults.defaultSlidesFolderId;
  if (folderId) {
    await moveDriveFileToFolder(workspaceId, { fileId: payload.presentationId, folderId });
  }

  return {
    id: payload.presentationId,
    title: payload.title,
    url: buildSlidesUrl(payload.presentationId),
  };
}

export async function addSlidesToPresentation(workspaceId: string, input: {
  presentationId: string;
  slides: Array<{ title: string; body?: string }>;
}): Promise<PresentationResult> {
  const requests = input.slides.flatMap((slide, index) => {
    const slideId = `slide_${Date.now()}_${index}`;
    const titleBoxId = `title_${Date.now()}_${index}`;
    const bodyBoxId = `body_${Date.now()}_${index}`;

    return [
      {
        createSlide: {
          objectId: slideId,
          insertionIndex: index + 1,
          slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
        },
      },
      {
        insertText: {
          objectId: titleBoxId,
          text: slide.title,
        },
      },
      ...(slide.body
        ? [{
          insertText: {
            objectId: bodyBoxId,
            text: slide.body,
          },
        }]
        : []),
    ];
  });

  await googleWorkspaceApiRequest({
    workspaceId,
    moduleId: 'slides',
    url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(input.presentationId)}:batchUpdate`,
    method: 'POST',
    body: { requests },
  });

  return {
    id: input.presentationId,
    title: 'Updated presentation',
    url: buildSlidesUrl(input.presentationId),
  };
}
