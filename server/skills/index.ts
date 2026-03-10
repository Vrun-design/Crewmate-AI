/**
 * Skill Loader — registers all skills into the Skill Registry on server startup.
 * Import this file ONCE in server/index.ts to activate the full skill set.
 */
import { registerSkill } from './registry';

// ── Productivity Skills ──────────────────────────────────────────────────────
import { clickupCreateTaskSkill } from './productivity/clickup-create-task.skill';
import { notionCreatePageSkill } from './productivity/notion-create-page.skill';
import { calendarScheduleSkill, calendarFindFreeTimeSkill, calendarListEventsSkill } from './productivity/calendar.skills';

// ── Communication Skills ─────────────────────────────────────────────────────
import { slackPostMessageSkill } from './communication/slack-post-message.skill';
import { gmailSendSkill, gmailDraftSkill, gmailReadInboxSkill } from './communication/gmail.skills';

// ── Code Skills ──────────────────────────────────────────────────────────────
import { githubCreateIssueSkill } from './code/github-create-issue.skill';
import { githubCreatePRSkill } from './code/github-create-pr.skill';
import { terminalRunCommandSkill } from './code/terminal-run-command.skill';

// ── Research Skills ──────────────────────────────────────────────────────────
import { webSearchSkill, webSummarizeUrlSkill } from './research/web.skills';

// ── Browser Skills (Phase 6) ─────────────────────────────────────────────────
import {
    browserOpenUrlSkill,
    browserExtractSkill,
    browserFillFormSkill,
    browserSearchGoogleSkill,
    browserScreenshotSkill,
} from './browser/browser.skills';

const ALL_SKILLS = [
    // Productivity
    clickupCreateTaskSkill,
    notionCreatePageSkill,
    calendarScheduleSkill,
    calendarFindFreeTimeSkill,
    calendarListEventsSkill,
    // Communication
    slackPostMessageSkill,
    gmailSendSkill,
    gmailDraftSkill,
    gmailReadInboxSkill,
    // Code
    githubCreateIssueSkill,
    githubCreatePRSkill,
    terminalRunCommandSkill,
    // Research
    webSearchSkill,
    webSummarizeUrlSkill,
    // Browser (Phase 6)
    browserOpenUrlSkill,
    browserExtractSkill,
    browserFillFormSkill,
    browserSearchGoogleSkill,
    browserScreenshotSkill,
];

for (const skill of ALL_SKILLS) {
    registerSkill(skill);
}

console.log(`[Skills] Registered ${ALL_SKILLS.length} skills`);

export { ALL_SKILLS };
