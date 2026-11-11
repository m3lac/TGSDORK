#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, saveConfig, getConfigPath } from './core/config.js';
import { listCheckpoints, loadCheckpoint, initCheckpoint, getTaskDir } from './core/checkpoint.js';
import { runTaskPipeline } from './pipelines/runner.js';
import { exportToMarkdown } from './exporter/markdown.js';
import { exportToDocx } from './exporter/docx-builder.js';
import { exportToMarpSlide } from './exporter/slide-builder.js';
import { exportToPptx } from './exporter/pptx-builder.js';
import { exportToBibtex } from './exporter/bibtex.js';
import { copyToDocuments } from './core/downloads.js';
import { reviewTask, reviewFile, reviseTask, autoReviseTask, readTextFromFile } from './pipelines/reviewer.js';
import { scanTurnitinWithGemini } from './pipelines/turnitin.js';
import { startServer } from './server/app.js';
import { startChat } from './chat.js';
import { logger } from './core/logger.js';
import type { TaskType } from './types/index.js';

const program = new Command();

program
  .name('tgsdork')
  .description('Tugas & Academic Google Dorking AI Assistant')
  .version('1.0.0');

// Interactive Wizard
async function runInteractiveWizard() {
  p.intro(pc.bgCyan(pc.black(' TGSDORK — Asisten Otomasi Tugas Akademik ')));

  const topic = await p.text({
    message: 'Masukkan topik tugas atau judul penelitian:',
    placeholder: 'Contoh: Analisis Sentimen Pilkada Menggunakan Algoritma BERT',
    validate: (val) => {
      if (!val || val.trim().length < 3) return 'Topik minimal 3 karakter.';
    },
  });

  if (p.isCancel(topic)) {
    p.cancel('Dibatalkan.');
    process.exit(0);
  }

  const taskType = await p.select({
    message: 'Pilih jenis tugas:',
    options: [
      { value: 'makalah', label: 'Makalah Akademik (Latar Belakang, Teori, Pembahasan, Penutup)' },
      { value: 'skripsi', label: 'Skripsi (Bab 1-3 Komplit + Metodologi)' },
      { value: 'presentasi', label: 'Slide Presentasi (Marp MD + Standalone HTML)' },
      { value: 'lit-review', label: 'Literature Review (Matriks Jurnal & Research Gap)' },
    ],
  });

  if (p.isCancel(taskType)) {
    p.cancel('Dibatalkan.');
    process.exit(0);
  }

  const preset = await p.select({
    message: 'Pilih target preset Google Dorking:',
    options: [
      { value: 'id-academic', label: 'Jurnal & Repositori Kampus Indonesia (ac.id / Garuda / Neliti)' },
      { value: 'global-scholar', label: 'Global Papers (.edu / arXiv / ResearchGate)' },
      { value: 'gov-data', label: 'Data & Regulasi Resmi Pemerintah (go.id / BPS)' },
    ],
  });

  if (p.isCancel(preset)) {
    p.cancel('Dibatalkan.');
    process.exit(0);
  }

  const s = p.spinner();
  s.start('Menginisialisasi tugas di workspace...');

  const state = initCheckpoint(topic, taskType as TaskType);
  s.stop(`Tugas dibuat dengan ID: ${pc.bold(state.id)}`);

  await runTaskWithExports(state, preset as string);
  p.outro(pc.green('Semua file berhasil diekspor ke folder workspace/!'));
}

async function runTaskWithExports(state: any, preset: string) {
  const finalState = await runTaskPipeline(state, {
    preset,
    onProgress: (step, detail) => {
      // logger handles progress display
    },
  });

  logger.step('EXPORT', 'Mengekspor file output...');
  const mdFile = exportToMarkdown(finalState);
  logger.success(`Markdown tersimpan di: ${mdFile}`);

  let docxFile = '';
  try {
    docxFile = await exportToDocx(finalState);
    logger.success(`Word DOCX tersimpan di: ${docxFile}`);
  } catch (err) {
    logger.warn(`Gagal membuat file Word: ${String(err)}`);
  }

  const slides = exportToMarpSlide(finalState);
  logger.success(`Slides tersimpan di: ${slides.mdPath} & ${slides.htmlPath}`);

  const bibFile = exportToBibtex(finalState);
  logger.success(`BibTeX tersimpan di: ${bibFile}`);

  let pptxFile = '';
  try {
    pptxFile = await exportToPptx(finalState);
    logger.success(`PowerPoint tersimpan di: ${pptxFile}`);
  } catch (err) {
    logger.warn(`Gagal membuat file PPTX: ${String(err)}`);
  }

  // Copy to ~/Documents
  const downloaded = copyToDocuments(finalState, {
    docx: docxFile,
    md: mdFile,
    html: slides.htmlPath,
    pptx: pptxFile,
    bib: bibFile,
  });
  if (downloaded.length > 0) {
    logger.success(`File otomatis disalin ke ~/Documents:`);
    for (const f of downloaded) {
      logger.dim(`  -> ${f}`);
    }
  }
}

