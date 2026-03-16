/**
 * Web Skills — Elite Intelligence Engine
 *
 * web.search:       Multi-angle parallel search → Gemini synthesis → structured intelligence brief
 * web.summarize-url: Deep extraction with key insights, quotes, and relevance scoring
 *
 * The old version returned raw search dumps. This version thinks like an intelligence analyst:
 * 1. Fire 3 parallel search angles (primary, recency, alternative framing)
 * 2. Deduplicate + score all sources
 * 3. Synthesize through Gemini into a structured brief with key findings,
 *    confidence levels, source quality, and flagged contradictions
 *
 * Tavily primary (AI-optimized). DuckDuckGo fallback.
 * Set TAVILY_API_KEY to enable Tavily.
 */
import { Behavior } from '@google/genai';
import type { Skill } from '../types';
import { selectModel } from '../../services/modelRouter';
import { createGeminiClient } from '../../services/geminiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  source?: 'tavily' | 'duckduckgo';
  publishedDate?: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
  query: string;
}

interface IntelligenceBrief {
  query: string;
  executiveSummary: string;
  keyFindings: Array<{
    finding: string;
    confidence: 'high' | 'medium' | 'low';
    supportingUrls: string[];
  }>;
  contradictions: string[];
  sourceQuality: 'excellent' | 'good' | 'mixed' | 'poor';
  researchGaps: string[];
  sources: Array<{ title: string; url: string; relevanceScore: number }>;
  searchAnglesUsed: string[];
}

// ── Search providers ──────────────────────────────────────────────────────────

async function searchTavily(
  query: string,
  maxResults = 8,
  searchDepth: 'basic' | 'advanced' = 'advanced',
): Promise<{ results: SearchResult[]; answer?: string } | null> {
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
        search_depth: searchDepth,
        include_answer: true,
        include_raw_content: false,
        include_domains: [],
        exclude_domains: ['reddit.com/r/spam'],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as TavilyResponse;
    return {
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        source: 'tavily' as const,
        publishedDate: r.published_date,
      })),
      answer: data.answer,
    };
  } catch {
    return null;
  }
}

async function searchDuckDuckGo(query: string, maxResults = 8): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: { 'User-Agent': 'crewmate-ai-agent/2.0' },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      AbstractText?: string;
      AbstractURL?: string;
    };

    const results: SearchResult[] = [];
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: query,
        url: data.AbstractURL,
        content: data.AbstractText,
        source: 'duckduckgo',
      });
    }
    for (const topic of data.RelatedTopics?.slice(0, maxResults - results.length) ?? []) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] ?? topic.Text,
          url: topic.FirstURL,
          content: topic.Text,
          source: 'duckduckgo',
        });
      }
    }
    return results.slice(0, maxResults);
  } catch {
    return [];
  }
}

// ── Multi-angle parallel search ───────────────────────────────────────────────

/**
 * Generate 3 complementary search angles from a query:
 * 1. Primary — exact intent
 * 2. Recency — add "2024 2025 latest" framing
 * 3. Alternative — reframe to catch orthogonal perspectives
 */
function generateSearchAngles(query: string): { primary: string; recency: string; alternative: string } {
  const q = query.trim();
  return {
    primary: q,
    recency: `${q} 2024 2025 latest`,
    alternative: q.length > 30
      ? q.split(' ').slice(0, Math.ceil(q.split(' ').length / 2)).join(' ') + ' analysis insights'
      : `${q} overview analysis`,
  };
}

