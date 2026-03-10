import type { Express, Request, Response } from 'express';
import { getToolDeclarations, listTools } from './mcpServer';

export function registerMcpRoutes(app: Express) {
    app.get('/api/mcp/tools', (req: Request, res: Response) => {
        // Basic auth check inline; standard requireAuth pattern works similarly
        const authHeader = req.headers.authorization ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const declarations = getToolDeclarations();
        res.json(declarations);
    });

    app.get('/api/mcp/registry', (req: Request, res: Response) => {
        const authHeader = req.headers.authorization ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const tools = listTools().map((t) => ({
            name: t.name,
            description: t.description,
            schema: t.inputSchema,
        }));

        res.json(tools);
    });
}
