import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
}

export function StatCard({ title, value, trend }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        {trend && (
          <div className="flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            <ArrowUpRight size={12} className="mr-0.5" />
            {trend}
          </div>
        )}
      </div>
    </Card>
  );
}
