/**
 * Skill Loader — registers all skills into the Skill Registry on server startup.
 * Import this file ONCE in server/index.ts to activate the full skill set.
 */
import { registerSkill } from './registry';

// ── Research Skills ───────────────────────────────────────────────────────────
import { webSearchSkill, webSummarizeUrlSkill } from './research/web.skills';

// ── Communication Skills ──────────────────────────────────────────────────────
import { gmailSendSkill, gmailDraftSkill, gmailReadInboxSkill } from './communication/gmail.skills';
import { slackPostMessageSkill } from './communication/slack-post-message.skill';
import { slackListChannelsSkill } from './communication/slack-list-channels.skill';

// ── Productivity Skills ───────────────────────────────────────────────────────
import { calendarScheduleSkill, calendarFindFreeTimeSkill, calendarListEventsSkill } from './productivity/calendar.skills';
import { delegationQueueResearchSkill, delegationQueueWorkflowSkill } from './productivity/delegation.skills';
import { notionCreatePageSkill } from './productivity/notion-create-page.skill';
import { notionListPagesSkill } from './productivity/notion-list-pages.skill';
import { clickupCreateTaskSkill } from './productivity/clickup-create-task.skill';
import { clickupListTasksSkill } from './productivity/clickup-list-tasks.skill';
import { memoryStoreSkill, memoryRetrieveSkill, memoryListSkill } from './productivity/memory.skills';

// ── Code & DevOps Skills ──────────────────────────────────────────────────────
import { githubCreateIssueSkill } from './code/github-create-issue.skill';
import { githubCreatePRSkill } from './code/github-create-pr.skill';
import { githubListPRsSkill } from './code/github-list-prs.skill';
import { terminalRunCommandSkill } from './code/terminal-run-command.skill';

// ── Browser Skills ────────────────────────────────────────────────────────────
import {
    browserOpenUrlSkill,
    browserExtractSkill,
    browserExtractTextSkill,
    browserFillFormSkill,
    browserClickElementSkill,
    browserInspectVisibleUiSkill,
    browserPressKeySkill,
    browserSearchGoogleSkill,
    browserScrollPageSkill,
    browserScreenshotSkill,
    browserTypeIntoSkill,
    browserUiNavigateSkill,
} from './browser/browser.skills';

// ── Automation Skills ─────────────────────────────────────────────────────────
import { zapierTriggerSkill, zapierListSkill } from './automation/zapier.skills';

// ── Creative Skills ───────────────────────────────────────────────────────────
import { creativeGenerateImageSkill } from './creative/creative.skill';

const ALL_SKILLS = [
    // Research
    webSearchSkill,
    webSummarizeUrlSkill,
    // Communication
    gmailSendSkill,
    gmailDraftSkill,
    gmailReadInboxSkill,
    slackPostMessageSkill,
    slackListChannelsSkill,
    // Productivity
    calendarScheduleSkill,
    calendarFindFreeTimeSkill,
    calendarListEventsSkill,
    delegationQueueResearchSkill,
    delegationQueueWorkflowSkill,
    notionCreatePageSkill,
    notionListPagesSkill,
    clickupCreateTaskSkill,
    clickupListTasksSkill,
    // Memory
    memoryStoreSkill,
    memoryRetrieveSkill,
    memoryListSkill,
    // Code & DevOps
    githubCreateIssueSkill,
    githubCreatePRSkill,
    githubListPRsSkill,
    terminalRunCommandSkill,
    // Browser
    browserOpenUrlSkill,
    browserExtractSkill,
    browserExtractTextSkill,
    browserFillFormSkill,
    browserClickElementSkill,
    browserInspectVisibleUiSkill,
    browserPressKeySkill,
    browserSearchGoogleSkill,
    browserScrollPageSkill,
    browserScreenshotSkill,
    browserTypeIntoSkill,
    browserUiNavigateSkill,
    // Automation
    zapierTriggerSkill,
    zapierListSkill,
    // Creative
    creativeGenerateImageSkill,
];

for (const skill of ALL_SKILLS) {
    registerSkill(skill);
}

console.log(`[Skills] Registered ${ALL_SKILLS.length} skills`);

export { ALL_SKILLS };
