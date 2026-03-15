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

// ── Design constants ───────────────────────────────────────────────────────────
const WHITE      = { red: 1, green: 1, blue: 1 };
const BODY_GRAY  = { red: 0.216, green: 0.255, blue: 0.318 }; // #374151

interface Theme {
  coverBg: { red: number; green: number; blue: number };
  subtitleColor: { red: number; green: number; blue: number };
  titleColor: { red: number; green: number; blue: number };
}

// Contextual themes by content type
const THEMES: Record<string, Theme> = {
  // Default: corporate navy
  default:   { coverBg: { red: 0.063, green: 0.094, blue: 0.169 }, subtitleColor: { red: 0.753, green: 0.796, blue: 0.863 }, titleColor: { red: 0.11,  green: 0.306, blue: 0.714 } },
  // Financial/investor: deep forest green
  finance:   { coverBg: { red: 0.039, green: 0.165, blue: 0.122 }, subtitleColor: { red: 0.647, green: 0.839, blue: 0.733 }, titleColor: { red: 0.063, green: 0.427, blue: 0.271 } },
  // Sales/pitch: rich amber-orange
  sales:     { coverBg: { red: 0.18,  green: 0.098, blue: 0.02  }, subtitleColor: { red: 0.988, green: 0.82,  blue: 0.608 }, titleColor: { red: 0.878, green: 0.459, blue: 0.024 } },
  // Research/data: deep purple
  research:  { coverBg: { red: 0.133, green: 0.063, blue: 0.247 }, subtitleColor: { red: 0.82,  green: 0.745, blue: 0.957 }, titleColor: { red: 0.443, green: 0.18,  blue: 0.784 } },
  // HR/people: warm teal
  hr:        { coverBg: { red: 0.024, green: 0.157, blue: 0.18  }, subtitleColor: { red: 0.608, green: 0.882, blue: 0.902 }, titleColor: { red: 0.0,   green: 0.545, blue: 0.569 } },
  // Marketing/brand: deep magenta
  marketing: { coverBg: { red: 0.196, green: 0.024, blue: 0.157 }, subtitleColor: { red: 0.957, green: 0.745, blue: 0.929 }, titleColor: { red: 0.718, green: 0.071, blue: 0.561 } },
  // Product/tech: slate gray-blue
  product:   { coverBg: { red: 0.071, green: 0.098, blue: 0.196 }, subtitleColor: { red: 0.745, green: 0.792, blue: 0.957 }, titleColor: { red: 0.176, green: 0.318, blue: 0.839 } },
};

function detectTheme(title: string): Theme {
  const t = title.toLowerCase();
  if (/financ|budget|revenue|invest|p&l|earning|forecast|runway/.test(t)) return THEMES.finance;
  if (/sales|pitch|deal|proposal|outreach|crm|pipeline/.test(t)) return THEMES.sales;
  if (/research|analys|survey|data|insight|market/.test(t)) return THEMES.research;
  if (/hr|hire|talent|onboard|people|recruit|culture|employee/.test(t)) return THEMES.hr;
  if (/marketing|brand|campaign|launch|growth|seo|content/.test(t)) return THEMES.marketing;
  if (/product|prd|roadmap|feature|sprint|spec|user stor/.test(t)) return THEMES.product;
  return THEMES.default;
}

function rgb(color: { red: number; green: number; blue: number }) {
  return { rgbColor: color };
}

function solidFill(color: { red: number; green: number; blue: number }) {
  return { solidFill: { color: rgb(color) } };
}

function textStyle(opts: {
  color?: { red: number; green: number; blue: number };
  size?: number;
  bold?: boolean;
  font?: string;
}) {
  return {
    ...(opts.color ? { foregroundColor: { opaqueColor: rgb(opts.color) } } : {}),
    ...(opts.size ? { fontSize: { magnitude: opts.size, unit: 'PT' } } : {}),
    ...(opts.bold !== undefined ? { bold: opts.bold } : {}),
    ...(opts.font ? { fontFamily: opts.font } : {}),
  };
}

/**
 * Build batchUpdate requests for a set of slides:
 *   - Cover slide with professional dark background + styled text
 *   - TITLE_AND_BODY slides with blue titles, clean body text
 *   - Full text styling for every element
 *   - Delete the original blank slide created by the API
 */