function deduplicateResults(allResults: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return allResults.filter((r) => {
    const key = r.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (b.score ?? 0.5) - (a.score ?? 0.5));
}

async function runMultiAngleSearch(
  query: string,
  maxPerAngle = 6,
): Promise<{ results: SearchResult[]; tavilyAnswer?: string; anglesUsed: string[] }> {
  const angles = generateSearchAngles(query);
  const anglesUsed: string[] = [];

  // Fire all 3 angles in parallel
  const [primary, recency, alternative] = await Promise.allSettled([
    searchTavily(angles.primary, maxPerAngle, 'advanced'),
    searchTavily(angles.recency, maxPerAngle, 'basic'),
    searchTavily(angles.alternative, maxPerAngle, 'basic'),
  ]);

  let allResults: SearchResult[] = [];
  let tavilyAnswer: string | undefined;

  if (primary.status === 'fulfilled' && primary.value) {
    allResults.push(...primary.value.results);
    tavilyAnswer = primary.value.answer;
    anglesUsed.push(`Primary: "${angles.primary}"`);
  }
  if (recency.status === 'fulfilled' && recency.value) {
    allResults.push(...recency.value.results);
    if (!anglesUsed.length) tavilyAnswer = recency.value.answer;
    anglesUsed.push(`Recency: "${angles.recency}"`);
  }
  if (alternative.status === 'fulfilled' && alternative.value) {
    allResults.push(...alternative.value.results);
    anglesUsed.push(`Alternative: "${angles.alternative}"`);
  }

  // Fall back to DuckDuckGo if Tavily gave nothing
  if (allResults.length === 0) {
    const ddg = await searchDuckDuckGo(query, maxPerAngle);
    allResults = ddg;
    anglesUsed.push(`DuckDuckGo fallback: "${query}"`);
  }

  return {
    results: deduplicateResults(allResults).slice(0, 15),
    tavilyAnswer,
    anglesUsed,
  };
}

// ── Gemini synthesis ──────────────────────────────────────────────────────────

async function synthesizeIntelligenceBrief(
  query: string,
  results: SearchResult[],
  tavilyAnswer: string | undefined,
  anglesUsed: string[],
): Promise<IntelligenceBrief> {
  const ai = createGeminiClient();

  const sourceDump = results
    .slice(0, 12)
    .map(
      (r, i) =>
        `[${i + 1}] TITLE: ${r.title}\n    URL: ${r.url}\n    SCORE: ${r.score?.toFixed(2) ?? 'N/A'}\n    CONTENT: ${r.content.slice(0, 500)}`,
    )
    .join('\n\n');

  const tavilyBlock = tavilyAnswer ? `\nTAVILY AI ANSWER: ${tavilyAnswer}\n` : '';

  const prompt = `You are a senior intelligence analyst. Your job is to synthesize raw search results into a structured intelligence brief.

QUERY: "${query}"
${tavilyBlock}
SEARCH ANGLES USED: ${anglesUsed.join(' | ')}

RAW SOURCES:
${sourceDump}

Produce a JSON intelligence brief with EXACTLY this structure (no markdown, raw JSON only):
{
  "executiveSummary": "<2-3 sentence synthesis of the most important findings — be specific, cite key facts>",
  "keyFindings": [
    {
      "finding": "<specific, evidence-backed finding>",
      "confidence": "<high|medium|low — high means 3+ sources, low means 1 source or speculative>",
      "supportingUrls": ["<url1>", "<url2>"]
    }
  ],
  "contradictions": ["<any conflicting information found across sources>"],
  "sourceQuality": "<excellent|good|mixed|poor — based on source diversity, recency, and credibility>",
  "researchGaps": ["<what this search could NOT answer and why>"],
  "sources": [
    { "title": "<title>", "url": "<url>", "relevanceScore": <0-10> }
  ]
}

Rules:
- keyFindings: 3-6 findings, most important first
- Each finding must be SPECIFIC (no vague generalities like "AI is growing")
- contradictions: flag genuinely contradictory info, not just different perspectives
- sources: include top 6 most relevant sources with honest relevance scores
- researchGaps: be honest about limits (e.g. "no primary sources found", "data is from 2022")
- If sources are thin or low-quality, say so in sourceQuality`;

  try {
    const response = await ai.models.generateContent({
      model: selectModel('research', 'high'),
      contents: prompt,
      config: { temperature: 0.2 },
    });

    const text = (response.text ?? '').replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(text) as Omit<IntelligenceBrief, 'query' | 'searchAnglesUsed'>;
    return { ...parsed, query, searchAnglesUsed: anglesUsed };
  } catch {
    // Graceful degradation — return a minimal brief if synthesis fails
    return {
      query,
      executiveSummary: tavilyAnswer ?? `Found ${results.length} sources for "${query}". Synthesis unavailable — see raw sources below.`,
      keyFindings: results.slice(0, 4).map((r) => ({
        finding: r.content.slice(0, 200),
        confidence: 'medium' as const,
        supportingUrls: [r.url],
      })),
      contradictions: [],
      sourceQuality: results.length >= 5 ? 'good' : 'mixed',
      researchGaps: ['Full synthesis failed — raw sources available in output.sources'],
      sources: results.slice(0, 6).map((r) => ({
        title: r.title,
        url: r.url,
        relevanceScore: Math.round((r.score ?? 0.5) * 10),
      })),
      searchAnglesUsed: anglesUsed,
    };
  }
}

function formatBriefAsMessage(brief: IntelligenceBrief): string {
  const confidenceIcon = (c: string) => c === 'high' ? '🟢' : c === 'medium' ? '🟡' : '🔴';
  const qualityIcon = (q: string) => ({ excellent: '⭐⭐⭐', good: '⭐⭐', mixed: '⭐', poor: '⚠️' })[q] ?? '⭐';

  const findings = brief.keyFindings
    .map((f) => `  ${confidenceIcon(f.confidence)} **${f.finding}**\n     Sources: ${f.supportingUrls.slice(0, 2).join(', ')}`)
    .join('\n\n');

  const contradictions = brief.contradictions.length
    ? `\n\n⚡ **Contradictions Found:**\n${brief.contradictions.map((c) => `  - ${c}`).join('\n')}`
    : '';

  const gaps = brief.researchGaps.length
    ? `\n\n🔍 **Research Gaps:**\n${brief.researchGaps.map((g) => `  - ${g}`).join('\n')}`
    : '';

  const sources = brief.sources.slice(0, 5)
    .map((s) => `  [${s.relevanceScore}/10] **${s.title}** — ${s.url}`)
    .join('\n');

  return `🧠 **Intelligence Brief** — "${brief.query}"

📋 **Executive Summary:**
${brief.executiveSummary}

🔑 **Key Findings** (Source quality: ${qualityIcon(brief.sourceQuality)} ${brief.sourceQuality}):
${findings}${contradictions}${gaps}

📚 **Top Sources:**
${sources}

🔎 *Search angles: ${brief.searchAnglesUsed.join(' | ')}*`;
}

// ── URL summarization (deep extract) ─────────────────────────────────────────

async function deepSummarizeUrl(url: string, focusQuery?: string): Promise<{
  summary: string;
  keyPoints: string[];
  relevantQuotes: string[];
  credibilitySignals: string[];
}> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; crewmate-ai-agent/2.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Failed to fetch URL (${response.status}): ${url}`);

  const html = await response.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 10_000);

  const ai = createGeminiClient();
  const focusLine = focusQuery ? `\nFocus on: "${focusQuery}"` : '';

  const result = await ai.models.generateContent({
    model: selectModel('research', 'high'),
    contents: `You are an expert content analyst. Deeply analyze this web page and extract maximum intelligence value.

URL: ${url}${focusLine}

PAGE CONTENT:
${text}

Respond with ONLY valid JSON (no markdown):
{
  "summary": "<comprehensive 3-4 paragraph summary capturing the full substance of the page>",
  "keyPoints": ["<specific, actionable or factual key point 1>", "<key point 2>", ...],
  "relevantQuotes": ["<exact verbatim quote from the text worth preserving 1>", ...],
  "credibilitySignals": ["<signals of source quality: publication date, author credentials, citations, etc.>"]
}

Rules:
- keyPoints: 4-7 specific, non-obvious points (not "the article discusses X")
- relevantQuotes: 1-3 exact word-for-word quotes that capture the essence
- credibilitySignals: note publication date, author, domain authority, citations found
- summary: dense, information-rich — no padding`,
    config: { temperature: 0.1 },
  });

  try {
    const parsed = JSON.parse(
      (result.text ?? '').replace(/```json\n?|\n?```/g, '').trim(),
    ) as { summary: string; keyPoints: string[]; relevantQuotes: string[]; credibilitySignals: string[] };
    return parsed;
  } catch {
    return {
      summary: result.text ?? 'Unable to summarize content.',
      keyPoints: [],
      relevantQuotes: [],
      credibilitySignals: [],
    };
  }
}

// ── Exported Skills ───────────────────────────────────────────────────────────

export const webSearchSkill: Skill = {
  id: 'web.search',
  name: 'Web Intelligence Search',
  description:
    'Multi-angle web intelligence search with AI synthesis. Fires 3 parallel search angles, ' +
    'deduplicates across sources, then synthesizes into a structured brief with key findings, ' +
    'confidence levels, contradictions, source quality ratings, and research gaps. ' +
    'Use for research, competitive analysis, news, market intelligence, technical lookups.',
  version: '3.0.0',
  category: 'research',
  requiresIntegration: [],
  triggerPhrases: [
    'Research and summarize X',
    'What do you know about Y?',
    'Find the latest information on Z',
    'Search the web for competitive analysis of X',
    'What are the key facts about Y?',
  ],
  preferredModel: 'research',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  usageExamples: [
    'Research and summarize the top AI tools this week',
    'Find the latest competitive analysis for Notion vs ClickUp',
    'What changed in the Gemini API recently?',
  ],
  invokingMessage: 'Running a multi-angle web intelligence search.',
  invokedMessage: 'Web intelligence brief ready.',
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The research question or topic. Be specific — the more precise, the better the synthesis.',
      },
      maxResults: {
        type: 'number',
        description: 'Max results per search angle (default: 6, max: 10)',
      },
      synthesize: {
        type: 'boolean',
        description: 'Set false to skip Gemini synthesis and return raw results only (default: true)',
      },
    },
    required: ['query'],
  },
  handler: async (_ctx, args) => {
    const query = String(args.query ?? '').trim();
    const maxPerAngle = Math.min(typeof args.maxResults === 'number' ? args.maxResults : 6, 10);
    const synthesize = args.synthesize !== false;

    if (!query) {
      return { success: false, message: 'Query is required.' };
    }

    const { results, tavilyAnswer, anglesUsed } = await runMultiAngleSearch(query, maxPerAngle);

    if (results.length === 0) {
      return {
        success: false,
        message: `No results found for "${query}". Try a different search query.`,
      };
    }

    if (!synthesize) {
      // Raw mode — return results without AI synthesis
      const formatted = results
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content.slice(0, 300)}`)
        .join('\n\n');
      return {
        success: true,
        output: { results, anglesUsed },
        message: `🔍 Raw search results for "${query}" (${results.length} sources):\n\n${formatted}`,
      };
    }

    const brief = await synthesizeIntelligenceBrief(query, results, tavilyAnswer, anglesUsed);

    return {
      success: true,
      output: { brief, rawResults: results },
      message: formatBriefAsMessage(brief),
    };
  },
};

