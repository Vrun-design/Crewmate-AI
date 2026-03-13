/**
 * UI Navigator Agent — Universe-Best Autonomous Browser Operator
 *
 * The most intelligent web task executor possible:
 *   1. Intent decomposition — breaks complex tasks into atomic browser steps
 *   2. Pre-task strategy — identifies expected UI states, likely obstacles
 *   3. Adaptive multi-step execution with Playwright browser skills
 *   4. Context extraction — reads and saves data it finds along the way
 *   5. Post-task summary — what was done, what was found, what to do next
 *
 * Handles: form fills, multi-page flows, login-gated content, data extraction,
 * screenshot capture, URL routing, navigation with backtracking on failure.
 */
import express from 'express';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import { createGeminiClient } from '../geminiClient';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import { isFeatureEnabled } from '../featureFlagService';

export const UI_NAVIGATOR_AGENT_MANIFEST = {
  id: 'crewmate-ui-navigator-agent',
  name: 'UI Navigator Agent',
  department: 'Automation',
  description: 'Autonomous AI browser operator — navigates web UIs, fills forms, extracts data, executes multi-step workflows across any website, scrapes structured information, and takes screenshots. Handles login flows, SPAs, and complex multi-page tasks.',
  capabilities: [
    'multi_step_web_automation',
    'form_filling',
    'data_extraction',
    'login_flow_handling',
    'screenshot_capture',
    'content_scraping',
    'spa_navigation',
    'url_routing',
    'click_interactions',
    'intelligent_backtracking',
  ],
  skills: ['browser.ui-navigate', 'browser.inspect-visible-ui', 'browser.click-element', 'browser.type-into', 'browser.extract', 'web.summarize-url'],
  model: serverConfig.geminiOrchestrationModel,
  emoji: '🌐',
};

type UiNavigatorAgentResult = {
  success: boolean;
  output: unknown;
  summary?: string;
  executionPlan?: string;
  durationMs: number;
};

const UI_NAVIGATOR_EXPERT_SYSTEM_PROMPT = `You are the world's most advanced autonomous browser operator. You approach web automation with the precision of a senior QA engineer, the intelligence of a UX researcher, and the adaptability of a senior developer who's automated hundreds of workflows.

Your operating principles:
- Plan before acting: understand the full task flow before taking the first action
- Think in states: what does the UI look like NOW, what must it look like for the next step to succeed?
- Anticipate failure modes: login walls, cookie banners, dynamic content, slow loads, redirects
- Extract data opportunistically: if you see useful information while navigating, capture it
- Be adaptive: if an element isn't where expected, try alternative selectors or scroll to find it
- Never give up on the first failure: try at least 2-3 approaches before reporting blocked

Web task categories you master:
1. **Data extraction**: scraping tables, lists, product data, pricing, search results
2. **Form automation**: filling multi-step forms, handling dropdowns, checkboxes, date pickers
3. **Account workflows**: login, signup, profile updates (when credentials provided)
4. **Research tasks**: navigating search results, reading articles, comparing options
5. **SaaS workflows**: navigating complex web apps, finding settings, triggering actions
6. **Documentation tasks**: reading docs.*, API references, navigating help centers
7. **Competitive intelligence**: checking competitor sites, capturing pricing, features

Your step-by-step approach:
1. Parse the URL and identify the starting context
2. Determine the sequence of pages/states needed to reach the goal
3. For each state: observe what's visible → identify the target element → act → verify result
4. If a step fails: inspect the current state → try alternative approach → or navigate to retry from a known good state
5. Collect and structure any data found along the way
6. Report back: what was accomplished, any data extracted, any obstacles encountered`;

interface UiNavigatorIntentParts {
  cleanedIntent: string;
  startUrl?: string;
  extractGoal?: string;
  taskType: 'extraction' | 'form' | 'navigation' | 'research' | 'workflow';
}

function getTaskType(intent: string): UiNavigatorIntentParts['taskType'] {
  if (/extract|scrape|find|get|list|table|pric|data/i.test(intent)) {
    return 'extraction';
  }

  if (/fill|submit|form|type|enter|sign up|register/i.test(intent)) {
    return 'form';
  }

  if (/research|compare|look up|what is|learn about/i.test(intent)) {
    return 'research';
  }

  if (/click|go to|navigate|open|visit/i.test(intent)) {
    return 'navigation';
  }

  return 'workflow';
}

function parseNavigatorIntent(intent: string): UiNavigatorIntentParts {
  const startUrlMatch = intent.match(/start url:\s*(https?:\/\/\S+)/i)
    ?? intent.match(/(?:go to|navigate to|open|visit)\s+(https?:\/\/\S+)/i)
    ?? intent.match(/(https?:\/\/[^\s,]+)/i);
  const taskMatch = intent.match(/task:\s*([\s\S]+)/i);
  const extractMatch = intent.match(/(?:extract|find|get|list)\s+(.+?)(?:\s+from|\s+on|\s+at|$)/i);

  return {
    cleanedIntent: taskMatch?.[1]?.trim() ?? intent.trim(),
    startUrl: startUrlMatch?.[1]?.trim(),
    extractGoal: extractMatch?.[1]?.trim(),
    taskType: getTaskType(intent.toLowerCase()),
  };
}

