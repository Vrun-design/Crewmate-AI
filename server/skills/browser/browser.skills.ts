/**
 * Browser Skills — Phase 6
 *
 * All browser capabilities exposed as typed Crewmate skills:
 *   browser.open-url      — Navigate to a URL and get metadata
 *   browser.extract       — Extract readable text from any webpage
 *   browser.fill-form     — Fill and submit web forms
 *   browser.search-google — Google search results
 *   browser.screenshot    — Screenshot a page (for Gemini vision)
 */
import type { Skill } from '../types';
import {
    clickElement,
    openUrl,
    extractContent,
    extractTextFromPage,
    fillForm,
    inspectVisibleUi,
    navigateWithUiPlanner,
    pressPageKey,
    scrollBrowserPage,
    searchGoogle,
    takeScreenshot,
    typeIntoElement,
} from '../../services/browserEngine';
import { isFeatureEnabled } from '../../services/featureFlagService';

function ensureUiNavigatorEnabled() {
    if (!isFeatureEnabled('uiNavigator')) {
        throw new Error('UI navigator is disabled. Enable FEATURE_UI_NAVIGATOR to use browser automation skills.');
    }
}

// ── browser.open-url ──────────────────────────────────────────────────────────

export const browserOpenUrlSkill: Skill = {
    id: 'browser.open-url',
    name: 'Open URL',
    description: 'Navigate to a URL and retrieve its page title and HTTP status code.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'researcher', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['open website', 'navigate to', 'go to URL', 'visit page'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The full URL to navigate to (must include https://)' },
        },
        required: ['url'],
    },
    async handler(_ctx, args) {
        const { url } = args as { url: string };
        const result = await openUrl(url);
        return { success: true, output: result, message: `Opened "${result.title}" (HTTP ${result.status})` };
    },
};

// ── browser.extract ───────────────────────────────────────────────────────────

export const browserExtractSkill: Skill = {
    id: 'browser.extract',
    name: 'Extract Page Content',
    description: 'Extract the readable text content from any webpage — strips navigation, ads, and boilerplate.',
    version: '1.0.0',
    category: 'browser',
    personas: ['researcher', 'developer', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['read webpage', 'extract content', 'get page text', 'read article', 'scrape page'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The URL of the page to extract content from' },
        },
        required: ['url'],
    },
    async handler(_ctx, args) {
        const { url } = args as { url: string };
        const result = await extractContent(url);
        return {
            success: true,
            output: result,
            message: `Extracted ${result.content.length} characters from "${result.title}"`,
        };
    },
};

// ── browser.fill-form ─────────────────────────────────────────────────────────

export const browserFillFormSkill: Skill = {
    id: 'browser.fill-form',
    name: 'Fill Web Form',
    description: 'Fill in web form fields by CSS selector and optionally submit the form.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['fill form', 'submit form', 'fill in fields', 'auto-fill'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'URL of the page containing the form' },
            fieldsJson: { type: 'string', description: 'JSON object mapping CSS selectors to values, e.g. {"#email": "user@example.com"}' },
            submitSelector: { type: 'string', description: 'CSS selector for the submit button (optional)' },
        },
        required: ['url', 'fieldsJson'],
    },
    async handler(_ctx, args) {
        const { url, fieldsJson, submitSelector } = args as { url: string; fieldsJson: string; submitSelector?: string };
        const fields = JSON.parse(fieldsJson) as Record<string, string>;
        const result = await fillForm({ url, fields, submitSelector });
        return { success: result.success, output: result, message: result.message };
    },
};

// ── browser.search-google ─────────────────────────────────────────────────────

export const browserSearchGoogleSkill: Skill = {
    id: 'browser.search-google',
    name: 'Google Search',
    description: 'Run a real Google search via browser and return the top results with titles, URLs, and snippets.',
    version: '1.0.0',
    category: 'browser',
    personas: ['researcher', 'developer', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['google this', 'search google for', 'look up on google', 'find results for'],
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query to run on Google' },
            maxResults: { type: 'number', description: 'Max number of results to return (default: 5)' },
        },
        required: ['query'],
    },
    async handler(_ctx, args) {
        const { query, maxResults = 5 } = args as { query: string; maxResults?: number };
        const results = await searchGoogle(query, maxResults);
        const message = results.length > 0
            ? `Found ${results.length} results for "${query}"`
            : `No Google results found for "${query}"`;
        return { success: true, output: results, message };
    },
};

// ── browser.screenshot ────────────────────────────────────────────────────────

export const browserScreenshotSkill: Skill = {
    id: 'browser.screenshot',
    name: 'Screenshot Webpage',
    description: 'Take a screenshot of any webpage and return it as base64 JPEG (for Gemini vision analysis).',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'researcher', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['screenshot', 'capture page', 'take screenshot of', 'show me what', 'what does the site look like'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'URL of the page to screenshot' },
        },
        required: ['url'],
    },
    async handler(_ctx, args) {
        const { url } = args as { url: string };
        const result = await takeScreenshot(url);
        return {
            success: true,
            output: { base64: result.base64.slice(0, 100) + '...', mimeType: result.mimeType, title: result.title },
            message: `Screenshot captured for "${result.title}"`,
        };
    },
};

// ── browser.inspect-visible-ui ───────────────────────────────────────────────

