type AutoVisualTarget = 'docs' | 'slides' | 'notion';

const GENERIC_VISUAL_HINTS = [
  'presentation',
  'slides',
  'deck',
  'pitch',
  'proposal',
  'report',
  'brief',
  'strategy',
  'launch',
  'campaign',
  'marketing',
  'roadmap',
  'plan',
  'overview',
  'summary',
  'analysis',
  'research',
  'market',
  'trend',
  'product',
  'brand',
];

const NOTION_VISUAL_HINTS = [
  'prd',
  'spec',
  'brief',
  'research',
  'strategy',
  'proposal',
  'launch',
  'marketing',
  'plan',
];

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function containsHint(text: string, hints: string[]): boolean {
  return hints.some((hint) => text.includes(hint));
}

function buildImageQuery(title: string, content?: string): string | undefined {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return undefined;
  }

  const firstContentLine = (content ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (firstContentLine && firstContentLine.length <= 80 && !/^https?:\/\//i.test(firstContentLine)) {
    return `${normalizedTitle} ${firstContentLine}`.slice(0, 140);
  }

  return normalizedTitle.slice(0, 120);
}

export function inferAutoImageQuery(input: {
  target: AutoVisualTarget;
  title: string;
  content?: string;
  intent?: string;
}): string | undefined {
  const title = input.title.trim();
  const combined = [normalizeText(title), normalizeText(input.content), normalizeText(input.intent)].filter(Boolean).join(' ');

  if (!title) {
    return undefined;
  }

  if (input.target === 'slides') {
    return buildImageQuery(title, input.content);
  }

  if (input.target === 'docs') {
    if (containsHint(combined, GENERIC_VISUAL_HINTS)) {
      return buildImageQuery(title, input.content);
    }

    return undefined;
  }

  if (containsHint(combined, NOTION_VISUAL_HINTS)) {
    return buildImageQuery(title, input.content);
  }

  return undefined;
}
