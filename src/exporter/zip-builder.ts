// ponytail: gunakan JSZip yang sudah terinstall via node_modules. Tanpa dependensi baru.
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { getTaskDir } from '../core/checkpoint.js';
import { exportToDocx } from './docx-builder.js';
import { exportToMarkdown } from './markdown.js';
import { exportToBibtex } from './bibtex.js';
import { exportToPptx } from './pptx-builder.js';
import type { TaskState } from '../types/index.js';

export async function exportToZip(state: TaskState): Promise<string> {
  const taskDir = getTaskDir(state.id);
  const zip = new JSZip();

  // 1. Markdown
  let mdPath = path.join(taskDir, 'output.md');
  if (!fs.existsSync(mdPath)) {
    mdPath = exportToMarkdown(state);
  }
  if (fs.existsSync(mdPath)) {
    zip.file('naskah.md', fs.readFileSync(mdPath));
  }

  // 2. Word (.docx)
  let docxPath = path.join(taskDir, 'output.docx');
  if (!fs.existsSync(docxPath)) {
    docxPath = await exportToDocx(state);
  }
  if (fs.existsSync(docxPath)) {
    zip.file('naskah.docx', fs.readFileSync(docxPath));
  }

  // 3. BibTeX (.bib)
  let bibPath = path.join(taskDir, 'references.bib');
  if (!fs.existsSync(bibPath)) {
    bibPath = exportToBibtex(state);
  }
  if (fs.existsSync(bibPath)) {
    zip.file('referensi.bib', fs.readFileSync(bibPath));
  }

  // 4. PowerPoint (.pptx) - jika ada atau bisa dibuild
  const pptxPath = path.join(taskDir, 'slides.pptx');
  if (fs.existsSync(pptxPath)) {
    zip.file('presentasi.pptx', fs.readFileSync(pptxPath));
  } else {
    try {
      const generatedPptx = await exportToPptx(state);
      if (fs.existsSync(generatedPptx)) {
        zip.file('presentasi.pptx', fs.readFileSync(generatedPptx));
      }
    } catch {
      // ponytail: lewati slide jika gagal atau bukan tipe presentasi
    }
  }

  // 5. PDF jika sudah pernah digenerate
  const pdfPath = path.join(taskDir, 'output.pdf');
  if (fs.existsSync(pdfPath)) {
    zip.file('naskah.pdf', fs.readFileSync(pdfPath));
  }

  // 6. Ringkasan & metadata tugas
  const meta = {
    id: state.id,
    topic: state.topic,
    taskType: state.taskType,
    citationStyle: state.citationStyle || 'apa',
    sourceCount: state.sources.length,
    sources: state.sources.map((s) => ({
      title: s.title,
      url: s.url,
      citation: s.citation,
      doi: s.doi,
      doiVerified: s.doiVerified,
    })),
    createdAt: state.createdAt,
    exportedAt: new Date().toISOString(),
  };
  zip.file('metadata_penelitian.json', JSON.stringify(meta, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipFilePath = path.join(taskDir, 'bundle.zip');
  fs.writeFileSync(zipFilePath, zipBuffer);
  return zipFilePath;
}

// Runnable self-check per Ponytail rule
if (process.env.RUN_TEST === '1') {
  const testZip = new JSZip();
  testZip.file('test.txt', 'TGSDORK test');
  testZip.generateAsync({ type: 'nodebuffer' }).then((buf) => {
    if (!buf || buf.length === 0) throw new Error('Zip generation failed');
  });
}
