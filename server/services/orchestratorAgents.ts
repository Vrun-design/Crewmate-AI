/**
 * orchestratorAgents.ts
 *
 * Bridges the routing decision to the actual agent run.
 * This file is the ONLY place where agent options are resolved from the intent.
 * Each agent case parses the intent to enable: research, save to Notion, specific format, urgency, etc.
 *
 * Design: agents are powerful multi-step workers — they must ALWAYS be called with
 * the right options to unlock their full pipeline (research → generate → save to tools).
 */
import { runCommunicationsAgent, COMMS_AGENT_MANIFEST } from './agents/communicationsAgent';
import { runContentAgent, CONTENT_AGENT_MANIFEST } from './agents/contentAgent';
import { runDataAgent, DATA_AGENT_MANIFEST } from './agents/dataAgent';
import { runDevOpsAgent, DEVOPS_AGENT_MANIFEST } from './agents/devOpsAgent';
import { runFinanceAgent, FINANCE_AGENT_MANIFEST } from './agents/financeAgent';
import { runHRAgent, HR_AGENT_MANIFEST } from './agents/hrAgent';
import { runLegalAgent, LEGAL_AGENT_MANIFEST } from './agents/legalAgent';
import { runMarketingAgent, MARKETING_AGENT_MANIFEST } from './agents/marketingAgent';
import { runProductAgent, PRODUCT_AGENT_MANIFEST } from './agents/productAgent';
import { runResearchAgent, RESEARCH_AGENT_MANIFEST } from './agents/researchAgent';
import { runSalesAgent, SALES_AGENT_MANIFEST } from './agents/salesAgent';
import { runSocialAgent, SOCIAL_AGENT_MANIFEST } from './agents/socialAgent';
import { runSupportAgent, SUPPORT_AGENT_MANIFEST } from './agents/supportAgent';
import { runUiNavigatorAgent, UI_NAVIGATOR_AGENT_MANIFEST } from './agents/uiNavigatorAgent';
import type { SkillRunContext } from '../skills/types';
import type { EmitStep } from '../types/agentEvents';
import type { RoutingDecision } from './orchestratorShared';

export const AGENT_MANIFESTS = [
  RESEARCH_AGENT_MANIFEST,
  CONTENT_AGENT_MANIFEST,
  DEVOPS_AGENT_MANIFEST,
  COMMS_AGENT_MANIFEST,
  SALES_AGENT_MANIFEST,
  MARKETING_AGENT_MANIFEST,
  PRODUCT_AGENT_MANIFEST,
  HR_AGENT_MANIFEST,
  SUPPORT_AGENT_MANIFEST,
  SOCIAL_AGENT_MANIFEST,
  FINANCE_AGENT_MANIFEST,
  LEGAL_AGENT_MANIFEST,
  DATA_AGENT_MANIFEST,
  UI_NAVIGATOR_AGENT_MANIFEST,
];

// ── Intent parsing helpers ─────────────────────────────────────────────────────

