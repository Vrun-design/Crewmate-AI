/**
 * Real MCP Protocol Server — Phase 4
 *
 * This implements the Model Context Protocol (MCP) so any compatible client
 * can connect to Crewmate and use the registered skills.
 *
 * Transport: HTTP+SSE Streamable HTTP (MCP spec 2024-11-05)
 *
 * Example MCP client config:
 * {
 *   "mcpServers": {
 *     "crewmate": {
 *       "url": "http://localhost:8787/mcp"
 *     }
 *   }
 * }
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Express, Request, Response } from 'express';
import { listSkills, runSkill } from '../skills/registry';
import type { SkillRunContext } from '../skills/types';

/**
 * Attach MCP server routes to the Express app.
 * Handles POST /mcp (run requests) and GET /mcp (discovery).
 */
export function attachMcpServer(app: Express): void {
    const mcpServer = new McpServer({
        name: 'Crewmate',
        version: '2.0.0',
    });

    // Register all skills as MCP tools
    const allSkills = listSkills();

    for (const skill of allSkills) {
        // Create a local closure to capture current skill
        const currentSkill = skill;
        mcpServer.tool(
            // MCP tool name — replace dots with underscores (MCP convention)
            currentSkill.id.replace(/\./g, '_'),
            currentSkill.description,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentSkill.inputSchema as unknown as any,
            async (args) => {
                const ctx: SkillRunContext = {
                    userId: 'external-mcp-client',
                    workspaceId: 'default',
                };

                try {
                    const runRecord = await runSkill(currentSkill.id, ctx, args as Record<string, unknown>);
                    const output = runRecord.result;
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: typeof output === 'string'
                                    ? output
                                    : (output as { message?: string })?.message ?? JSON.stringify(output, null, 2),
                            },
                        ],
                    };
                } catch (err) {
                    return {
                        content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
                        isError: true,
                    };
                }
            }
        );
    }

    console.log(`[MCP] Registered ${allSkills.length} skills as MCP tools`);

    // ── POST /mcp — main request handler ─────────────────────────────────────
    app.post('/mcp', async (req: Request, res: Response) => {
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined, // stateless
            });
            await mcpServer.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            if (!res.headersSent) {
                res.status(500).json({ error: 'MCP request failed', details: String(err) });
            }
        }
    });

    // ── DELETE /mcp — session teardown (stateless: just acknowledge) ─────────
    app.delete('/mcp', (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
    });

    // ── GET /mcp — server info and tool discovery ─────────────────────────────
    app.get('/mcp', (_req: Request, res: Response) => {
        res.json({
            name: 'Crewmate MCP Server',
            version: '2.0.0',
            protocolVersion: '2024-11-05',
            toolCount: allSkills.length,
            tools: allSkills.map((s) => ({
                id: s.id,
                mcpName: s.id.replace(/\./g, '_'),
                name: s.name,
                description: s.description,
                category: s.category,
                personas: s.personas,
                requiresIntegration: s.requiresIntegration,
            })),
            exampleClientConfig: {
                mcpServers: {
                    crewmate: {
                        url: 'http://localhost:8787/mcp',
                    },
                },
            },
        });
    });
}
