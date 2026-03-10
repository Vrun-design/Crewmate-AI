export interface CustomSkill {
  id: string;
  userId: string;
  name: string;
  description: string;
  triggerPhrases: string[];
  mode: 'webhook' | 'recipe';
  webhookUrl?: string;
  authHeader?: string;
  recipe?: string;
  createdAt: string;
}

export type SkillMode = 'webhook' | 'recipe';
