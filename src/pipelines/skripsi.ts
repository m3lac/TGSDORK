import { initCheckpoint } from '../core/checkpoint.js';
import { runTaskPipeline, type PipelineOptions } from './runner.js';
import type { TaskState } from '../types/index.js';

export async function runSkripsiPipeline(
  topic: string,
  options?: PipelineOptions
): Promise<TaskState> {
  const state = initCheckpoint(topic, 'skripsi');
  return await runTaskPipeline(state, {
    preset: 'id-academic',
    ...options,
  });
}
