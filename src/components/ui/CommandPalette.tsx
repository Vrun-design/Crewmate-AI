import { useEffect, useState } from 'react';
import { Search, LayoutDashboard, MonitorUp, CheckSquare, X, BrainCircuit, PlugZap, User, Bell, Cpu, Bot, Workflow } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandLink {
  path: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
}

const BASE_LINKS: CommandLink[] = [
  { path: '/dashboard', label: 'Dashboard', desc: 'Go to main dashboard', icon: LayoutDashboard, color: 'text-primary', bg: 'bg-primary/10' },
  { path: '/tasks', label: 'Tasks', desc: 'View all tasks', icon: CheckSquare, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { path: '/sessions', label: 'Sessions', desc: 'Review past sessions', icon: MonitorUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { path: '/off-shift', label: 'Off-Shift', desc: 'Queue async work for background execution', icon: Bot, color: 'text-lime-500', bg: 'bg-lime-500/10' },
  { path: '/memory', label: 'Memory Base', desc: 'Manage agent context', icon: BrainCircuit, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { path: '/skills', label: 'Capabilities', desc: 'Inspect live agent capabilities', icon: Cpu, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { path: '/integrations', label: 'Integrations', desc: 'Connect your tools', icon: PlugZap, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { path: '/account', label: 'Account & Settings', desc: 'Manage profile and preferences', icon: User, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { path: '/notifications', label: 'Notifications', desc: 'View all alerts', icon: Bell, color: 'text-rose-500', bg: 'bg-rose-500/10' },
];

const OFFSHIFT_INBOX_LINK: CommandLink = {
  path: '/offshift',
  label: 'Off-Shift Inbox',
  desc: 'Track async work from origin to delivery',
  icon: Workflow,
  color: 'text-fuchsia-500',
  bg: 'bg-fuchsia-500/10',
};

function filterLinks(links: CommandLink[], query: string): CommandLink[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return links;
  }

  return links.filter((link) => (
    link.label.toLowerCase().includes(normalizedQuery) ||
    link.desc.toLowerCase().includes(normalizedQuery)
  ));
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { flags } = useFeatureFlags();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQuery('');
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const links = flags.offshiftInbox
    ? [...BASE_LINKS.slice(0, 4), OFFSHIFT_INBOX_LINK, ...BASE_LINKS.slice(4)]
    : BASE_LINKS;
  const filteredLinks = filterLinks(links, query);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-background border border-border shadow-2xl rounded-2xl z-[100] overflow-hidden flex flex-col"
          >
            <div className="flex items-center px-4 border-b border-border">
              <Search size={20} className="text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Search tasks, sessions, memory..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-none px-4 py-4 text-foreground focus:outline-none placeholder:text-muted-foreground"
              />
              <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {filteredLinks.length > 0 ? 'Quick Links' : 'No results found'}
              </div>
              {filteredLinks.map((link) => (
                <button
                  type="button"
                  key={link.path}
                  onClick={() => { navigate(link.path); onClose(); }}
                  className="flex w-full items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors text-left"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${link.bg} ${link.color}`}>
                    <link.icon size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{link.label}</div>
                    <div className="text-xs text-muted-foreground">{link.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-border bg-secondary/30 text-xs text-muted-foreground flex items-center justify-between">
              <div>Search powered by Crewmate</div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-background border border-border">esc</span> to close
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
