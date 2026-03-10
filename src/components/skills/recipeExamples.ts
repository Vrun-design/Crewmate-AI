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

export const WEBHOOK_TEMPLATES: WebhookTemplate[] = [
  {
    id: 'zapier-default',
    icon: 'zap',
    title: 'Zapier Automation',
    subtitle: 'Trigger any Zap',
    description: 'Triggers a Zapier automation with data from my request. Use when I want to save data, send a notification, or trigger any workflow automation.',
    triggerPhrases: 'trigger my automation\nrun my zap\nfire the workflow\nsave this to my CRM',
    placeholderUrl: 'https://hooks.zapier.com/hooks/catch/...',
    setupNote: 'Create a "Catch Hook" Zap at zapier.com → copy the webhook URL',
    tag: '5,000+ apps',
  },
  {
    id: 'airtable',
    icon: 'database',
    title: 'Save to Airtable',
    subtitle: 'Log data to a base',
    description: 'Saves structured data to an Airtable table. Use when I want to log a lead, record a task, or save any information to a spreadsheet database.',
    triggerPhrases: 'save this to Airtable\nlog this lead\nadd a row\nrecord this',
    placeholderUrl: 'https://api.airtable.com/v0/YOUR_BASE_ID/YOUR_TABLE',
    setupNote: 'Airtable API → Settings → Generate token. Base ID is in your table URL.',
    tag: 'Database',
  },
  {
    id: 'slack-alert',
    icon: 'message',
    title: 'Send Slack Alert',
    subtitle: 'Custom channel webhook',
    description: 'Sends a formatted message to a Slack channel. Use when I want to notify my team about completed tasks, alerts, or important updates.',
    triggerPhrases: 'notify the team\nsend a Slack alert\npost to Slack\nalert the channel',
    placeholderUrl: 'https://hooks.slack.com/services/...',
    setupNote: 'Slack → Apps → Incoming Webhooks → Add to workspace → copy URL',
    tag: 'Notifications',
  },
  {
    id: 'crm-webhook',
    icon: 'handshake',
    title: 'CRM Webhook',
    subtitle: 'HubSpot, Pipedrive, etc.',
    description: 'Creates or updates a contact in my CRM when I provide lead information. Use when I want to save a new lead or update a deal.',
    triggerPhrases: 'save this lead\nadd contact to CRM\ncreate a deal\nlog this prospect',
    placeholderUrl: 'https://api.hubapi.com/crm/v3/objects/contacts',
    setupNote: 'Use Zapier template above to connect any CRM without coding.',
    tag: 'Sales',
  },
  {
    id: 'google-sheets',
    icon: 'table',
    title: 'Log to Google Sheets',
    subtitle: 'Append a row via webhook',
    description: 'Appends a row to Google Sheets with data from my request. Use when I want to track tasks, log calls, or keep a running record of actions.',
    triggerPhrases: 'add to spreadsheet\nlog this to Sheets\nappend a row\ntrack this',
    placeholderUrl: 'https://hooks.zapier.com/hooks/catch/...',
    setupNote: 'Set up a Zapier "Catch Hook → Google Sheets" zap and paste the URL.',
    tag: 'Tracking',
  },
];
