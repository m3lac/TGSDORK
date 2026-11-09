import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig } from './config.js';
import { initCheckpoint, loadCheckpoint, getTaskDir } from './checkpoint.js';

console.log('Running Phase 1 self-checks...');

// 1. Config check
const cfg = loadConfig();
assert.ok(cfg.provider, 'Config provider must exist');
assert.ok(Array.isArray(cfg.gemini.apiKeys), 'Gemini apiKeys must be array');
assert.ok(Array.isArray(cfg.openai.apiKeys), 'OpenAI apiKeys must be array');

// 2. Checkpoint check
const testTask = initCheckpoint('Test Phase 1 Verification', 'makalah');
assert.strictEqual(testTask.topic, 'Test Phase 1 Verification');
assert.strictEqual(testTask.taskType, 'makalah');
assert.strictEqual(testTask.step, 'init');

const loaded = loadCheckpoint(testTask.id);
assert.ok(loaded, 'Loaded task must exist');
assert.strictEqual(loaded?.id, testTask.id);

// Clean up test task directory
const taskDir = getTaskDir(testTask.id);
fs.rmSync(taskDir, { recursive: true, force: true });
const cleaned = loadCheckpoint(testTask.id);
assert.strictEqual(cleaned, null, 'Cleaned task must be null');

console.log('Phase 1 self-checks PASSED!');
