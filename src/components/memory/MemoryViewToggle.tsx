import React from 'react';

interface MemoryViewToggleProps {
  view: 'list' | 'map';
  onChange: (view: 'list' | 'map') => void;
}

export function MemoryViewToggle({view, onChange}: MemoryViewToggleProps): React.ReactNode {
  return (
    <div className="bg-secondary p-1 rounded-lg flex items-center border border-border">
      <button
        onClick={() => onChange('list')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
          view === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        List View
      </button>
      <button
        onClick={() => onChange('map')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
          view === 'map' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Mind Map
      </button>
    </div>
  );
}
