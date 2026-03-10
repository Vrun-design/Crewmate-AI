import React from 'react';
import { Badge } from '../ui/Badge';
import { MemoryNodeActionsMenu } from './MemoryNodeActionsMenu';
import { getMemoryNodeIcon } from './memoryBaseUtils';
import type { MemoryNode } from '../../types';

interface MemoryNodeListItemProps {
  node: MemoryNode;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onRename: () => void;
  onUpdate: () => void;
  onRemove: () => void;
  onToggleActive: () => void;
}

export function MemoryNodeListItem({
  node,
  isMenuOpen,
  onToggleMenu,
  onRename,
  onUpdate,
  onRemove,
  onToggleActive,
}: MemoryNodeListItemProps): React.ReactNode {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl subtle-border hover-bg transition-colors">
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${node.active ? 'bg-blue-500/10 text-blue-500' : 'bg-secondary text-muted-foreground'
            }`}
        >
          {getMemoryNodeIcon(node.type)}
        </div>
        <div>
          <div className="font-medium text-foreground flex items-center gap-2">
            {node.title}
            {node.active && <Badge variant="info">Active</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
            <span>{node.tokens} tokens</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Synced {node.lastSynced}</span>
          </div>
        </div>
      </div>

      <MemoryNodeActionsMenu
        isOpen={isMenuOpen}
        isActive={Boolean(node.active)}
        onToggle={onToggleMenu}
        onRename={onRename}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onToggleActive={onToggleActive}
      />
    </div>
  );
}
