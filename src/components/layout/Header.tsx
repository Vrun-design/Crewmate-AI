import React, { useState, useRef, useEffect } from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import { Search, Bell, ChevronRight, Menu, CheckCircle2, AlertCircle, Clock, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommandPalette } from '../ui/CommandPalette';
import {useNotifications} from '../../hooks/useNotifications';

interface HeaderProps {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

export function Header({ isDarkMode, setIsDarkMode, setIsMobileMenuOpen }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathName = location.pathname.split('/')[1] || 'dashboard';
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const {notifications, markAllRead} = useNotifications();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  function getIcon(type: 'success' | 'info' | 'warning' | 'default') {
    if (type === 'success') {
      return <CheckCircle2 size={16} />;
    }

    return <AlertCircle size={16} />;
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card/80 backdrop-blur-md z-20">
      <div className="flex items-center gap-3">
        <button className="md:hidden text-muted-foreground" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-foreground font-medium capitalize">{pathName.replace('-', ' ')}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3 md:gap-4">
        <div className="relative hidden md:block">
          <button 
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center justify-between w-48 lg:w-64 bg-secondary border border-border rounded-full pl-3 pr-2 py-1.5 text-sm text-muted-foreground hover:border-ring hover:text-foreground transition-all"
          >
            <div className="flex items-center gap-2">
              <Search size={14} />
              <span>Search...</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-medium opacity-60">
              <Command size={10} />
              <span>K</span>
            </div>
          </button>
        </div>

        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`text-muted-foreground hover:text-foreground transition-colors relative p-1.5 rounded-full hover:bg-accent ${isNotificationsOpen ? 'bg-accent text-foreground' : ''}`}
          >
            <Bell size={18} />
            {unreadCount > 0 ? <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border border-background"></span> : null}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
              >
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">Notifications</h3>
                  <button className="text-xs text-blue-500 hover:text-blue-600 font-medium" onClick={() => void markAllRead()}>
                    Mark all as read
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-border hover:bg-accent/50 transition-colors cursor-pointer flex gap-3 ${notification.read ? 'opacity-60' : ''}`}
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        navigate(notification.sourcePath ?? '/notifications');
                      }}
                    >
                      <div className="mt-0.5 shrink-0 text-blue-500">{getIcon(notification.type)}</div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{notification.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{notification.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock size={10} /> {notification.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-border bg-secondary/50 text-center">
                  <button onClick={() => { setIsNotificationsOpen(false); navigate('/notifications'); }} className="text-xs text-muted-foreground hover:text-foreground font-medium">View all notifications</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
      />
    </header>
  );
}
