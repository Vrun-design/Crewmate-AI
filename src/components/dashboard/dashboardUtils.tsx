import React from 'react';
import {CheckCircle2, Eye, FileText, Mail, Search, Terminal} from 'lucide-react';
import type {Activity} from '../../types';

export function getActivityIcon(type: Activity['type']): React.ReactNode {
  switch (type) {
    case 'research':
      return <Search size={14} className="text-blue-500" />;
    case 'observation':
      return <Eye size={14} className="text-purple-500" />;
    case 'note':
      return <FileText size={14} className="text-amber-500" />;
    case 'communication':
      return <Mail size={14} className="text-green-500" />;
    case 'action':
      return <CheckCircle2 size={14} className="text-indigo-500" />;
    default:
      return <Terminal size={14} className="text-muted-foreground" />;
  }
}

export function getSessionStatusLabel(
  isSessionActive: boolean,
  provider?: 'local' | 'gemini-live',
): string {
  if (!isSessionActive) {
    return 'Microphone off';
  }

  if (provider === 'gemini-live') {
    return 'Crewmate is connected to Gemini Live.';
  }

  return 'Crewmate is listening through the local session gateway...';
}

export function getSessionProviderLabel(provider?: 'local' | 'gemini-live'): string {
  return provider === 'gemini-live' ? 'Real Gemini Live session' : 'Gemini Live-ready local backend';
}
