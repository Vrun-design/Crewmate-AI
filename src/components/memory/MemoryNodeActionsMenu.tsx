import React from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Edit2, MoreVertical, RefreshCw, Trash2} from 'lucide-react';

interface MemoryNodeActionsMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onRename: () => void;
  onUpdate: () => void;
  onRemove: () => void;
}

export function MemoryNodeActionsMenu({
  isOpen,
  onToggle,
  onRename,
  onUpdate,
  onRemove,
}: MemoryNodeActionsMenuProps): React.ReactNode {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
      >
        <MoreVertical size={18} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={onToggle}></div>
            <motion.div
              initial={{opacity: 0, y: 5, scale: 0.95}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: 5, scale: 0.95}}
              transition={{duration: 0.15}}
              className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
            >
              <div className="p-1.5">
                <button
                  onClick={onRename}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Edit2 size={14} className="text-muted-foreground" />
                  Rename
                </button>
                <button
                  onClick={onUpdate}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <RefreshCw size={14} className="text-muted-foreground" />
                  Update Context
                </button>
                <div className="h-px bg-border my-1.5 mx-1"></div>
                <button
                  onClick={onRemove}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  Remove Context
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
