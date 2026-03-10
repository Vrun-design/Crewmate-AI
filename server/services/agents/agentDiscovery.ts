export interface AgentCard {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    endpoints: Record<string, string>;
    version: string;
    protocol: string;
    healthUrl?: string;
    status: 'online' | 'offline' | 'unknown';
}

const discoveredAgents: Map<string, AgentCard> = new Map();

export async function discoverAgent(url: string): Promise<AgentCard> {
    try {
        const response = await fetch(`${url}/.well-known/agent.json`, {
            signal: AbortSignal.timeout(2000)
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch agent.json from ${url}`);
        }

        const card = (await response.json()) as AgentCard;
        card.status = 'online';
        card.healthUrl = url;
        discoveredAgents.set(card.id, card);

        return card;
    } catch (error) {
        console.error(`Discovery failed for ${url}:`, error);
        throw error;
    }
}

export function listDiscoveredAgents(): AgentCard[] {
    return [...discoveredAgents.values()];
}
