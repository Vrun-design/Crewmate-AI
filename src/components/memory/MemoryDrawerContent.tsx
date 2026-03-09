import React from 'react';
import {Clock, Link as LinkIcon, UploadCloud} from 'lucide-react';
import {Button} from '../ui/Button';
import {getMemoryNodeIcon, type MemoryDrawerMode} from './memoryBaseUtils';
import type {MemoryNode} from '../../types';

interface MemoryDrawerContentProps {
  mode: MemoryDrawerMode;
  selectedNode: MemoryNode | null;
  onClose: () => void;
}

export function MemoryDrawerContent({
  mode,
  selectedNode,
  onClose,
}: MemoryDrawerContentProps): React.ReactNode {
  if (mode === 'remove' && selectedNode) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <h4 className="text-sm font-medium text-red-500 mb-1">Warning: Irreversible Action</h4>
          <p className="text-xs text-red-500/80">
            Are you sure you want to remove <strong>{selectedNode.title}</strong> from the Memory Base? The
            agent will no longer have access to this context.
          </p>
        </div>
        <div className="pt-4 flex gap-3">
          <Button variant="danger" className="flex-1" onClick={onClose}>
            Yes, Remove Context
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'rename' && selectedNode) {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Context Name</label>
          <input
            type="text"
            defaultValue={selectedNode.title}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground"
          />
        </div>
        <div className="pt-4 flex gap-3">
          <Button variant="primary" className="flex-1" onClick={onClose}>
            Save Changes
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'add') {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Context Name</label>
          <input
            type="text"
            placeholder="e.g. Project Alpha Guidelines"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Source Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-secondary hover:border-ring transition-colors">
              <UploadCloud size={24} className="text-muted-foreground" />
              <span className="text-sm font-medium">Upload File</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-secondary hover:border-ring transition-colors">
              <LinkIcon size={24} className="text-muted-foreground" />
              <span className="text-sm font-medium">Add URL</span>
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Paste Content (Optional)</label>
          <textarea
            placeholder="Paste raw text here..."
            rows={6}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground resize-none"
          ></textarea>
        </div>
        <div className="pt-4 flex gap-3">
          <Button variant="primary" className="flex-1" onClick={onClose}>
            Add to Memory
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="p-3 bg-secondary/50 border border-border rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-muted-foreground">
          {getMemoryNodeIcon(selectedNode.type)}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{selectedNode.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Last synced: {selectedNode.lastSynced}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Append New Information</label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-secondary hover:border-ring transition-colors">
            <UploadCloud size={24} className="text-muted-foreground" />
            <span className="text-sm font-medium">Upload File</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-secondary hover:border-ring transition-colors">
            <LinkIcon size={24} className="text-muted-foreground" />
            <span className="text-sm font-medium">Add URL</span>
          </button>
        </div>
        <textarea
          placeholder="Or paste new content to append to this context..."
          rows={5}
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground resize-none"
        ></textarea>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Version History</label>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <span className="text-sm text-foreground">v1.2 (Current)</span>
            </div>
            <span className="text-xs text-muted-foreground">Just now</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-transparent hover:bg-secondary cursor-pointer transition-colors">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <span className="text-sm text-foreground">v1.1</span>
            </div>
            <span className="text-xs text-muted-foreground">2 days ago</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-transparent hover:bg-secondary cursor-pointer transition-colors">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <span className="text-sm text-foreground">v1.0</span>
            </div>
            <span className="text-xs text-muted-foreground">1 week ago</span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <Button variant="primary" className="flex-1" onClick={onClose}>
          Update Context
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
