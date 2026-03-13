import React from 'react';

export function RouteLoader(): React.ReactNode {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background/70 text-muted-foreground backdrop-blur-[2px]">
      <div className="glass-panel rounded-full px-5 py-3 text-sm shadow-xl">Loading Crewmate...</div>
    </div>
  );
}
