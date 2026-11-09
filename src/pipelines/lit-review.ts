import { initCheckpoint } from '../core/checkpoint.js';
import { runTaskPipeline, type PipelineOptions } from './runner.js';
import type { TaskState } from '../types/index.js';

export async function runLitReviewPipeline(
  topic: string,
  options?: PipelineOptions
): Promise<TaskState> {
  const state = initCheckpoint(topic, 'lit-review');
  return await runTaskPipeline(state, {
    preset: 'id-academic',
    ...options,
  });
}
