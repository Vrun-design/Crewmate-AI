import React from 'react';
import type { AccountTab, AccountTabId } from './accountTypes';

type AccountSidebarProps = {
  activeTab: AccountTabId;
  tabs: AccountTab[];
  onSelect: (tabId: AccountTabId) => void;
};

export function AccountSidebar({ activeTab, tabs, onSelect }: AccountSidebarProps): React.JSX.Element {
  return (
    <div className="w-full md:w-64 shrink-0 space-y-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
          }`}
        >
          <tab.icon size={18} className={activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
