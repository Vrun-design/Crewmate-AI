/**
 * Skill Loader — registers all skills into the Skill Registry on server startup.
 * Import this file once during server boot to activate the current skill set.
 */
import { hydrateSkillManifest } from './framework';
import { registerSkill } from './registry';

// ── Research Skills ───────────────────────────────────────────────────────────
import { webSearchSkill, webSummarizeUrlSkill } from './research/web.skills';

// ── Communication Skills ──────────────────────────────────────────────────────
import { slackPostMessageSkill } from './communication/slack-post-message.skill';
import { slackListChannelsSkill } from './communication/slack-list-channels.skill';
import { slackGetMessagesSkill } from './communication/slack-get-messages.skill';
import { slackSendDmSkill } from './communication/slack-send-dm.skill';
import { slackGetDmsSkill } from './communication/slack-get-dms.skill';

// ── Automation Skills ─────────────────────────────────────────────────────────
import { zapierListSkill, zapierTriggerSkill } from './automation/zapier.skills';

// ── Productivity Skills ───────────────────────────────────────────────────────
import { notionCreatePageSkill } from './productivity/notion-create-page.skill';
import { notionAppendBlocksSkill } from './productivity/notion-append-blocks.skill';
import { notionAppendScreenshotSkill } from './productivity/notion-append-screenshot.skill';
import { notionUploadImageSkill } from './productivity/notion-upload-image.skill';
import { notionCreateDatabaseRecordSkill } from './productivity/notion-create-database-record.skill';
import { notionListPagesSkill } from './productivity/notion-list-pages.skill';
import { notionSearchPagesSkill } from './productivity/notion-search-pages.skill';
import { notionUpdatePageSkill } from './productivity/notion-update-page.skill';
import { clickupCreateTaskSkill } from './productivity/clickup-create-task.skill';
import { clickupAttachScreenshotSkill } from './productivity/clickup-attach-screenshot.skill';
import { clickupListTasksSkill } from './productivity/clickup-list-tasks.skill';
import { clickupGetTaskSkill } from './productivity/clickup-get-task.skill';
import { morningBriefingSkill } from './productivity/morning-briefing.skill';
import { liveCaptureScreenshotSkill } from './productivity/live-capture-screenshot.skill';
import { liveDelegateToAgentSkill } from './productivity/live-delegate-to-agent.skill';
import { liveRunPipelineSkill } from './productivity/live-run-pipeline.skill';
import { notionReadPageSkill } from './productivity/notion-read-page.skill';
import { memoryStoreSkill, memoryRetrieveSkill, memoryListSkill } from './productivity/memory.skills';
import { taskCancelSkill, taskListActiveSkill } from './productivity/task-control.skills';
import { workspaceCreateTaskSkill } from './productivity/workspace-create-task.skill';
import {
  googleCalendarCreateEventSkill,
  googleCalendarListEventsSkill,
  googleDocsAppendContentSkill,
  googleDocsCreateDocumentSkill,
  googleDocsReadDocumentSkill,
  googleDriveCreateFolderSkill,
  googleDriveSearchFilesSkill,
  googleGmailDraftEmailSkill,
  googleGmailReadMessageSkill,
  googleGmailSearchSkill,
  googleGmailSendEmailSkill,
  googleSheetsAppendRowsSkill,
  googleSheetsCreateSpreadsheetSkill,
  googleSheetsReadSpreadsheetSkill,
  googleSlidesAddSlidesSkill,
  googleSlidesCreatePresentationSkill,
  googleSlidesReadPresentationSkill,
} from './productivity/google-workspace.skills';

// ── Code & DevOps Skills ──────────────────────────────────────────────────────
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

const RAW_SKILLS = [
  // Research
  webSearchSkill,
  webSummarizeUrlSkill,
  // Communication
  slackPostMessageSkill,
  slackListChannelsSkill,
  slackGetMessagesSkill,
  slackSendDmSkill,
  slackGetDmsSkill,
  // Automation
  zapierTriggerSkill,
  zapierListSkill,
  // Productivity
  notionCreatePageSkill,
  notionAppendBlocksSkill,
  notionAppendScreenshotSkill,
  notionUploadImageSkill,
  notionCreateDatabaseRecordSkill,
  notionListPagesSkill,
  notionSearchPagesSkill,
  notionUpdatePageSkill,
  liveCaptureScreenshotSkill,
  liveDelegateToAgentSkill,
  liveRunPipelineSkill,
  notionReadPageSkill,
  clickupCreateTaskSkill,
  clickupAttachScreenshotSkill,
  clickupListTasksSkill,
  clickupGetTaskSkill,
  morningBriefingSkill,
  workspaceCreateTaskSkill,
  googleGmailDraftEmailSkill,
  googleGmailSendEmailSkill,
  googleGmailSearchSkill,
  googleDocsCreateDocumentSkill,
  googleDocsAppendContentSkill,
  googleDocsReadDocumentSkill,
  googleSheetsCreateSpreadsheetSkill,
  googleSheetsAppendRowsSkill,
  googleSheetsReadSpreadsheetSkill,
  googleSlidesCreatePresentationSkill,
  googleSlidesAddSlidesSkill,
  googleSlidesReadPresentationSkill,
  googleDriveSearchFilesSkill,
  googleDriveCreateFolderSkill,
  googleCalendarCreateEventSkill,
  googleCalendarListEventsSkill,
  // Memory
  memoryStoreSkill,
  memoryRetrieveSkill,
  memoryListSkill,
  taskListActiveSkill,
  taskCancelSkill,
  // Code & DevOps
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
];

const ALL_SKILLS = RAW_SKILLS.map((skill) => hydrateSkillManifest(skill));

for (const skill of ALL_SKILLS) {
  registerSkill(skill);
}

console.log(`[Skills] Registered ${ALL_SKILLS.length} skills`);

export { ALL_SKILLS };