export const webSummarizeUrlSkill: Skill = {
  id: 'web.summarize-url',
  name: 'Deep URL Intelligence',
  description:
    'Fetch any URL and extract deep intelligence: comprehensive summary, key points, exact quotes worth preserving, ' +
    'and credibility signals (author, date, citations). Far deeper than basic summarization. ' +
    'Use when the user shares a link they want fully understood.',
  version: '2.0.0',
  category: 'research',
  requiresIntegration: [],
  triggerPhrases: [
    'Read and summarize this link',
    'What does this article actually say?',
    'Extract the key insights from this URL',
    'Analyze this page for me',
    'What are the main points of this article?',
  ],
  preferredModel: 'research',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: false,
  usageExamples: [
    'Summarize this article for me',
    'Read this documentation page and extract the key points',
    'Analyze this link with a focus on pricing',
  ],
  invokingMessage: 'Reading the URL and extracting the most useful signal.',
  invokedMessage: 'Deep URL analysis ready.',
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
  liveFunctionBehavior: Behavior.NON_BLOCKING,
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch and deeply analyze',
      },
      focusQuery: {
        type: 'string',
        description: 'Optional: specific aspect or question to focus the analysis on (e.g. "pricing", "technical architecture")',
      },
    },
    required: ['url'],
  },
  handler: async (_ctx, args) => {
    const url = String(args.url ?? '').trim();
    const focusQuery = typeof args.focusQuery === 'string' ? args.focusQuery.trim() : undefined;

    if (!url.startsWith('http')) {
      return { success: false, message: 'Invalid URL — must start with http:// or https://' };
    }

    const analysis = await deepSummarizeUrl(url, focusQuery);

    const keyPointsBlock = analysis.keyPoints.length
      ? `\n\n🔑 **Key Points:**\n${analysis.keyPoints.map((p) => `  • ${p}`).join('\n')}`
      : '';

    const quotesBlock = analysis.relevantQuotes.length
      ? `\n\n💬 **Notable Quotes:**\n${analysis.relevantQuotes.map((q) => `  > "${q}"`).join('\n')}`
      : '';

    const credBlock = analysis.credibilitySignals.length
      ? `\n\n🏷️ **Source Signals:** ${analysis.credibilitySignals.join(' · ')}`
      : '';

    return {
      success: true,
      output: { url, ...analysis },
      message: `📄 **Deep Analysis** — ${url}\n\n${analysis.summary}${keyPointsBlock}${quotesBlock}${credBlock}`,
    };
  },
};
