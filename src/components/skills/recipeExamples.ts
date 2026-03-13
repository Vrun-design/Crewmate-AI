export const RECIPE_EXAMPLES = [
  {
    title: 'Translate to Spanish',
    recipe:
      'You are a professional translator. Translate the input text to Spanish. Output only the translation, nothing else.',
  },
  {
    title: 'Summarize in 3 bullets',
    recipe: 'Summarize the following text in exactly 3 bullet points. Be concise. Start each bullet with •',
  },
  {
    title: 'Write a cold email',
    recipe:
      'You are a sales expert. Write a personalized cold outreach email based on the input. Include SUBJECT: and BODY: sections. Keep it under 150 words.',
  },
  {
    title: 'Generate SQL query',
    recipe:
      "You are a SQL expert. Write an efficient SQL SELECT query based on the user's description. Return only the SQL query inside a ```sql code block. Explain briefly after.",
  },
  {
    title: 'Action items from notes',
    recipe:
      'Extract action items from the notes below. Format as a numbered list. Prefix each item with "→". Add assignee if mentioned.',
  },
] as const;

export interface WebhookTemplate {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  triggerPhrases: string;
  placeholderUrl: string;
  setupNote: string;
  tag: string;
}

export const WEBHOOK_TEMPLATES: WebhookTemplate[] = [];
