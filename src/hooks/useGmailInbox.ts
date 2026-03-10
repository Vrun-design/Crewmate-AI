import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface InboxEmail {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    isRead: boolean;
    labels: string[];
}

interface InboxResponse {
    messages: InboxEmail[];
    isConnected: boolean;
}

export function useGmailInbox(maxResults = 5) {
    const [messages, setMessages] = useState<InboxEmail[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.get<InboxResponse>(`/api/gmail/inbox?maxResults=${maxResults}`);
            setMessages(data.messages ?? []);
            setIsConnected(data.isConnected ?? false);
        } catch (err) {
            // Silently fail — Gmail might not be connected yet
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    }, [maxResults]);

    useEffect(() => {
        void fetch();
        // Refresh every 2 minutes
        const interval = setInterval(() => void fetch(), 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetch]);

    return { messages, isConnected, isLoading, error, refresh: fetch };
}
