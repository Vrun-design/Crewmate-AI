import React from 'react';
import { Card, CardContent } from '../ui/Card';

export function ShortcutsPanel(): React.JSX.Element {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Keyboard Shortcuts</h2>
        <p className="text-sm text-muted-foreground mb-6">Speed up your workflow with these quick actions.</p>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          <div className="p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Open command palette</div>
              <div className="text-xs text-muted-foreground mt-1">Jump to key product surfaces from anywhere in the app.</div>
            </div>
            <div className="flex gap-1.5">
              <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">⌘</kbd>
              <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">K</kbd>
            </div>
          </div>

          <div className="p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Close open overlays</div>
              <div className="text-xs text-muted-foreground mt-1">Dismiss the command palette and similar overlays when they are open.</div>
            </div>
            <div className="flex gap-1.5">
              <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">Esc</kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
