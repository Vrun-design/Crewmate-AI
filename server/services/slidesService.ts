import { getGoogleWorkspaceDefaults, googleWorkspaceApiRequest } from './googleWorkspaceService';
import { moveDriveFileToFolder } from './driveService';

interface PresentationResult {
  id: string;
  title: string;
  url: string;
}

interface SlideInput {
  title: string;
  body?: string;
  imageUrl?: string;
}

function buildSlidesUrl(id: string): string {
  return `https://docs.google.com/presentation/d/${id}/edit`;
}

async function getFirstSlideId(workspaceId: string, presentationId: string): Promise<string | null> {
  try {
    const pres = await googleWorkspaceApiRequest<{ slides?: Array<{ objectId: string }> }>({
      workspaceId,
      moduleId: 'slides',
      url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`,
    });
    return pres.slides?.[0]?.objectId ?? null;
  } catch {
    return null;
  }
}

async function getCurrentSlideCount(workspaceId: string, presentationId: string): Promise<number> {
  try {
    const pres = await googleWorkspaceApiRequest<{ slides?: unknown[] }>({
      workspaceId,
      moduleId: 'slides',
      url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`,
    });
    return pres.slides?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Build batchUpdate requests for a set of slides:
 *   - First: a TITLE (cover) slide with the presentation title
 *   - Then: TITLE_AND_BODY slides for each content slide
 *   - Finally: delete the original blank slide created by the API
 */
function buildCreateSlidesRequests(
  presentationTitle: string,
  slides: SlideInput[],
  defaultSlideId: string | null,
  insertionOffset = 0,
): object[] {
  const ts = Date.now();
  const requests: object[] = [];

  // Cover slide (only when building from scratch, i.e. offset === 0)
  if (insertionOffset === 0) {
    const coverSlideId = `cover_${ts}`;
    const coverTitleId = `cover_title_${ts}`;
    const coverSubtitleId = `cover_sub_${ts}`;

    requests.push({
      createSlide: {
        objectId: coverSlideId,
        insertionIndex: 0,
        slideLayoutReference: { predefinedLayout: 'TITLE' },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: 'CENTER_TITLE', index: 0 }, objectId: coverTitleId },
          { layoutPlaceholder: { type: 'SUBTITLE', index: 0 }, objectId: coverSubtitleId },
        ],
      },
    });
    requests.push({
      insertText: { objectId: coverTitleId, insertionIndex: 0, text: presentationTitle },
    });
  }

  // Content slides
  slides.forEach((slide, index) => {
    const slideId = `slide_${ts}_${index}`;
    const titleBoxId = `stitle_${ts}_${index}`;
    const bodyBoxId = `sbody_${ts}_${index}`;
    const imageId = `simage_${ts}_${index}`;

    requests.push({
      createSlide: {
        objectId: slideId,
        // After cover (index 0) if building from scratch, else append after existing slides
        insertionIndex: insertionOffset === 0 ? index + 1 : insertionOffset + index,
        slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleBoxId },
          { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bodyBoxId },
        ],
      },
    });

    requests.push({
      insertText: { objectId: titleBoxId, insertionIndex: 0, text: slide.title },
    });

    if (slide.body) {
      requests.push({
        insertText: { objectId: bodyBoxId, insertionIndex: 0, text: slide.body },
      });
    }

    if (slide.imageUrl?.trim()) {
      requests.push({
        createImage: {
          objectId: imageId,
          url: slide.imageUrl.trim(),
          elementProperties: {
            pageObjectId: slideId,
            size: {
              width: { magnitude: 260, unit: 'PT' },
              height: { magnitude: 160, unit: 'PT' },
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              shearX: 0,
              shearY: 0,
              translateX: 350,
              translateY: 110,
              unit: 'PT',
            },
          },
        },
      });
    }
  });

  // Delete the default blank slide the API creates (must be last — deletes shift no indices since we're done inserting)
  if (defaultSlideId) {
    requests.push({ deleteObject: { objectId: defaultSlideId } });
  }

  return requests;
}

export async function createGooglePresentation(workspaceId: string, input: {
  title: string;
  slides?: SlideInput[];
  folderId?: string;
}): Promise<PresentationResult> {
  const defaults = getGoogleWorkspaceDefaults(workspaceId);

  // Create an empty presentation (Google auto-creates one blank slide)
  const payload = await googleWorkspaceApiRequest<{ presentationId: string; title: string }>({
    workspaceId,
    moduleId: 'slides',
    url: 'https://slides.googleapis.com/v1/presentations',
    method: 'POST',
    body: { title: input.title },
  });

  // Fetch the auto-created blank slide so we can delete it after building ours
  const defaultSlideId = await getFirstSlideId(workspaceId, payload.presentationId);

  const slides = input.slides ?? [];
  const requests = buildCreateSlidesRequests(input.title, slides, defaultSlideId, 0);

  if (requests.length > 0) {
    await googleWorkspaceApiRequest({
      workspaceId,
      moduleId: 'slides',
      url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(payload.presentationId)}:batchUpdate`,
      method: 'POST',
      body: { requests },
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
  slides: SlideInput[];
}): Promise<PresentationResult> {
  const currentCount = await getCurrentSlideCount(workspaceId, input.presentationId);
  const requests = buildCreateSlidesRequests('', input.slides, null, currentCount);

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
