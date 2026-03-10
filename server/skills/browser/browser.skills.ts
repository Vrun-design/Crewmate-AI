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
    openUrl,
    extractContent,
    fillForm,
    searchGoogle,
    takeScreenshot,
} from '../../services/browserEngine';

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