function buildNavigationPlan(intent: string, parts: UiNavigatorIntentParts): string {
    const { taskType, startUrl, extractGoal } = parts;

    const plans: Record<string, string> = {
        extraction: `Data Extraction Plan:
1. Navigate to ${startUrl ?? 'target URL'}
2. Handle any overlays (cookie banners, popups, modals)
3. Identify the data container (table, list, cards)
4. Extract: ${extractGoal ?? 'the requested data'}
5. If paginated: repeat extraction across all pages
6. Return structured data`,

        form: `Form Automation Plan:
1. Navigate to the form URL
2. Handle authentication if required (likely)
3. Identify all required fields
4. Fill each field in order (top to bottom)
5. Handle special inputs (dropdowns, date pickers, file uploads)
6. Review before submitting
7. Submit and capture confirmation`,

        research: `Research Navigation Plan:
1. Start at the search/resource URL
2. Identify the most relevant content on the page
3. Navigate deeper into relevant sections
4. Extract key information as we go
5. Synthesize findings from multiple pages if needed
6. Return structured findings with sources`,

        navigation: `Navigation Plan:
1. Navigate to start URL
2. Identify navigation structure (nav menu, sidebar, breadcrumbs)
3. Follow the path to the target page/element
4. Verify we reached the goal state
5. Perform any required actions
6. Confirm completion`,

        workflow: `Workflow Automation Plan:
1. Identify the starting point and end goal state
2. Map the intermediate steps (what screens/states are needed)
3. Execute each step, verifying UI state before proceeding
4. Handle errors gracefully with retries
5. Confirm the final state matches the goal
6. Report what was accomplished`,
    };

    return plans[taskType] ?? plans.workflow;
}

