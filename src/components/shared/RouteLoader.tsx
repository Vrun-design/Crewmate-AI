import React from 'react';

export function RouteLoader(): React.ReactNode {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <div className="glass-panel rounded-2xl px-4 py-3 text-sm">Loading workspace...</div>
    </div>
  );
}
