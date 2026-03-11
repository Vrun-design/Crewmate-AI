import type { Behavior, FunctionDeclaration } from '@google/genai';

export interface McpToolContext {
    userId: string;
    workspaceId: string;
    frameData: { mimeType: string; data: string } | null;
}

export interface McpTool {
    name: string;
    description: string;
    inputSchema: object;
    exposeInLiveSession?: boolean;
    behavior?: Behavior;
    handler: (context: McpToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

const registry = new Map<string, McpTool>();

export function registerTool(tool: McpTool): void {
    registry.set(tool.name, tool);
}

export function listTools(): McpTool[] {
    return [...registry.values()];
}

export function getToolDeclarations(options?: { liveOnly?: boolean }): FunctionDeclaration[] {
    return listTools()
        .filter((tool) => !options?.liveOnly || tool.exposeInLiveSession)
        .map((t) => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.inputSchema as unknown as FunctionDeclaration['parametersJsonSchema'],
        behavior: t.behavior,
    }));
}

export async function callTool(name: string, context: McpToolContext, args: Record<string, unknown>): Promise<unknown> {
    const tool = registry.get(name);
    if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
    }
    return tool.handler(context, args);
}
