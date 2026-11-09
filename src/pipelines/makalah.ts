import { initCheckpoint } from '../core/checkpoint.js';
import { runTaskPipeline, type PipelineOptions } from './runner.js';
import type { TaskState } from '../types/index.js';

export async function runMakalahPipeline(
  topic: string,
  options?: PipelineOptions
): Promise<TaskState> {
  const state = initCheckpoint(topic, 'makalah');
  return await runTaskPipeline(state, {
    preset: 'id-academic',
    ...options,
  });
}
