import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}

export function NavItem({ icon: Icon, label, active, badge, onClick }: NavItemProps): React.ReactNode {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
        active 
          ? 'bg-secondary text-foreground' 
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} className={active ? 'text-foreground' : 'text-muted-foreground'} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {badge && (
        <span className="bg-secondary text-foreground text-xs px-1.5 py-0.5 rounded-md font-mono border border-border">
          {badge}
        </span>
      )}
    </button>
  );
}