export const browserInspectVisibleUiSkill: Skill = {
    id: 'browser.inspect-visible-ui',
    name: 'Inspect Visible UI',
    description: 'Capture the current visible UI state, including screenshot metadata and interactable element candidates.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'researcher', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['inspect visible ui', 'inspect page controls', 'list clickable elements', 'analyze current page ui'],
    preferredModel: 'orchestration',
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'URL of the page to inspect' },
        },
        required: ['url'],
    },
    async handler(_ctx, args) {
        ensureUiNavigatorEnabled();
        const { url } = args as { url: string };
        const result = await inspectVisibleUi(url);
        return {
            success: true,
            output: {
                url: result.url,
                title: result.title,
                elementCount: result.elements.length,
                elements: result.elements.slice(0, 10),
            },
            message: `Inspected ${result.elements.length} visible UI elements on "${result.title}"`,
        };
    },
};

// ── browser.click-element ────────────────────────────────────────────────────

export const browserClickElementSkill: Skill = {
    id: 'browser.click-element',
    name: 'Click UI Element',
    description: 'Open a page and click a visible element by selector.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['click element', 'click button', 'press ui element'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Page URL to open before clicking' },
            selector: { type: 'string', description: 'Selector for the target element' },
        },
        required: ['url', 'selector'],
    },
    async handler(_ctx, args) {
        ensureUiNavigatorEnabled();
        const { url, selector } = args as { url: string; selector: string };
        const result = await clickElement(url, selector);
        return { success: result.success, output: result, message: result.message };
    },
};

// ── browser.type-into ────────────────────────────────────────────────────────

export const browserTypeIntoSkill: Skill = {
    id: 'browser.type-into',
    name: 'Type Into UI Element',
    description: 'Open a page and type text into a visible field by selector.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['type into field', 'enter text', 'fill this input'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Page URL to open before typing' },
            selector: { type: 'string', description: 'Selector for the target field' },
            value: { type: 'string', description: 'Text to enter into the field' },
        },
        required: ['url', 'selector', 'value'],
    },
    async handler(_ctx, args) {
        ensureUiNavigatorEnabled();
        const { url, selector, value } = args as { url: string; selector: string; value: string };
        const result = await typeIntoElement(url, selector, value);
        return { success: result.success, output: result, message: result.message };
    },
};

// ── browser.press-key ────────────────────────────────────────────────────────

export const browserPressKeySkill: Skill = {
    id: 'browser.press-key',
    name: 'Press Browser Key',
    description: 'Open a page and press a keyboard key such as Enter, Tab, or Escape.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['press enter', 'press key', 'send keyboard shortcut'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Page URL to open before pressing the key' },
            key: { type: 'string', description: 'Keyboard key to press, such as Enter or Escape' },
        },
        required: ['url', 'key'],
    },
    async handler(_ctx, args) {
        ensureUiNavigatorEnabled();
        const { url, key } = args as { url: string; key: string };
        const result = await pressPageKey(url, key);
        return { success: result.success, output: result, message: result.message };
    },
};

// ── browser.scroll-page ──────────────────────────────────────────────────────

export const browserScrollPageSkill: Skill = {
    id: 'browser.scroll-page',
    name: 'Scroll Browser Page',
    description: 'Open a page and scroll it up or down by a specified amount.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['scroll down', 'scroll up', 'move page'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Page URL to open before scrolling' },
            direction: { type: 'string', description: 'Scroll direction', enum: ['up', 'down'] },
            amount: { type: 'number', description: 'Optional pixel distance to scroll' },
        },
        required: ['url', 'direction'],
    },
    async handler(_ctx, args) {
        ensureUiNavigatorEnabled();
        const { url, direction, amount } = args as { url: string; direction: 'up' | 'down'; amount?: number };
        const result = await scrollBrowserPage(url, direction, amount);
        return { success: result.success, output: result, message: result.message };
    },
};

// ── browser.extract-text ─────────────────────────────────────────────────────

export const browserExtractTextSkill: Skill = {
    id: 'browser.extract-text',
    name: 'Extract UI Text',
    description: 'Open a page and extract text from a visible element by selector.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'researcher', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['extract ui text', 'read this button', 'read text from element'],
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Page URL to open before extraction' },
            selector: { type: 'string', description: 'Selector for the target element' },
        },
        required: ['url', 'selector'],
    },
    async handler(_ctx, args) {
        ensureUiNavigatorEnabled();
        const { url, selector } = args as { url: string; selector: string };
        const result = await extractTextFromPage(url, selector);
        return { success: result.success, output: result, message: result.message };
    },
};

// ── browser.ui-navigate ──────────────────────────────────────────────────────

export const browserUiNavigateSkill: Skill = {
    id: 'browser.ui-navigate',
    name: 'UI Navigate',
    description: 'Use Gemini multimodal planning plus Playwright actions to navigate a browser UI toward a user goal.',
    version: '1.0.0',
    category: 'browser',
    personas: ['developer', 'researcher', 'all'],
    requiresIntegration: [],
    triggerPhrases: ['navigate this ui', 'use the website for me', 'click through the page', 'automate browser steps'],
    preferredModel: 'orchestration',
    inputSchema: {
        type: 'object',
        properties: {
            intent: { type: 'string', description: 'The UI task to complete' },
            startUrl: { type: 'string', description: 'Optional URL to open before navigation begins' },
            maxSteps: { type: 'number', description: 'Maximum number of steps to execute before stopping' },
        },
        required: ['intent'],
    },
    async handler(_ctx, args) {
        ensureUiNavigatorEnabled();
        const { intent, startUrl, maxSteps } = args as { intent: string; startUrl?: string; maxSteps?: number };
        const result = await navigateWithUiPlanner(intent, { startUrl, maxSteps });
        return {
            success: result.status === 'completed',
            output: result,
            message: result.summary,
        };
    },
};