export async function runUiNavigatorAgent(
  intent: string,
  ctx: SkillRunContext,
  emitStep: EmitStep,
): Promise<UiNavigatorAgentResult> {
  if (!isFeatureEnabled('uiNavigator')) {
    throw new Error('UI Navigator is disabled. Enable FEATURE_UI_NAVIGATOR to run this agent.');
  }

  const ai = createGeminiClient();
  const parts = parseNavigatorIntent(intent);
  const { cleanedIntent, startUrl, taskType } = parts;

    // Step 1: Strategic planning — decompose the task
    emitStep('thinking', `Analyzing ${taskType} task...`, {
        detail: `"${cleanedIntent.slice(0, 100)}"${startUrl ? ` → ${startUrl}` : ''}`,
    });

    const navigationPlan = buildNavigationPlan(intent, parts);

    // Use Gemini to create a refined, step-by-step execution plan
    emitStep('thinking', 'Planning optimal browser execution sequence...', { detail: `Task type: ${taskType}` });
    let executionPlan = '';
    try {
        const planResponse = await ai.models.generateContent({
            model: serverConfig.geminiOrchestrationModel,
            contents: `${UI_NAVIGATOR_EXPERT_SYSTEM_PROMPT}

You are about to operate a web browser to accomplish this task:
"${cleanedIntent}"
${startUrl ? `Starting URL: ${startUrl}` : ''}

Initial plan:
${navigationPlan}

Refine this into a precise execution plan with:
1. 3-7 numbered atomic steps (each step = one browser action)
2. For each step: what to look for, what to click/type, how to verify success
3. 2-3 likely failure modes and how to handle them
4. What data to capture/extract as part of this task

Be concise — this is an internal execution plan, not user-facing.`,
        });
        executionPlan = planResponse.text ?? '';
        emitStep('thinking', 'Execution plan ready — starting browser automation', {
            detail: `${taskType} task | ${executionPlan.split('\n').length} planned steps`,
        });
    } catch {
        // If planning fails, proceed without refined plan
        executionPlan = navigationPlan;
        emitStep('thinking', 'Using default navigation strategy', { detail: navigationPlan.slice(0, 100) });
    }

    // Infer start URL from plain-English site names when no URL is in the intent
    let inferredStartUrl = startUrl;
    if (!inferredStartUrl) {
        const urlInferenceMap: Record<string, string> = {
            'lenny': 'https://www.lennysnewsletter.com',
            "lenny's": 'https://www.lennysnewsletter.com',
            "lenny's podcast": 'https://www.lennysnewsletter.com',
            'y combinator': 'https://www.ycombinator.com',
            'hacker news': 'https://news.ycombinator.com',
            'product hunt': 'https://www.producthunt.com',
            'linkedin': 'https://www.linkedin.com',
            'twitter': 'https://twitter.com',
            'x.com': 'https://x.com',
            'github': 'https://github.com',
            'notion': 'https://www.notion.so',
            'vercel': 'https://vercel.com',
            'netlify': 'https://www.netlify.com',
            'substack': 'https://substack.com',
        };
        const intentLower = cleanedIntent.toLowerCase();
        for (const [keyword, url] of Object.entries(urlInferenceMap)) {
            if (intentLower.includes(keyword)) {
                inferredStartUrl = url;
                break;
            }
        }
    }
  let pageContext = '';
  if (startUrl) {
    emitStep('skill_call', `Fetching initial page context from ${startUrl}...`, { skillId: 'browser.inspect-visible-ui' });
    try {
      const t0 = Date.now();
      const inspection = await runSkill('browser.inspect-visible-ui', ctx, { url: startUrl });
      pageContext = typeof (inspection.result as { message?: string }).message === 'string'
        ? (inspection.result as { message: string }).message
        : '';
      emitStep('skill_result', 'Page context loaded', {
        skillId: 'browser.inspect-visible-ui',
        durationMs: Date.now() - t0,
        success: true,
        detail: `UI state captured — ${pageContext.length} chars`,
      });
    } catch {
      // Non-critical — proceed to main execution
    }
  }

    // Step 3: Main browser execution with the full plan as context
    emitStep('skill_call', `Executing ${taskType} automation...`, { skillId: 'browser.ui-navigate' });
    const startedAt = Date.now();

    const enrichedIntent = [
        cleanedIntent,
        '',
        '=== EXECUTION STRATEGY ===',
        executionPlan,
        pageContext ? `\n=== CURRENT PAGE CONTEXT ===\n${pageContext.slice(0, 500)}` : '',
        inferredStartUrl && !startUrl ? `\n=== INFERRED START URL ===\nStart at: ${inferredStartUrl}` : '',
        '',
        '=== CRITICAL RULES ===',
        '- Dismiss cookie banners and popups immediately with dismiss_overlay before other actions',
        '- Use clear_and_type (not type) for all email/text inputs to avoid appending to pre-filled values',
        '- After submitting a form, wait for confirmation before emitting finish',
        '- If an action fails, try a different selector or approach — never repeat the exact same failing action',
        '- Only emit finish when you see a success/confirmation message or URL change confirming the task is done',
        '- Provide alternativeSelectors for click/type actions as fallback options',
    ].filter(Boolean).join('\n');

    const run = await runSkill('browser.ui-navigate', ctx, {
        intent: enrichedIntent,
        startUrl: inferredStartUrl ?? startUrl,
        maxSteps: 30,
    });

    const result = run.result as unknown as Record<string, unknown>;
    const success = result.success !== false;
    const duration = Date.now() - startedAt;

    emitStep('skill_result', success ? `✅ ${taskType} task complete` : `⚠️ Task partially complete`, {
        skillId: 'browser.ui-navigate',
        durationMs: duration,
        success,
        detail: typeof result.message === 'string' ? result.message.slice(0, 200) : cleanedIntent,
    });

    // Step 4: Post-task synthesis — summarize what was accomplished
    if (success && result.output) {
        const outputText = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
        if (outputText.length > 50) {
            emitStep('generating', 'Synthesizing extracted data and results...', { detail: `${outputText.length} chars of output` });
            try {
                const summaryResponse = await ai.models.generateContent({
                    model: serverConfig.geminiOrchestrationModel,
                    contents: `${UI_NAVIGATOR_EXPERT_SYSTEM_PROMPT}

You just completed a browser automation task. Synthesize the results into a clear, structured summary.

Original task: "${cleanedIntent}"
Task type: ${taskType}
Duration: ${Math.round(duration / 1000)}s

Raw browser output:
${outputText.slice(0, 3000)}

Write a clear summary with:
## ✅ What Was Accomplished
[What the agent did, step by step]

## 📊 Data Extracted / Results Found
[Any data, links, prices, information found — structured as tables or bullets]

## 🔗 Relevant URLs
[Any important URLs discovered or visited]

## ⚠️ Any Issues or Limitations
[Anything that couldn't be completed and why]

## 💡 Suggested Next Steps
[What the user might want to do next based on the results]`,
                });
                const summary = summaryResponse.text ?? '';
                emitStep('skill_result', 'Results synthesized', { success: true, detail: `${summary.split(/\s+/).length} word summary` });

                emitStep('done', `Browser task complete in ${Math.round(duration / 1000)}s`, { success: true });
                return { success: true, output: result.output, summary, executionPlan, durationMs: duration };
            } catch {
                // Non-critical — still return raw result
            }
        }
    }

    emitStep('done', success ? `Browser task complete in ${Math.round(duration / 1000)}s` : 'Browser task halted — see details', { success });
    return {
        success,
        output: result.output ?? result,
        summary: typeof result.message === 'string' ? result.message : undefined,
        executionPlan,
        durationMs: duration,
    };
}

export const uiNavigatorAgentApp = express();
uiNavigatorAgentApp.use(express.json());
uiNavigatorAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(UI_NAVIGATOR_AGENT_MANIFEST));