function buildCreateSlidesRequests(
  presentationTitle: string,
  slides: SlideInput[],
  defaultSlideId: string | null,
  insertionOffset = 0,
  theme?: Theme,
): object[] {
  const ts = Date.now();
  const requests: object[] = [];
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const t = theme ?? THEMES.default;

  // ── Cover slide ────────────────────────────────────────────────────────────
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
          { layoutPlaceholder: { type: 'CENTERED_TITLE', index: 0 }, objectId: coverTitleId },
          { layoutPlaceholder: { type: 'SUBTITLE', index: 0 }, objectId: coverSubtitleId },
        ],
      },
    });

    // Cover background
    requests.push({
      updatePageProperties: {
        objectId: coverSlideId,
        pageProperties: { pageBackgroundFill: solidFill(t.coverBg) },
        fields: 'pageBackgroundFill',
      },
    });

    // Title text + style
    requests.push({ insertText: { objectId: coverTitleId, insertionIndex: 0, text: presentationTitle } });
    requests.push({
      updateTextStyle: {
        objectId: coverTitleId,
        style: textStyle({ color: WHITE, size: 38, bold: true, font: 'Google Sans' }),
        fields: 'foregroundColor,fontSize,bold,fontFamily',
      },
    });

    // Subtitle: date
    requests.push({ insertText: { objectId: coverSubtitleId, insertionIndex: 0, text: today } });
    requests.push({
      updateTextStyle: {
        objectId: coverSubtitleId,
        style: textStyle({ color: t.subtitleColor, size: 16, font: 'Google Sans' }),
        fields: 'foregroundColor,fontSize,fontFamily',
      },
    });
  }

  // ── Content slides ─────────────────────────────────────────────────────────
  slides.forEach((slide, index) => {
    const slideId   = `slide_${ts}_${index}`;
    const titleBoxId = `stitle_${ts}_${index}`;
    const bodyBoxId  = `sbody_${ts}_${index}`;
    const imageId    = `simage_${ts}_${index}`;

    requests.push({
      createSlide: {
        objectId: slideId,
        insertionIndex: insertionOffset === 0 ? index + 1 : insertionOffset + index,
        slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleBoxId },
          { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bodyBoxId },
        ],
      },
    });

    // Slide title text + style
    requests.push({ insertText: { objectId: titleBoxId, insertionIndex: 0, text: slide.title } });
    requests.push({
      updateTextStyle: {
        objectId: titleBoxId,
        style: textStyle({ color: t.titleColor, size: 24, bold: true, font: 'Google Sans' }),
        fields: 'foregroundColor,fontSize,bold,fontFamily',
      },
    });

    // Body text + style
    if (slide.body) {
      requests.push({ insertText: { objectId: bodyBoxId, insertionIndex: 0, text: slide.body } });
      requests.push({
        updateTextStyle: {
          objectId: bodyBoxId,
          style: textStyle({ color: BODY_GRAY, size: 13, font: 'Google Sans' }),
          fields: 'foregroundColor,fontSize,fontFamily',
        },
      });
    }

    // Optional image (right side of slide)
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
              scaleX: 1, scaleY: 1, shearX: 0, shearY: 0,
              translateX: 350, translateY: 110, unit: 'PT',
            },
          },
        },
      });
    }
  });

  // Delete the default blank slide (must be last)
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

  const slides = input.slides?.length
    ? input.slides
    : [{ title: 'Overview', body: 'This presentation was created by Crewmate.' }];
  const theme = detectTheme(input.title);
  const requests = buildCreateSlidesRequests(input.title, slides, defaultSlideId, 0, theme);

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

export async function readGooglePresentation(workspaceId: string, presentationId: string): Promise<{
  id: string;
  title: string;
  url: string;
  slides: Array<{ index: number; title: string; body: string }>;
}> {
  const pres = await googleWorkspaceApiRequest<{
    presentationId: string;
    title: string;
    slides?: Array<{
      pageElements?: Array<{
        shape?: {
          placeholder?: { type: string };
          text?: { textElements?: Array<{ textRun?: { content: string } }> };
        };
      }>;
    }>;
  }>({
    workspaceId,
    moduleId: 'slides',
    url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`,
  });

  function extractText(elements?: Array<{ textRun?: { content: string } }>): string {
    return (elements ?? []).map((e) => e.textRun?.content ?? '').join('').trim();
  }

  const slides = (pres.slides ?? []).map((slide, index) => {
    const elements = slide.pageElements ?? [];
    let title = '';
    let body = '';
    for (const el of elements) {
      const shape = el.shape;
      if (!shape?.text) continue;
      const text = extractText(shape.text.textElements);
      const placeholderType = shape.placeholder?.type ?? '';
      if (!title && (placeholderType.includes('TITLE') || placeholderType.includes('CENTERED'))) {
        title = text;
      } else if (text) {
        body += (body ? '\n' : '') + text;
      }
    }
    return { index: index + 1, title, body };
  });

  return {
    id: pres.presentationId,
    title: pres.title,
    url: buildSlidesUrl(pres.presentationId),
    slides,
  };
}
