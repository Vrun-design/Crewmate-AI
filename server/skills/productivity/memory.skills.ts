/**
 * Memory Skills — store, retrieve, and list agent memory entries.
 * Backed by the memoryService which persists to SQLite with semantic embeddings.
 */
import type { Skill } from '../types';
import {
    ingestArtifactMemory,
    ingestKnowledgeMemory,
    retrieveRelevantMemories,
    searchMemoryRecords,
} from '../../services/memoryService';

export const memoryStoreSkill: Skill = {
    id: 'memory.store',
    name: 'Store Memory',
    description: 'Save a piece of information to long-term memory. Use when the user says "remember that", "save this", or asks you to keep track of something for later.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: [],
    triggerPhrases: [
        'Remember that',
        'Save this to memory',
        'Keep track of this',
        'Note that',
        'Store this for later',
    ],
    preferredModel: 'quick',
    executionMode: 'inline',
    latencyClass: 'quick',
    sideEffectLevel: 'none',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Short title or label for this memory' },
            content: { type: 'string', description: 'The information to remember' },
            type: { type: 'string', description: 'Memory type: "knowledge" or "artifact". Defaults to "knowledge".' },
        },
        required: ['title', 'content'],
    },
    handler: async (ctx, args) => {
        const title = String(args.title ?? '');
        const content = String(args.content ?? '');
        const type = String(args.type ?? 'knowledge');

        const id = type === 'artifact'
            ? ingestArtifactMemory({
                userId: ctx.userId,
                workspaceId: ctx.workspaceId,
                title,
                summary: content,
            })
            : ingestKnowledgeMemory({
                userId: ctx.userId,
                workspaceId: ctx.workspaceId,
                title,
                summary: content.slice(0, 280),
                contentText: content,
                sourceType: 'skill_run',
            });

        return {
            success: true,
            output: { id, title },
            message: `✅ Memory stored: "${title}" (ID: ${id})`,
        };
    },
};

export const memoryRetrieveSkill: Skill = {
    id: 'memory.retrieve',
    name: 'Retrieve Memory',
    description: 'Search long-term memory for relevant information. Use when you need context about past conversations, user preferences, or stored facts.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: [],
    triggerPhrases: [
        'What did I say about',
        'Do you remember',
        'Recall',
        'Search my memory for',
        'Find notes about',
    ],
    preferredModel: 'quick',
    executionMode: 'inline',
    latencyClass: 'quick',
    sideEffectLevel: 'none',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'What to search for in memory' },
            limit: { type: 'number', description: 'Maximum number of memories to return. Defaults to 5.' },
        },
        required: ['query'],
    },
    handler: async (ctx, args) => {
        const query = String(args.query ?? '');
        const limit = typeof args.limit === 'number' ? Math.min(args.limit, 20) : 5;

        const results = await retrieveRelevantMemories(ctx.userId, query, limit);

        return {
            success: true,
            output: results,
            message: results.length > 0
                ? `✅ Found ${results.length} relevant memory entries:\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
                : 'ℹ️ No relevant memories found.',
        };
    },
};

export const memoryListSkill: Skill = {
    id: 'memory.list',
    name: 'List All Memories',
    description: 'List all stored memory entries for the current user. Use when the user asks what you remember or wants to see all stored notes.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: [],
    triggerPhrases: [
        'What do you remember?',
        'Show me my memories',
        'List all notes',
        'What have I stored?',
    ],
    preferredModel: 'quick',
    executionMode: 'inline',
    latencyClass: 'quick',
    sideEffectLevel: 'none',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {},
    },
    handler: async (ctx) => {
        const memories = searchMemoryRecords(ctx.userId, { limit: 50 });
        const summary = memories.map((m) => `• [${m.kind}] "${m.title}"`)
            .slice(0, 30)
            .join('\n');

        return {
            success: true,
            output: memories,
            message: memories.length > 0
                ? `✅ ${memories.length} memory entries:\n${summary}${memories.length > 30 ? `\n… and ${memories.length - 30} more` : ''}`
                : 'ℹ️ No memories stored yet.',
        };
    },
};
