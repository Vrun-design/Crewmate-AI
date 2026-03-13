/**
 * Demo Seed Script — inserts sample tasks, memories, and activities
 * so the dashboard looks alive on a fresh install.
 *
 * Usage:  npm run seed
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { db } from './db';

const DEMO_USER_ID = 'demo-user';
const DEMO_WORKSPACE_ID = 'demo-workspace';
const now = new Date().toISOString();

function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

// ── 1. Ensure demo user exists ────────────────────────────────────────────────
db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, plan, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run(DEMO_USER_ID, 'demo@crewmate.ai', 'Demo User', 'pro', now);

// ── 2. Ensure demo workspace exists ───────────────────────────────────────────
db.prepare(`
  INSERT OR IGNORE INTO workspaces (id, name, created_at)
  VALUES (?, ?, ?)
`).run(DEMO_WORKSPACE_ID, 'Crewmate Demo', now);

db.prepare(`
  INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (?, ?, ?, ?)
`).run(DEMO_WORKSPACE_ID, DEMO_USER_ID, 'owner', now);

// ── 3. Sample agent tasks ─────────────────────────────────────────────────────
const SAMPLE_TASKS = [
  {
    id: makeId('TASK'),
    title: 'Research competitor pricing for Q2 planning',
    description: 'Summarize top 3 competitor pricing tiers and key differentiators',
    status: 'completed',
    tool_name: 'Research Agent',
    priority: 'high',
    time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: makeId('TASK'),
    title: 'Draft Notion page: Sprint Retrospective',
    description: 'Create a structured retro doc from today\'s live session notes',
    status: 'completed',
    tool_name: 'Notion',
    priority: 'medium',
    time: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: makeId('TASK'),
    title: 'Screenshot current screen and attach to ClickUp ticket #CM-42',
    description: 'Capture the UI bug visible in the browser and attach it as evidence',
    status: 'completed',
    tool_name: 'browser.screenshot',
    priority: 'high',
    time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

const taskInsert = db.prepare(`
  INSERT OR IGNORE INTO tasks (id, title, description, status, time, tool_name, priority)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const task of SAMPLE_TASKS) {
  taskInsert.run(task.id, task.title, task.description, task.status, task.time, task.tool_name, task.priority);
}

// ── 4. Sample memory records ──────────────────────────────────────────────────
const SAMPLE_MEMORIES = [
  {
    id: `MEM-${randomUUID().slice(0, 8).toUpperCase()}`,
    kind: 'session',
    source_type: 'live_turn',
    title: 'User asked to track pricing research',
    summary: 'User requested competitive analysis for Q2 planning — assigned to Research Agent',
    tokens: '0.2k',
  },
  {
    id: `MEM-${randomUUID().slice(0, 8).toUpperCase()}`,
    kind: 'knowledge',
    source_type: 'agent_task',
    title: 'Competitor pricing: Acme $49/mo, Globex $79/mo, Initech $99/mo',
    summary: 'Crewmate identified 3 competitor pricing tiers during automated research',
    tokens: '0.8k',
  },
  {
    id: `MEM-${randomUUID().slice(0, 8).toUpperCase()}`,
    kind: 'artifact',
    source_type: 'skill_run',
    title: 'Sprint Retrospective — Week 11',
    summary: 'Notion page created with structured retro format',
    tokens: '1.2k',
  },
];

const memInsert = db.prepare(`
  INSERT OR IGNORE INTO memory_records
    (id, user_id, workspace_id, kind, source_type, title, summary, tokens, active, metadata_json, created_at, updated_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, 1, '{}', ?, ?)
`);

for (const mem of SAMPLE_MEMORIES) {
  memInsert.run(mem.id, DEMO_USER_ID, DEMO_WORKSPACE_ID, mem.kind, mem.source_type, mem.title, mem.summary, mem.tokens, now, now);
}

// ── 5. Sample activity log ────────────────────────────────────────────────────
const SAMPLE_ACTIVITIES = [
  { id: makeId('ACT'), title: 'Research completed', description: 'Competitor pricing analysis done in 38s.', type: 'observation' },
  { id: makeId('ACT'), title: 'Notion page created', description: 'Sprint Retrospective doc created and linked.', type: 'action' },
  { id: makeId('ACT'), title: 'Screenshot captured', description: 'Screen captured and attached to ClickUp #CM-42.', type: 'action' },
  { id: makeId('ACT'), title: 'Memory updated', description: 'Stored 3 new knowledge records from this session.', type: 'note' },
];

const actInsert = db.prepare(`
  INSERT OR IGNORE INTO activities (id, title, description, time, type)
  VALUES (?, ?, ?, ?, ?)
`);

for (const [idx, act] of SAMPLE_ACTIVITIES.entries()) {
  actInsert.run(act.id, act.title, act.description, new Date(Date.now() - idx * 15 * 60 * 1000).toISOString(), act.type);
}

console.log(`
✅  Demo data seeded successfully!

  Users:      1 (demo@crewmate.ai)
  Workspaces: 1 (Crewmate Demo)
  Tasks:      ${SAMPLE_TASKS.length}
  Memories:   ${SAMPLE_MEMORIES.length}
  Activities: ${SAMPLE_ACTIVITIES.length}

Start the app:  npm run dev
`);
