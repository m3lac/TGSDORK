import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { initCheckpoint, loadCheckpoint, getTaskDir } from './core/checkpoint.js';
import { exportToMarkdown } from './exporter/markdown.js';
import { exportToDocx } from './exporter/docx-builder.js';
import { exportToMarpSlide } from './exporter/slide-builder.js';
import type { TaskState } from './types/index.js';

console.log('Running End-to-End Exporter & Pipeline self-checks...');

const state: TaskState = initCheckpoint(
  'Penerapan AI untuk Klasifikasi Citra Medis',
  'makalah'
);

// Populate mock extracted sources & sections to verify exporter
state.sources = [
  {
    id: 'src-1',
    title: 'Deteksi Citra Medis Berbasis Deep Learning',
    url: 'https://ejournal.undip.ac.id/sample.pdf',
    snippet: 'Penelitian mengenai CNN untuk diagnosis rontgen paru 2024.',
    content: 'Convolutional Neural Networks (CNN) menunjukkan akurasi 94% pada deteksi pneumonia...',
    citation: '(UNDIP, 2024)',
    fullRef: 'UNDIP. (2024). Deteksi Citra Medis Berbasis Deep Learning. Diperoleh dari https://ejournal.undip.ac.id/sample.pdf',
    fileType: 'pdf',
  },
];

state.outline = [
  'Pendahuluan dan Latar Belakang',
  'Tinjauan Pustaka & Pembahasan',
  'Kesimpulan',
];

state.sections = [
  {
    title: 'Pendahuluan dan Latar Belakang',
    content: 'Pemanfaatan kecerdasan buatan dalam bidang medis berkembang pesat (UNDIP, 2024). Latar belakang penelitian ini...',
  },
  {
    title: 'Tinjauan Pustaka & Pembahasan',
    content: 'Berdasarkan temuan terkini, akurasi klasifikasi meningkat signifikan dengan transfer learning (UNDIP, 2024).',
  },
  {
    title: 'Kesimpulan',
    content: 'AI terbukti efektif sebagai alat bantu dokter dalam mendeteksi anomali pada citra rontgen.',
  },
  {
    title: 'Daftar Pustaka',
    content: '1. UNDIP. (2024). Deteksi Citra Medis Berbasis Deep Learning. Diperoleh dari https://ejournal.undip.ac.id/sample.pdf',
  },
];

state.step = 'completed';

// 1. Export Markdown
const mdPath = exportToMarkdown(state);
assert.ok(fs.existsSync(mdPath), 'Markdown file must exist');
const mdContent = fs.readFileSync(mdPath, 'utf-8');
assert.ok(mdContent.includes('PENERAPAN AI UNTUK KLASIFIKASI CITRA MEDIS'));
assert.ok(mdContent.includes('Daftar Pustaka'));

// 2. Export Docx
const docxPath = await exportToDocx(state);
assert.ok(fs.existsSync(docxPath), 'Docx file must exist');
const docxStat = fs.statSync(docxPath);
assert.ok(docxStat.size > 1000, 'Docx file size must be > 1KB');

// 3. Export Slides
const slides = exportToMarpSlide(state);
assert.ok(fs.existsSync(slides.mdPath), 'Slides markdown must exist');
assert.ok(fs.existsSync(slides.htmlPath), 'Slides HTML must exist');
const htmlContent = fs.readFileSync(slides.htmlPath, 'utf-8');
assert.ok(htmlContent.includes('slide-card'));

// Clean up test folder
const taskDir = getTaskDir(state.id);
fs.rmSync(taskDir, { recursive: true, force: true });

console.log('End-to-End Exporter & Pipeline self-checks PASSED!');
