import React from 'react';
import {Database, FileText, User} from 'lucide-react';
import type {MemoryNode} from '../../types';

export type MemoryDrawerMode = 'add' | 'rename' | 'update' | 'remove';

export function getMemoryDrawerTitle(mode: MemoryDrawerMode): string {
  switch (mode) {
    case 'add':
      return 'Add New Context';
    case 'rename':
      return 'Rename Context';
    case 'remove':
      return 'Remove Context';
    default:
      return 'Update Context';
  }
}

export function getMemoryNodeIcon(nodeType: MemoryNode['type']): React.ReactNode {
  switch (nodeType) {
    case 'document':
      return <FileText size={20} />;
    case 'preference':
      return <User size={20} />;
    default:
      return <Database size={20} />;
  }
}