function hasAny(intent: string, ...keywords: string[]): boolean {
  const lower = intent.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Determine if the output should be saved automatically.
 * We save when: Notion connected (always try), or intent mentions "save" / "document" / "file".
 * Since Notion save has a graceful fallback on failure, it's always safe to enable.
 */
function shouldSave(): boolean {
  return true; // Always attempt save — agents gracefully handle disconnected tools
}

// ── Agent runners with resolved options ────────────────────────────────────────

function runContent(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const format = hasAny(intent, 'linkedin') ? 'social_linkedin'
    : hasAny(intent, 'twitter', 'tweet', 'thread') ? 'social_twitter'
    : hasAny(intent, 'prd', 'product requirement', 'requirements doc') ? 'prd'
    : hasAny(intent, 'marketing copy', 'ad copy', 'landing page') ? 'marketing'
    : hasAny(intent, 'documentation', 'docs', 'readme', 'technical doc') ? 'documentation'
    : 'blog';

  const audience = hasAny(intent, 'developer', 'engineer', 'technical') ? 'technical teams'
    : hasAny(intent, 'executive', 'ceo', 'founder', 'c-suite') ? 'executives'
    : hasAny(intent, 'customer', 'user', 'client') ? 'end users'
    : 'general';

  return runContentAgent(intent, ctx, emitStep, {
    format,
    audience,
    tone: hasAny(intent, 'casual', 'friendly', 'fun') ? 'casual' : 'professional',
    researchFirst: true, // Always research before writing
    saveToNotion: shouldSave(),
  });
}

function runMarketing(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const type = hasAny(intent, 'campaign', 'campaign brief') ? 'campaign'
    : hasAny(intent, 'social', 'post', 'tweet', 'linkedin') ? 'social'
    : hasAny(intent, 'a/b', 'ab test', 'copy variant', 'headline variant') ? 'ab_copy'
    : 'brief';

  return runMarketingAgent(intent, ctx, emitStep, {
    type,
    saveToNotion: shouldSave(),
  });
}

function runSocial(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const platform = hasAny(intent, 'twitter', 'tweet', 'thread', 'x.com') ? 'twitter'
    : hasAny(intent, 'linkedin') ? 'linkedin'
    : hasAny(intent, 'calendar', 'schedule', 'plan', 'week') ? 'calendar'
    : 'all'; // Default: generate all three platforms

  return runSocialAgent(intent, ctx, emitStep, {
    platform,
    tone: hasAny(intent, 'bold', 'edgy', 'viral') ? 'bold and direct'
      : hasAny(intent, 'professional') ? 'professional'
      : 'authentic and engaging',
    saveToNotion: shouldSave(),
  });
}

function runHR(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const type = hasAny(intent, 'interview', 'question', 'hiring guide') ? 'interview'
    : hasAny(intent, 'offer letter', 'offer') ? 'offer'
    : hasAny(intent, 'onboard', 'onboarding plan', '30 day') ? 'onboarding'
    : hasAny(intent, 'performance review', 'review', 'feedback') ? 'review'
    : 'jd'; // Default: job description

  // Extract role from intent (e.g. "write a JD for a Senior Engineer")
  const roleMatch = intent.match(/for (?:an? )?([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){0,3})/i);
  const role = roleMatch?.[1];

  return runHRAgent(intent, ctx, emitStep, {
    type,
    role,
    saveToNotion: shouldSave(),
  });
}

function runProduct(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const type = hasAny(intent, 'user stor', 'as a user', 'acceptance criteria') ? 'user_story'
    : hasAny(intent, 'prd', 'product requirement', 'requirements doc') ? 'prd'
    : hasAny(intent, 'sprint', 'sprint plan', 'iteration') ? 'sprint'
    : hasAny(intent, 'spec', 'specification', 'feature spec') ? 'spec'
    : 'prd'; // Default: PRD

  // Always create a ClickUp/Notion ticket — this is what makes it genuinely useful
  const createTicket = hasAny(intent, 'ticket', 'task', 'create', 'add to', 'clickup', 'jira', 'backlog');

  return runProductAgent(intent, ctx, emitStep, {
    type,
    createTicket: createTicket || shouldSave(),
  });
}

function runSupport(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const type = hasAny(intent, 'faq', 'frequently asked', 'knowledge base', 'help article') ? 'faq'
    : hasAny(intent, 'triage', 'categorize', 'classify', 'priority') ? 'triage'
    : hasAny(intent, 'escalat', 'engineering team', 'engineering ticket') ? 'escalation'
    : hasAny(intent, 'playbook', 'runbook', 'process', 'workflow') ? 'playbook'
    : 'response'; // Default: draft a customer response

  const urgency = hasAny(intent, 'urgent', 'critical', 'outage', 'emergency', 'asap', 'immediately') ? 'high'
    : hasAny(intent, 'soon', 'today', 'high priority') ? 'medium'
    : 'low';

  // Extract customer name if mentioned
  const nameMatch = intent.match(/(?:from|customer|client|user)\s+([A-Z][a-z]+)/i);
  const customerName = nameMatch?.[1];

  return runSupportAgent(intent, ctx, emitStep, {
    type,
    customerName,
    urgency,
  });
}

function runFinance(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const type = hasAny(intent, 'invoice') ? 'invoice'
    : hasAny(intent, 'expense', 'spend', 'reimburs') ? 'expense'
    : hasAny(intent, 'budget', 'forecast', 'runway') ? 'budget'
    : hasAny(intent, 'analys', 'cost', 'unit economics', 'cac', 'ltv', 'burn rate') ? 'analysis'
    : 'report'; // Default: financial report

  return runFinanceAgent(intent, ctx, emitStep, {
    type,
    saveToNotion: shouldSave(),
  });
}

function runLegal(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const type = hasAny(intent, 'nda', 'confidential', 'non-disclosure') ? 'nda'
    : hasAny(intent, 'compliance', 'gdpr', 'hipaa', 'regulation', 'law') ? 'compliance'
    : hasAny(intent, 'policy', 'employee handbook', 'acceptable use') ? 'policy'
    : hasAny(intent, 'terms', 'service agreement', 'tos', 'eula', 'saas') ? 'terms'
    : 'review'; // Default: contract review

  return runLegalAgent(intent, ctx, emitStep, {
    type,
    saveToNotion: shouldSave(),
  });
}

function runComms(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const channel = hasAny(intent, 'slack', 'channel', 'team message') ? 'slack' : 'email';
  const tone = hasAny(intent, 'formal', 'legal') ? 'formal'
    : hasAny(intent, 'friendly', 'casual', 'hey') ? 'friendly'
    : 'professional';

  // Extract recipient
  const toMatch = intent.match(/to\s+([A-Za-z\s@.]+?)(?:\s+about|\s+saying|\s+regarding|$)/i);
  const to = toMatch?.[1]?.trim();

  // Auto-send to Slack if the intent explicitly says "send" or "post"
  const send = channel === 'slack' && hasAny(intent, 'send', 'post', 'notify', 'let them know');

  return runCommunicationsAgent(intent, ctx, emitStep, {
    channel,
    to,
    tone,
    send,
    context: '',
  });
}

function runData(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  const type = hasAny(intent, 'sql', 'query', 'database', 'select ', 'from ') ? 'sql'
    : hasAny(intent, 'report', 'kpi', 'dashboard', 'metrics report') ? 'report'
    : hasAny(intent, 'metric', 'define', 'what is', 'how to measure') ? 'metrics'
    : hasAny(intent, 'story', 'narrative', 'explain', 'present') ? 'story'
    : 'analysis'; // Default: data analysis

  return runDataAgent(intent, ctx, emitStep, {
    type,
  });
}

function runSales(intent: string, ctx: SkillRunContext, emitStep: EmitStep) {
  // Extract company/lead name from the intent
  const companyMatch = intent.match(/(?:at|from|for|about)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  const leadMatch = intent.match(/(?:to|for)\s+([A-Z][a-z]+)\b/);

  return runSalesAgent(intent, ctx, emitStep, {
    company: companyMatch?.[1],
    leadName: leadMatch?.[1],
    sendEmail: false, // Never auto-send — always draft first
  });
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

export async function runAgentForRoutingDecision(
  routing: RoutingDecision,
  intent: string,
  ctx: SkillRunContext,
  emitStep: EmitStep,
): Promise<unknown> {
  switch (routing.agent) {
    case 'research':
      return runResearchAgent(intent, ctx, emitStep);
    case 'content':
      return runContent(intent, ctx, emitStep);
    case 'devops':
      return runDevOpsAgent(intent, ctx, emitStep);
    case 'communications':
      return runComms(intent, ctx, emitStep);
    case 'sales':
      return runSales(intent, ctx, emitStep);
    case 'marketing':
      return runMarketing(intent, ctx, emitStep);
    case 'product':
      return runProduct(intent, ctx, emitStep);
    case 'hr':
      return runHR(intent, ctx, emitStep);
    case 'support':
      return runSupport(intent, ctx, emitStep);
    case 'social':
      return runSocial(intent, ctx, emitStep);
    case 'finance':
      return runFinance(intent, ctx, emitStep);
    case 'legal':
      return runLegal(intent, ctx, emitStep);
    case 'data':
      return runData(intent, ctx, emitStep);
    case 'ui_navigator':
      return runUiNavigatorAgent(intent, ctx, emitStep);
    default:
      return runResearchAgent(intent, ctx, emitStep);
  }
}
