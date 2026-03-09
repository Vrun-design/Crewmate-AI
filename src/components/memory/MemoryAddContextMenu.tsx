import React from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {ChevronDown, Mic, UploadCloud} from 'lucide-react';
import {Button} from '../ui/Button';

interface MemoryAddContextMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddContext: () => void;
  onLiveSession: () => void;
}

export function MemoryAddContextMenu({
  isOpen,
  onToggle,
  onAddContext,
  onLiveSession,
}: MemoryAddContextMenuProps): React.ReactNode {
  return (
    <div className="relative">
      <Button variant="primary" onClick={onToggle} className="flex items-center gap-2">
        <UploadCloud size={16} /> Add Context{' '}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={onToggle}></div>
            <motion.div
              initial={{opacity: 0, y: 5, scale: 0.95}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: 5, scale: 0.95}}
              transition={{duration: 0.15}}
              className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
            >
              <div className="p-1.5">
                <button
                  onClick={onAddContext}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <UploadCloud size={16} />
                  </div>
                  <div>
                    <div className="font-medium">Upload Document/Link</div>
                    <div className="text-xs text-muted-foreground">Add files or URLs</div>
                  </div>
                </button>
                <button
                  onClick={onLiveSession}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent rounded-lg transition-colors text-left mt-1"
                >
                  <div className="w-8 h-8 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                    <Mic size={16} />
                  </div>
                  <div>
                    <div className="font-medium">Live Session</div>
                    <div className="text-xs text-muted-foreground">Talk to update context</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
