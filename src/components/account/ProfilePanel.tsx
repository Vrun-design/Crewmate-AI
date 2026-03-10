import React from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import type { AccountUser } from './accountTypes';

type ProfilePanelProps = {
  initials: string;
  user: AccountUser;
  onLogout: () => void;
};

export function ProfilePanel({ initials, user, onLogout }: ProfilePanelProps): React.JSX.Element {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">My Profile</h2>
        <p className="text-sm text-muted-foreground mb-6">Manage your personal information and subscription.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-secondary border-4 border-background shadow-sm overflow-hidden flex items-center justify-center shrink-0 text-2xl font-semibold text-foreground">
              {initials}
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h3 className="text-xl font-semibold text-foreground">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="pt-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  {user.plan} Plan
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
              <Button variant="secondary" disabled>
                Avatar sync soon
              </Button>
              <Button
                variant="danger"
                className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-transparent"
                onClick={onLogout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <input
              type="text"
              value={user.name}
              readOnly
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email Address</label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground"
            />
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Profile editing is intentionally disabled in local MVP mode. Identity comes from the active auth session.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
