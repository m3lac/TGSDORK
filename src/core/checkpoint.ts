import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { TaskState, TaskType } from '../types/index.js';

const WORKSPACE_ROOT = path.resolve(process.cwd(), 'workspace');

export function getWorkspaceRoot(): string {
  if (!fs.existsSync(WORKSPACE_ROOT)) {
    fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  }
  return WORKSPACE_ROOT;
}

export function getTaskDir(taskId: string): string {
  const dir = path.join(getWorkspaceRoot(), taskId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function initCheckpoint(topic: string, taskType: TaskType, owner?: string, font?: string): TaskState {
  // slugify topic for friendly folder ID
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)
    .replace(/^-+|-+$/g, '');
  const rand = crypto.randomBytes(3).toString('hex');
  const id = `${taskType}-${slug || 'task'}-${rand}`;

  const state: TaskState = {
    id,
    topic,
    taskType,
    owner,
    font: font || 'Times New Roman',
    step: 'init',
    dorkQueries: [],
    sources: [],
    outline: [],
    sections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveCheckpoint(state);
  return state;
}

export function saveCheckpoint(state: TaskState): void {
  const taskDir = getTaskDir(state.id);
  const file = path.join(taskDir, 'checkpoint.json');
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
}

export function loadCheckpoint(taskId: string): TaskState | null {
  const file = path.join(getTaskDir(taskId), 'checkpoint.json');
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw) as TaskState;
  } catch {
    return null;
  }
}

export function listCheckpoints(): TaskState[] {
  const root = getWorkspaceRoot();
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const tasks: TaskState[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const state = loadCheckpoint(entry.name);
      if (state) {
        tasks.push(state);
      }
    }
  }

  return tasks.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
