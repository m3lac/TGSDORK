import fs from 'node:fs';
import path from 'node:path';
import { getTaskDir } from '../core/checkpoint.js';
import type { TaskState } from '../types/index.js';

export function exportToMarkdown(state: TaskState): string {
  const lines: string[] = [];

  lines.push(`# ${state.topic.toUpperCase()}`);
  lines.push(
    `\n*Jenis Dokumen: ${state.taskType.toUpperCase()} | Dihasilkan oleh TGSDORK pada ${new Date(
      state.updatedAt
    ).toLocaleDateString('id-ID')}*\n`
  );
  lines.push('---\n');

  for (const sec of state.sections) {
    const cleanSecTitle = sec.title.replace(/\s*\([^)]*\)/g, '').trim();
    lines.push(`## ${cleanSecTitle.toUpperCase()}\n`);

    // ponytail: buang duplikasi judul bab jika baris pertama isi sudah mengulang judul
    let body = sec.content.trim();
    const firstLine = body.split('\n')[0].replace(/^#+\s*/, '').trim().toLowerCase();
    const titleNorm = cleanSecTitle.toLowerCase();
    if (
      firstLine === titleNorm ||
      firstLine.replace(/[^a-z0-9]/g, '') === titleNorm.replace(/[^a-z0-9]/g, '')
    ) {
      body = body.split('\n').slice(1).join('\n').trim();
    }

    lines.push(`${body}\n\n`);
  }

  const outputContent = lines.join('\n');
  const taskDir = getTaskDir(state.id);
  const filePath = path.join(taskDir, 'output.md');

  fs.writeFileSync(filePath, outputContent, 'utf-8');
  return filePath;
}
