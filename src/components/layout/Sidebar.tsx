import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Settings, MonitorUp, Activity, Wand2, Bot, Network,
  MoreHorizontal, Zap, X, BrainCircuit, Moon, Sun, LogOut, User, Bell, Cpu, UsersRound, FlaskConical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authService, authStorage } from '../../services/authService';
import type { AuthUser } from '../../types';

interface SidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  user: AuthUser | null;
}

interface NavItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  to: string;
  badge?: string;
  currentPath: string;
  onClick: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('');
}

export function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen, isDarkMode, setIsDarkMode, user }: SidebarProps) {
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div>
        <div className="h-14 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <div className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center">
              <Zap size={14} className="fill-current" />
            </div>
            Crewmate
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">MVP</span>
          </div>
          <button className="md:hidden text-muted-foreground" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="text-xs font-mono text-muted-foreground mb-3 px-2 uppercase tracking-wider">Operate</div>
          <nav className="space-y-1">
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/delegations" icon={Bot} label="Delegations" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/agents" icon={Network} label="Agent Network" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/studio" icon={Wand2} label="Creative Studio" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/notifications" icon={Bell} label="Notifications" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
          </nav>

          <div className="text-xs font-mono text-muted-foreground mb-3 mt-8 px-2 uppercase tracking-wider">Workspace</div>
          <nav className="space-y-1">
            <NavItem to="/memory" icon={BrainCircuit} label="Memory Base" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/personas" icon={UsersRound} label="Persona" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/sessions" icon={MonitorUp} label="Sessions" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/tasks" icon={CheckSquare} label="Tasks" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/activity" icon={Activity} label="Activity" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/skills" icon={Cpu} label="Skills Hub" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/skills/build" icon={FlaskConical} label="Skill Builder" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
          </nav>

          <div className="text-xs font-mono text-muted-foreground mb-3 mt-8 px-2 uppercase tracking-wider">Settings</div>
          <nav className="space-y-1">
            <NavItem to="/integrations" icon={CheckSquare} label="Integrations" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
            <NavItem to="/account" icon={User} label="Account" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} />
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-border relative" ref={profileMenuRef}>
        <AnimatePresence>
          {isProfileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-4 right-4 mb-2 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
            >
              <div className="p-3 border-b border-border">
                <div className="text-sm font-medium text-foreground">{user?.name ?? 'Crewmate User'}</div>
                <div className="text-xs text-muted-foreground">{user?.email ?? 'local@example.com'}</div>
              </div>
              <div className="p-1.5">
                <Link to="/account" onClick={() => setIsProfileMenuOpen(false)} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors">
                  <User size={16} className="text-muted-foreground" />
                  Profile Details
                </Link>
                <Link to="/account" onClick={() => setIsProfileMenuOpen(false)} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors">
                  <Settings size={16} className="text-muted-foreground" />
                  Account Settings
                </Link>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="w-full flex items-center justify-between px-2.5 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isDarkMode ? <Sun size={16} className="text-muted-foreground" /> : <Moon size={16} className="text-muted-foreground" />}
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </div>
                </button>
              </div>
              <div className="p-1.5 border-t border-border">
                <button
                  onClick={() => {
                    void authService.logout().finally(() => {
                      authStorage.clearSession();
                      window.location.href = '/login';
                    });
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isProfileMenuOpen}
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover-bg cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-medium text-white">
            {getInitials(user?.name ?? 'Crewmate User')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-foreground">{user?.name ?? 'Crewmate User'}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.plan ?? 'MVP'}</div>
          </div>
          <MoreHorizontal size={16} className="text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}

function NavItem({ icon: Icon, label, to, badge, currentPath, onClick }: NavItemProps) {
  const active = currentPath === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${active
        ? 'bg-secondary text-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} className={active ? 'text-foreground' : 'text-muted-foreground'} />
        <span className={`text-sm font-medium`}>{label}</span>
      </div>
      {badge && (
        <span className="bg-background border border-border text-foreground text-xs px-1.5 py-0.5 rounded-md font-mono">
          {badge}
        </span>
      )}
    </Link>
  );
}