// CLI Command: new
program
  .command('new [topic]')
  .description('Buat tugas baru secara interaktif atau langsung')
  .option('-t, --type <type>', 'Jenis tugas: makalah | skripsi | presentasi | lit-review', 'makalah')
  .option('-p, --preset <preset>', 'Preset dork: id-academic | global-scholar | gov-data', 'id-academic')
  .action(async (topic, opts) => {
    if (!topic) {
      await runInteractiveWizard();
      return;
    }

    const state = initCheckpoint(topic, opts.type as TaskType);
    logger.info(`Membuat tugas: "${topic}" (ID: ${state.id})`);
    await runTaskWithExports(state, opts.preset);
    logger.success(`Tugas selesai! Cek folder: workspace/${state.id}`);
  });

// CLI Command: resume
program
  .command('resume <taskId>')
  .description('Lanjutkan tugas yang belum selesai dari checkpoint')
  .option('-p, --preset <preset>', 'Preset dork', 'id-academic')
  .action(async (taskId, opts) => {
    const state = loadCheckpoint(taskId);
    if (!state) {
      logger.error(`Checkpoint tugas "${taskId}" tidak ditemukan di workspace.`);
      return;
    }

    logger.info(`Melanjutkan tugas: "${state.topic}" (Step saat ini: ${state.step})`);
    await runTaskWithExports(state, opts.preset);
    logger.success(`Tugas ${taskId} berhasil diselesaikan!`);
  });

// CLI Command: export
program
  .command('export <taskId>')
  .description('Ekspor ulang tugas dari checkpoint yang ada ke .md, .docx, dan slides')
  .action(async (taskId) => {
    const state = loadCheckpoint(taskId);
    if (!state) {
      logger.error(`Tugas "${taskId}" tidak ditemukan.`);
      return;
    }

    const md = exportToMarkdown(state);
    const docx = await exportToDocx(state);
    const slides = exportToMarpSlide(state);
    const bib = exportToBibtex(state);
    const pptx = await exportToPptx(state, true);

    const downloaded = copyToDocuments(state, {
      docx,
      md,
      html: slides.htmlPath,
      bib,
      pptx,
    });

    logger.success(`Markdown: ${md}`);
    logger.success(`DOCX: ${docx}`);
    logger.success(`Slides: ${slides.mdPath} | ${slides.htmlPath}`);
    logger.success(`BibTeX: ${bib}`);
    if (downloaded.length > 0) {
      logger.success(`File berhasil disalin ke ~/Documents:`);
      for (const f of downloaded) {
        logger.dim(`  -> ${f}`);
      }
    }
  });

// CLI Command: review
program
  .command('review <target>')
  .description('Review akademik tugas di workspace atau file eksternal (.pdf/.md/.txt)')
  .option('-f, --focus <focus>', 'Fokus evaluasi (misal: metodologi, EYD, sitasi)', 'keseluruhan')
  .action(async (target, opts) => {
    try {
      const isFile = target.includes('/') || target.includes('.');
      if (isFile) {
        const result = await reviewFile(target);
        console.log('\n' + result + '\n');
      } else {
        const result = await reviewTask(target, opts.focus);
        console.log('\n' + result + '\n');
        logger.success(`Hasil review tersimpan di workspace/${target}/review.md dan ~/Documents`);
      }
    } catch (err) {
      logger.error(`Review gagal: ${String(err)}`);
    }
  });

// CLI Command: revise
program
  .command('revise <taskId> <instruction>')
  .description('Revisi tugas di workspace berdasarkan instruksi Anda')
  .option('-s, --section <title>', 'Revisi hanya bagian tertentu (misal: "Bab 2" atau "Pendahuluan")')
  .action(async (taskId, instruction, opts) => {
    try {
      await reviseTask(taskId, instruction, opts.section);
    } catch (err) {
      logger.error(`Revisi gagal: ${String(err)}`);
    }
  });

// CLI Command: autorevise
program
  .command('autorevise <taskId>')
  .description('Otomatis revisi tugas menggunakan hasil audit/peer-review akademik')
  .action(async (taskId) => {
    try {
      await autoReviseTask(taskId);
    } catch (err) {
      logger.error(`Auto-revise gagal: ${String(err)}`);
    }
  });

