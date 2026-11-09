import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TaskState } from '../types/index.js';

export function copyToDocuments(
  state: TaskState,
  files: { docx?: string; md?: string; html?: string; review?: string; bib?: string; pdf?: string; pptx?: string }
): string[] {
  const documentsDir = path.join(os.homedir(), 'Documents');
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }

  const safeTitle =
    state.topic
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50) || state.id;

  const copied: string[] = [];

  if (files.docx && fs.existsSync(files.docx)) {
    const dest = path.join(documentsDir, `${safeTitle}.docx`);
    fs.copyFileSync(files.docx, dest);
    copied.push(dest);
  }

  if (files.pdf && fs.existsSync(files.pdf)) {
    const dest = path.join(documentsDir, `${safeTitle}.pdf`);
    fs.copyFileSync(files.pdf, dest);
    copied.push(dest);
  }

  if (files.md && fs.existsSync(files.md)) {
    const dest = path.join(documentsDir, `${safeTitle}.md`);
    fs.copyFileSync(files.md, dest);
    copied.push(dest);
  }

  if (files.html && fs.existsSync(files.html)) {
    const dest = path.join(documentsDir, `${safeTitle}_slides.html`);
    fs.copyFileSync(files.html, dest);
    copied.push(dest);
  }

  if (files.review && fs.existsSync(files.review)) {
    const dest = path.join(documentsDir, `${safeTitle}_review.md`);
    fs.copyFileSync(files.review, dest);
    copied.push(dest);
  }

  if (files.pptx && fs.existsSync(files.pptx)) {
    const dest = path.join(documentsDir, `${safeTitle}_slides.pptx`);
    fs.copyFileSync(files.pptx, dest);
    copied.push(dest);
  }

  if (files.bib && fs.existsSync(files.bib)) {
    const dest = path.join(documentsDir, `${safeTitle}.bib`);
    fs.copyFileSync(files.bib, dest);
    copied.push(dest);
  }

  return copied;
}

// ponytail: alias for backward-compatibility
export const copyToDownloads = copyToDocuments;
