import React from 'react';
import {Calendar, CheckSquare, Play} from 'lucide-react';
import {Card} from '../ui/Card';
import type {Session} from '../../types';

interface SessionHistoryGridProps {
  sessions: Session[];
}

export function SessionHistoryGrid({sessions}: SessionHistoryGridProps): React.ReactNode {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sessions.map((session) => (
        <Card key={session.id} className="group hover:border-border transition-all cursor-pointer">
          <div className="h-32 bg-secondary relative flex items-center justify-center border-b border-border">
            <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1618401471353-b98a52333646?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-500"></div>
            <div className="w-10 h-10 rounded-full bg-background/50 border border-border flex items-center justify-center backdrop-blur-md z-10 group-hover:scale-110 transition-transform">
              <Play size={16} className="text-foreground ml-1" />
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/70 text-xs font-mono text-foreground backdrop-blur-md border border-border">
              {session.duration}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium truncate pr-4 text-foreground">{session.title}</h3>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
                {session.id}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} />
                {session.date}
              </div>
              <div className="flex items-center gap-1.5">
                <CheckSquare size={12} />
                {session.tasks} tasks generated
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