// CLI Command: turnitin
program
  .command('turnitin <target>')
  .description('Uji kemiripan naskah ala Turnitin (korpus mahasiswa, repositori, dan jurnal)')
  .option('--no-bib', 'Jangan kecualikan daftar pustaka (default mengecualikan daftar pustaka)')
  .option('-q, --quotes', 'Kecualikan teks dalam tanda petik')
  .action(async (target, opts) => {
    try {
      const isFile = target.includes('/') || target.includes('.');
      let text = '';
      let title = target;
      if (isFile) {
        text = await readTextFromFile(target);
      } else {
        const state = loadCheckpoint(target);
        if (!state) {
          logger.error(`Tugas "${target}" tidak ditemukan.`);
          return;
        }
        title = state.topic;
        const mdOut = path.join(getTaskDir(state.id), 'output.md');
        if (fs.existsSync(mdOut)) {
          text = fs.readFileSync(mdOut, 'utf-8');
        } else {
          text = state.sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
        }
      }

      logger.info(`Memindai kemiripan Turnitin untuk "${title}"...`);
      const scan = await scanTurnitinWithGemini(title, text, {
        excludeBibliography: opts.bib !== false,
        excludeQuotes: Boolean(opts.quotes),
      });

      console.log('\n' + scan.report + '\n');
    } catch (err) {
      logger.error(`Pemeriksaan kemiripan gagal: ${String(err)}`);
    }
  });

// CLI Command: tasks
program
  .command('tasks')
  .description('Lihat daftar tugas di workspace')
  .action(() => {
    const tasks = listCheckpoints();
    if (tasks.length === 0) {
      logger.info('Belum ada tugas di workspace.');
      return;
    }

    logger.step('TASKS', `Ditemukan ${tasks.length} tugas di workspace:`);
    for (const t of tasks) {
      const stepColor = t.step === 'completed' ? pc.green : pc.yellow;
      console.log(
        `  ${pc.bold(t.id)} | ${pc.cyan(t.taskType)} | ${stepColor(t.step)} | ${t.topic}`
      );
    }
  });

// CLI Command: config
program
  .command('config')
  .description('Tampilkan atau ubah konfigurasi tgsdork')
  .option('-p, --provider <provider>', 'Set AI provider (gemini | openai-compatible)')
  .option('--gemini-key <key>', 'Tambah/set Gemini API Key')
  .option('--openai-key <key>', 'Tambah/set OpenAI API Key')
  .option('--openai-base <url>', 'Set OpenAI Base URL')
  .action((opts) => {
    const cfg = loadConfig();
    let updated = false;

    if (opts.provider) {
      if (opts.provider === 'gemini' || opts.provider === 'openai-compatible') {
        cfg.provider = opts.provider;
        updated = true;
      } else {
        logger.error('Provider harus "gemini" atau "openai-compatible"');
        return;
      }
    }

    if (opts.geminiKey) {
      if (!cfg.gemini.apiKeys.includes(opts.geminiKey)) {
        cfg.gemini.apiKeys.push(opts.geminiKey);
      }
      updated = true;
    }

    if (opts.openaiKey) {
      if (!cfg.openai.apiKeys.includes(opts.openaiKey)) {
        cfg.openai.apiKeys.push(opts.openaiKey);
      }
      updated = true;
    }

    if (opts.openaiBase) {
      cfg.openai.baseUrl = opts.openaiBase;
      updated = true;
    }

    if (updated) {
      saveConfig(cfg);
      logger.success(`Konfigurasi tersimpan di ${getConfigPath()}`);
    }

    const current = loadConfig();
    logger.info(`File konfigurasi: ${getConfigPath()}`);
    logger.info(`AI Provider: ${current.provider}`);
    logger.info(
      `Gemini Keys: ${current.gemini.apiKeys.length} terdaftar (Models: dork=${current.gemini.models.dork ?? current.gemini.models.fast}, fast=${current.gemini.models.fast}, writer=${current.gemini.models.writer})`
    );
    logger.info(
      `OpenAI Keys: ${current.openai.apiKeys.length} terdaftar (Base: ${current.openai.baseUrl}, Models: dork=${current.openai.models.dork ?? current.openai.models.fast}, fast=${current.openai.models.fast}, writer=${current.openai.models.writer})`
    );
  });

// CLI Command: serve
program
  .command('serve')
  .description('Jalankan Local Web UI dashboard')
  .option('-p, --port <number>', 'Port HTTP server', '3456')
  .action((opts) => {
    startServer(Number(opts.port) || 3456);
  });

// CLI Command: chat
program
  .command('chat')
  .description('Mulai sesi obrolan interaktif AI akademik')
  .action(async () => {
    await startChat();
  });

// Default action: if interactive TTY and no args, run interactive chat
if (process.stdin.isTTY && process.argv.length <= 2) {
  startChat().catch((err) => {
    logger.error(String(err));
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}
