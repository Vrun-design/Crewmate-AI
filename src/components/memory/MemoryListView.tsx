import React, { useState } from 'react';
import { Mic, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { EmptyStateCard } from '../shared/EmptyStateCard';
import { LiveSessionOverlay } from '../ui/LiveSessionOverlay';
import { MemoryAddContextMenu } from './MemoryAddContextMenu';
import { MemoryDrawerContent } from './MemoryDrawerContent';
import { getMemoryDrawerTitle, type MemoryDrawerMode } from './memoryBaseUtils';
import { MemoryNodeListItem } from './MemoryNodeListItem';
import type { MemoryNode } from '../../types';

interface MemoryListViewProps {
  nodes: MemoryNode[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onRefresh: () => void;
}

export function MemoryListView({
  nodes,
  searchQuery,
  onSearchChange,
  onToggleActive,
  onRefresh
}: MemoryListViewProps): React.ReactNode {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<MemoryDrawerMode>('add');
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);

  function openDrawer(mode: MemoryDrawerMode, node: MemoryNode | null = null): void {
    setDrawerMode(mode);
    setSelectedNode(node);
    setIsDrawerOpen(true);
    setIsAddDropdownOpen(false);
    setOpenDropdownId(null);
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search memory nodes..."
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-ring text-foreground"
          />
        </div>

        <MemoryAddContextMenu
          isOpen={isAddDropdownOpen}
          onToggle={() => setIsAddDropdownOpen((current) => !current)}
          onAddContext={() => openDrawer('add')}
          onLiveSession={() => {
            setIsLiveSessionOpen(true);
            setIsAddDropdownOpen(false);
          }}
        />
      </div>

      {nodes.length > 0 ? (
        <div className="space-y-3">
          {nodes.map((node) => (
            <div key={node.id}>
              <MemoryNodeListItem
                node={node}
                isMenuOpen={openDropdownId === node.id}
                onToggleMenu={() => setOpenDropdownId((current) => (current === node.id ? null : node.id))}
                onRename={() => openDrawer('rename', node)}
                onUpdate={() => openDrawer('update', node)}
                onRemove={() => openDrawer('remove', node)}
                onToggleActive={() => onToggleActive(node.id, Boolean(node.active))}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyStateCard
            title={searchQuery ? "No results found" : "No memory stored yet"}
            description={searchQuery ? "Try adjusting your search terms." : "Live conversations, uploaded context, and saved artifacts will create the first memory nodes here."}
          />
        </div>
      )}

      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={getMemoryDrawerTitle(drawerMode)}>
        <MemoryDrawerContent mode={drawerMode} selectedNode={selectedNode} onClose={() => setIsDrawerOpen(false)} onRefresh={onRefresh} />
      </Drawer>

      <LiveSessionOverlay isOpen={isLiveSessionOpen} onClose={() => setIsLiveSessionOpen(false)} />
    </div>
  );
}
