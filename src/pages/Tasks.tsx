import React, {useState} from 'react';
import {Plus} from 'lucide-react';
import {TaskDrawerContent} from '../components/tasks/TaskDrawerContent';
import {TaskList} from '../components/tasks/TaskList';
import {EmptyStateCard} from '../components/shared/EmptyStateCard';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {Drawer} from '../components/ui/Drawer';
import {PageHeader} from '../components/ui/PageHeader';
import {useWorkspaceCollection} from '../hooks/useWorkspaceCollection';
import {workspaceService} from '../services/workspaceService';
import type {Task} from '../types';

export function Tasks() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const {data: tasks, isLoading, error} = useWorkspaceCollection(workspaceService.getTasks);

  function handleOpenTask(task: Task): void {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  }

  function handleCreateTask(): void {
    setSelectedTask(null);
    setIsDrawerOpen(true);
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <PageHeader 
        title="Task Queue" 
        description="Background tasks executed by your AI agent."
      >
        <Button variant="primary" onClick={handleCreateTask}>
          <Plus size={16} />
          New Task
        </Button>
      </PageHeader>

      <Card className="flex-1">
        {isLoading || error ? (
          <div className="p-4 text-sm text-muted-foreground">
            {isLoading ? 'Loading real tasks...' : `Task API status: ${error}`}
          </div>
        ) : tasks.length > 0 ? (
          <TaskList tasks={tasks} onOpenTask={handleOpenTask} />
        ) : (
          <EmptyStateCard
            title="No tasks yet"
            description="Once Crewmate creates work in GitHub, ClickUp, Slack, or Notion, it will appear here."
          />
        )}
      </Card>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedTask ? "Task Details" : "Create New Task"}
      >
        <TaskDrawerContent task={selectedTask} onClose={() => setIsDrawerOpen(false)} />
      </Drawer>
    </div>
  );
}
