import fs from 'node:fs';
import path from 'node:path';
import { getTaskDir } from '../core/checkpoint.js';
import type { TaskState } from '../types/index.js';

export function exportToMarpSlide(state: TaskState): { mdPath: string; htmlPath: string } {
  const slides: string[] = [];

  // Frontmatter
  slides.push(`---
marp: true
theme: default
paginate: true
header: 'TGSDORK - ${state.topic.slice(0, 35)}'
footer: 'Sumber: ${state.sources.length} Dokumen Terverifikasi'
style: |
  section {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 24px;
    padding: 40px;
  }
  h1 { color: #1e3a8a; }
  h2 { color: #2563eb; }
---

<!-- _class: lead -->
# ${state.topic}
### Presentasi Akademik & Riset Literatur
**Disusun menggunakan TGSDORK AI Assistant**
`);

  for (const sec of state.sections) {
    // Break into concise bullet points if long
    const bulletText = sec.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))
      .slice(0, 6)
      .map((l) => (l.startsWith('-') ? l : `- ${l}`))
      .join('\n');

    slides.push(`---

## ${sec.title}

${bulletText || sec.content.slice(0, 500)}

<!--
Catatan Pemateri:
Fokuskan penyampaian pada bagian ${sec.title} dan referensi yang relevan.
-->
`);
  }

  const taskDir = getTaskDir(state.id);
  const mdPath = path.join(taskDir, 'slides.md');
  const marpContent = slides.join('\n');
  fs.writeFileSync(mdPath, marpContent, 'utf-8');

  // Also write lightweight standalone HTML preview
  const htmlPath = path.join(taskDir, 'slides.html');
  const standaloneHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${state.topic} - Slides</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
    .slide-card { background: #1e293b; border-radius: 12px; width: 100%; max-width: 800px; min-height: 450px; padding: 2.5rem; margin-bottom: 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155; }
    h1 { color: #60a5fa; margin-top: 0; }
    h2 { color: #93c5fd; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem; }
    p, li { line-height: 1.6; font-size: 1.1rem; color: #cbd5e1; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; background: #3b82f6; color: white; border-radius: 4px; font-size: 0.8rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="slide-card">
    <span class="badge">TITLE SLIDE</span>
    <h1>${state.topic}</h1>
    <p><em>Presentasi Akademik | Sumber: ${state.sources.length} Dokumen</em></p>
  </div>
  ${state.sections
    .map(
      (sec, i) => `
    <div class="slide-card">
      <span class="badge">SLIDE ${i + 2}</span>
      <h2>${sec.title}</h2>
      <div>${sec.content.replace(/\n/g, '<br>')}</div>
    </div>`
    )
    .join('')}
</body>
</html>`;

  fs.writeFileSync(htmlPath, standaloneHtml, 'utf-8');
  return { mdPath, htmlPath };
}
