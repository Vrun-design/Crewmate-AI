/**
 * Web Skills — Phase 14 (Tavily primary, DuckDuckGo fallback)
 *
 * web.search:     Tavily API (AI-optimized results) → DuckDuckGo fallback
 * web.summarize-url: Gemini Flash summarization (unchanged)
 *
 * Tavily produces LLM-ready summaries, not raw HTML.
 * Set TAVILY_API_KEY env var to enable. DuckDuckGo used when absent/rate-limited.
 */
import { Behavior } from '@google/genai';
import type { Skill } from '../types';
import { selectModel } from '../../services/modelRouter';


// ── Tavily search ─────────────────────────────────────────────────────────────

interface TavilyResult {
    title: string;
    url: string;
    content: string;
    score?: number;
}

interface TavilyResponse {
    answer?: string;
    results: TavilyResult[];
    query: string;
}

async function searchTavily(query: string, maxResults = 5): Promise<{ results: TavilyResult[]; answer?: string } | null> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                max_results: maxResults,
                search_depth: 'basic',
                include_answer: true,
                include_raw_content: false,
            }),
            signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) return null;
        const data = await response.json() as TavilyResponse;
        return { results: data.results ?? [], answer: data.answer };
    } catch {
        return null;
    }
}

// ── DuckDuckGo fallback ───────────────────────────────────────────────────────

interface DuckDuckGoResult {
    title: string;
    href: string;
    body: string;
}

async function searchDuckDuckGo(query: string, maxResults = 5): Promise<DuckDuckGoResult[]> {
    const encoded = encodeURIComponent(query);
    const response = await fetch(
        `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
        { headers: { 'User-Agent': 'crewmate-ai-agent/1.0' } }
    );

    if (!response.ok) throw new Error(`DuckDuckGo search failed: ${response.status}`);

    const data = await response.json() as {
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        AbstractText?: string;
        AbstractURL?: string;
    };

    const results: DuckDuckGoResult[] = [];
    if (data.AbstractText && data.AbstractURL) {
        results.push({ title: query, href: data.AbstractURL, body: data.AbstractText });
    }
    if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
            if (topic.Text && topic.FirstURL) {
                results.push({
                    title: topic.Text.split(' - ')[0] ?? topic.Text,
                    href: topic.FirstURL,
                    body: topic.Text,
                });
            }
        }
    }
    return results.slice(0, maxResults);
}

// ── URL summarizer ────────────────────────────────────────────────────────────

async function summarizeUrl(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; crewmate-ai-agent/1.0)' },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Failed to fetch URL (${response.status}): ${url}`);

    const html = await response.text();
    const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 8000);

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '' });
    const result = await ai.models.generateContent({
        model: selectModel('research', 'low'),
        contents: `Summarize this web page content concisely in 3-5 paragraphs. URL: ${url}\n\nContent:\n${text}`,
    });

    return result.text ?? 'Unable to summarize content.';
}

// ── Exported skills ───────────────────────────────────────────────────────────

export const webSearchSkill: Skill = {
    id: 'web.search',
    name: 'Web Search',
    description: 'Search the web for information. Uses Tavily AI-optimized search (set TAVILY_API_KEY) with DuckDuckGo as fallback. Use for research, news, competitive analysis.',
    version: '2.0.0',
    category: 'research',
    personas: ['developer', 'marketer', 'founder', 'sales', 'designer'],
    requiresIntegration: [],
    triggerPhrases: [
        'Search the web for X',
        'Look up information about Y',
        'Research this topic',
        'Find current information about Z',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query' },
            maxResults: { type: 'number', description: 'Maximum number of results to return (default: 5)' },
        },
        required: ['query'],
    },
    handler: async (_ctx, args) => {
        const query = String(args.query ?? '');
        const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 5;

        // Try Tavily first (AI-optimized, returns clean summaries)
        const tavily = await searchTavily(query, maxResults);
        if (tavily && tavily.results.length > 0) {
            const answerSection = tavily.answer ? `**AI Answer**: ${tavily.answer}\n\n` : '';
            const formatted = tavily.results.map((r, i) =>
                `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`
            ).join('\n\n');

            return {
                success: true,
                output: tavily.results,
                message: `🔍 [Tavily] Web search results for "${query}":\n\n${answerSection}${formatted}`,
            };
        }

        // Fallback to DuckDuckGo
        try {
            const results = await searchDuckDuckGo(query, maxResults);
            if (results.length === 0) {
                return { success: true, output: [], message: `No results found for "${query}"` };
            }
            const provider = process.env.TAVILY_API_KEY ? 'Tavily rate-limited, using DuckDuckGo' : 'DuckDuckGo';
            const formatted = results.map((r, i) =>
                `${i + 1}. **${r.title}**\n   ${r.href}\n   ${r.body}`
            ).join('\n\n');
            return {
                success: true,
                output: results,
                message: `🔍 [${provider}] Web search results for "${query}":\n\n${formatted}`,
            };
        } catch (err) {
            return { success: false, message: `Web search failed: ${String(err)}` };
        }
    },
};

export const webSummarizeUrlSkill: Skill = {
    id: 'web.summarize-url',
    name: 'Summarize URL',
    description: 'Fetch and summarize any web page. Use when the user shares a URL and wants its content extracted, or when researching a specific page.',
    version: '1.0.0',
    category: 'research',
    personas: ['developer', 'marketer', 'founder', 'sales', 'designer'],
    requiresIntegration: [],
    triggerPhrases: [
        'Summarize this link',
        'What does this page say?',
        'Extract the content from this URL',
        'Read this article for me',
    ],
    preferredModel: 'research',
    exposeInLiveSession: true,
    liveFunctionBehavior: Behavior.NON_BLOCKING,
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The URL to fetch and summarize' },
        },
        required: ['url'],
    },
    handler: async (_ctx, args) => {
        const url = String(args.url ?? '');
        if (!url.startsWith('http')) {
            return { success: false, message: 'Invalid URL — must start with http:// or https://' };
        }
        const summary = await summarizeUrl(url);
        return {
            success: true,
            output: { url, summary },
            message: `📄 Summary of ${url}:\n\n${summary}`,
        };
    },
};
